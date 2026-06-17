const GodownTransfer = require('../models/GodownTransfer');
const Godown = require('../models/Godown');
const Product = require('../models/Product');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');

const getNextTransferNumber = async (req) => {
  const baseFilter = getBaseFilter(req);
  const count = await GodownTransfer.countDocuments(baseFilter);
  return `GT-${String(count + 1).padStart(4, '0')}`;
};

const getTransfers = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { page = 1, limit = 50, search, fromGodown, toGodown, startDate, endDate } = req.query;
    const filter = { ...baseFilter };

    if (fromGodown) filter.fromGodown = fromGodown;
    if (toGodown) filter.toGodown = toGodown;
    if (startDate && endDate) {
      filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { transferNumber: new RegExp(escaped, 'i') },
        { fromGodownName: new RegExp(escaped, 'i') },
        { toGodownName: new RegExp(escaped, 'i') },
      ];
    }

    const transfers = await GodownTransfer.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await GodownTransfer.countDocuments(filter);
    res.json({ transfers, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getTransferById = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const transfer = await GodownTransfer.findOne({ _id: req.params.id, ...baseFilter });
    if (!transfer) return res.status(404).json({ message: 'Transfer not found' });
    res.json(transfer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createTransfer = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { fromGodown, toGodown, items, date, notes } = req.body;

    if (!fromGodown || !toGodown) {
      return res.status(400).json({ message: 'Both source and destination godowns are required' });
    }
    if (fromGodown === toGodown) {
      return res.status(400).json({ message: 'Source and destination godowns cannot be the same' });
    }
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'At least one item is required' });
    }

    const [fromG, toG] = await Promise.all([
      Godown.findOne({ _id: fromGodown, ...baseFilter }),
      Godown.findOne({ _id: toGodown, ...baseFilter }),
    ]);
    if (!fromG) return res.status(404).json({ message: 'Source godown not found' });
    if (!toG) return res.status(404).json({ message: 'Destination godown not found' });

    const productIds = items.map(item => item.product);
    const products = await Product.find({ _id: { $in: productIds }, ...baseFilter });
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    for (const item of items) {
      const product = productMap.get(item.product.toString());
      if (!product) return res.status(404).json({ message: `Product not found: ${item.productName || item.product}` });
    }

    const transferNumber = await getNextTransferNumber(req);
    const processedItems = [];

    // A product belongs to a single godown via its `warehouse` reference, so a transfer
    // moves each selected product from the source godown to the destination godown.
    for (const item of items) {
      const product = productMap.get(item.product.toString());

      product.warehouse = toGodown;
      await product.save();

      processedItems.push({
        product: product._id,
        productName: product.name,
        quantity: item.quantity,
        unit: product.unit || 'pcs',
      });
    }

    const transfer = await GodownTransfer.create({
      ...getCreateData(req, {
        transferNumber,
        fromGodown,
        fromGodownName: fromG.name,
        toGodown,
        toGodownName: toG.name,
        items: processedItems,
        totalItems: processedItems.length,
        date: date || new Date(),
        notes,
        status: 'completed',
      }),
    });

    res.status(201).json(transfer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteTransfer = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const transfer = await GodownTransfer.findOne({ _id: req.params.id, ...baseFilter });
    if (!transfer) return res.status(404).json({ message: 'Transfer not found' });

    if (transfer.status === 'completed') {
      // Move the products back to the source godown.
      const productIds = transfer.items.map(item => item.product);
      await Product.updateMany(
        { ...baseFilter, _id: { $in: productIds }, warehouse: transfer.toGodown },
        { $set: { warehouse: transfer.fromGodown } }
      );
    }

    await GodownTransfer.findOneAndDelete({ _id: req.params.id, ...baseFilter });
    res.json({ message: 'Transfer deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getTransfers, getTransferById, createTransfer, deleteTransfer };
