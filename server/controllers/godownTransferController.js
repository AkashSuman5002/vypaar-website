const GodownTransfer = require('../models/GodownTransfer');
const Godown = require('../models/Godown');
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');
const { withTransaction } = require('../utils/withTransaction');

const getNextTransferNumber = async (req) => {
  const baseFilter = getBaseFilter(req);
  const count = await GodownTransfer.countDocuments(baseFilter);
  return `GT-${String(count + 1).padStart(4, '0')}`;
};

// Find a product's godownStock entry for a given godown id (or undefined).
const findGodownEntry = (product, godownId) =>
  (product.godownStock || []).find(e => e.godown && e.godown.toString() === godownId.toString());

// Ensure the product has godownStock entries that account for its full global stock.
// When a product has no godownStock yet, treat its entire global `stock` as residing in
// its current `warehouse` so existing data behaves sensibly under the new model.
const ensureGodownStock = (product) => {
  if (!product.godownStock) product.godownStock = [];
  if (product.godownStock.length === 0 && product.warehouse) {
    product.godownStock.push({ godown: product.warehouse, quantity: product.stock || 0 });
  }
};

// Read the available quantity in a given godown for a product.
const availableInGodown = (product, godownId) => {
  const entry = findGodownEntry(product, godownId);
  return entry ? entry.quantity : 0;
};

// Move `qty` of a product from one godown to another (in-memory; caller saves).
const moveBetweenGodowns = (product, fromGodown, toGodown, qty) => {
  const fromEntry = findGodownEntry(product, fromGodown);
  fromEntry.quantity -= qty;

  let toEntry = findGodownEntry(product, toGodown);
  if (!toEntry) {
    product.godownStock.push({ godown: toGodown, quantity: qty });
  } else {
    toEntry.quantity += qty;
  }
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

    // Validate every line item up-front (product exists, quantity > 0 and available
    // in the source godown) before mutating anything.
    for (const item of items) {
      const product = productMap.get(item.product.toString());
      if (!product) return res.status(404).json({ message: `Product not found: ${item.productName || item.product}` });

      const qty = Number(item.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        return res.status(400).json({ message: `Quantity must be greater than 0 for ${product.name}` });
      }

      ensureGodownStock(product);
      const available = availableInGodown(product, fromGodown);
      if (qty > available) {
        return res.status(400).json({
          message: `Insufficient stock for ${product.name} in ${fromG.name}: requested ${qty}, available ${available}`,
        });
      }
    }

    const transferNumber = await getNextTransferNumber(req);

    const transfer = await withTransaction(async (session) => {
      const processedItems = [];

      for (const item of items) {
        const product = productMap.get(item.product.toString());
        const qty = Number(item.quantity);
        ensureGodownStock(product);

        const balanceBefore = product.stock;

        // Redistribute quantity between godowns. Global `stock` is intentionally
        // left unchanged — a transfer only moves location, not total quantity.
        moveBetweenGodowns(product, fromGodown, toGodown, qty);
        await product.save({ session });

        // Ledger: record both legs of the move for an audit trail. The StockMovement
        // `type` enum only has 'transfer', so we use a sign convention (out = negative,
        // in = positive) and the description/referenceNumber to identify each leg.
        await StockMovement.create([{
          ...getCreateData(req, {
            product: product._id,
            productName: product.name,
            type: 'transfer',
            quantity: -qty,
            balanceBefore,
            balanceAfter: balanceBefore,
            referenceType: 'GodownTransfer',
            referenceNumber: transferNumber,
            description: `Transfer out to ${toG.name}`,
          }),
        }], { session });

        await StockMovement.create([{
          ...getCreateData(req, {
            product: product._id,
            productName: product.name,
            type: 'transfer',
            quantity: qty,
            balanceBefore,
            balanceAfter: balanceBefore,
            referenceType: 'GodownTransfer',
            referenceNumber: transferNumber,
            description: `Transfer in from ${fromG.name}`,
          }),
        }], { session });

        processedItems.push({
          product: product._id,
          productName: product.name,
          quantity: qty,
          unit: product.unit || 'pcs',
        });
      }

      const created = await GodownTransfer.create([{
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
      }], { session });

      // Backfill the StockMovement referenceId now that the transfer doc exists.
      await StockMovement.updateMany(
        { ...baseFilter, referenceType: 'GodownTransfer', referenceNumber: transferNumber, referenceId: { $exists: false } },
        { $set: { referenceId: created[0]._id } },
        { session }
      );

      return created[0];
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
      const productIds = transfer.items.map(item => item.product);
      const products = await Product.find({ _id: { $in: productIds }, ...baseFilter });
      const productMap = new Map(products.map(p => [p._id.toString(), p]));

      // Guard: ensure the destination godown still holds enough quantity to reverse,
      // i.e. the stock has not been moved onward to another godown.
      for (const item of transfer.items) {
        const product = productMap.get(item.product.toString());
        if (!product) continue;
        ensureGodownStock(product);
        const available = availableInGodown(product, transfer.toGodown);
        if (item.quantity > available) {
          return res.status(400).json({
            message: `Cannot reverse: ${product.name} only has ${available} in ${transfer.toGodownName}, but the transfer moved ${item.quantity}. It may have been moved onward.`,
          });
        }
      }

      await withTransaction(async (session) => {
        for (const item of transfer.items) {
          const product = productMap.get(item.product.toString());
          if (!product) continue;
          ensureGodownStock(product);
          // Reverse the move: destination -> source.
          moveBetweenGodowns(product, transfer.toGodown, transfer.fromGodown, item.quantity);
          await product.save({ session });
        }

        // Remove the ledger entries created for this transfer.
        await StockMovement.deleteMany(
          { ...baseFilter, referenceType: 'GodownTransfer', referenceId: transfer._id },
          { session }
        );

        await GodownTransfer.deleteOne({ _id: transfer._id, ...baseFilter }, { session });
      });
    } else {
      await GodownTransfer.findOneAndDelete({ _id: req.params.id, ...baseFilter });
    }

    res.json({ message: 'Transfer deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getTransfers, getTransferById, createTransfer, deleteTransfer };
