const StockReconciliation = require('../models/StockReconciliation');
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const Godown = require('../models/Godown');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');
const { withTransaction } = require('../utils/withTransaction');

const getNextReconciliationNumber = async (req) => {
  const baseFilter = getBaseFilter(req);
  const count = await StockReconciliation.countDocuments(baseFilter);
  return `SR-${String(count + 1).padStart(4, '0')}`;
};

const getReconciliations = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { page = 1, limit = 50, status } = req.query;
    const filter = { ...baseFilter };
    if (status) filter.status = status;

    const reconciliations = await StockReconciliation.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await StockReconciliation.countDocuments(filter);
    res.json({ reconciliations, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getReconciliationById = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const reconciliation = await StockReconciliation.findOne({ _id: req.params.id, ...baseFilter });
    if (!reconciliation) return res.status(404).json({ message: 'Reconciliation not found' });
    res.json(reconciliation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getStockForCount = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { godown, search } = req.query;
    const filter = { ...baseFilter, isActive: true, type: 'product' };

    const andConditions = [];
    // A selected godown should still surface products that have no warehouse assigned
    // (the common case — `warehouse` has no default), otherwise the count list is empty.
    if (godown) {
      andConditions.push({ $or: [{ warehouse: godown }, { warehouse: null }, { warehouse: { $exists: false } }] });
    }
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      andConditions.push({ $or: [
        { name: new RegExp(escaped, 'i') },
        { sku: new RegExp(escaped, 'i') },
        { barcode: new RegExp(escaped, 'i') },
      ] });
    }
    if (andConditions.length) filter.$and = andConditions;

    const products = await Product.find(filter).sort({ name: 1 }).select('name stock unit warehouse sku barcode category');
    res.json({ items: products });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createReconciliation = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { godown, items, date, notes } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'At least one item is required' });
    }

    let godownName = 'All Godowns';
    if (godown) {
      const g = await Godown.findOne({ _id: godown, ...baseFilter });
      if (!g) return res.status(404).json({ message: 'Godown not found' });
      godownName = g.name;
    }

    const reconciliationNumber = await getNextReconciliationNumber(req);
    let totalDiscrepancies = 0;

    const processedItems = items.map(item => {
      const diff = item.countedStock - item.systemStock;
      if (diff !== 0) totalDiscrepancies++;
      return {
        product: item.product,
        productName: item.productName,
        systemStock: item.systemStock,
        countedStock: item.countedStock,
        difference: diff,
        unit: item.unit || 'pcs',
        reason: item.reason || '',
      };
    });

    const reconciliation = await StockReconciliation.create({
      ...getCreateData(req, {
        reconciliationNumber,
        date: date || new Date(),
        godown: godown || null,
        godownName,
        items: processedItems,
        totalItems: processedItems.length,
        totalDiscrepancies,
        status: 'draft',
        notes,
      }),
    });

    res.status(201).json(reconciliation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const applyReconciliation = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const reconciliation = await StockReconciliation.findOne({ _id: req.params.id, ...baseFilter });
    if (!reconciliation) return res.status(404).json({ message: 'Reconciliation not found' });
    if (reconciliation.status !== 'draft') {
      return res.status(400).json({ message: 'Only draft reconciliations can be applied' });
    }

    const itemsWithDifference = reconciliation.items.filter(item => item.difference !== 0);
    if (itemsWithDifference.length === 0) {
      reconciliation.status = 'applied';
      await reconciliation.save();
      return res.json(reconciliation);
    }

    const productIds = itemsWithDifference.map(item => item.product);
    const products = await Product.find({ _id: { $in: productIds }, ...baseFilter });
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    const bulkOps = [];
    const movements = [];

    for (const item of itemsWithDifference) {
      const product = productMap.get(item.product.toString());
      if (!product) continue;

      // Apply by the COUNTED absolute value, not the frozen-at-create-time
      // `difference`. The snapshot's `systemStock` may be stale (e.g. sales
      // happened between count and apply); applying `product.stock + difference`
      // would double-apply that delta and corrupt stock. Setting to the counted
      // figure makes post-apply stock equal what was physically counted,
      // regardless of intervening activity. The recorded movement quantity is the
      // real adjustment against current stock.
      const newStock = Math.max(0, item.countedStock);
      const adjustment = newStock - product.stock;
      bulkOps.push({
        updateOne: {
          filter: { _id: product._id, ...baseFilter },
          update: { $set: { stock: newStock } },
        },
      });

      movements.push({
        user: req.user._id,
        business: req.businessId,
        product: product._id,
        productName: product.name,
        type: 'adjustment',
        quantity: adjustment,
        balanceBefore: product.stock,
        balanceAfter: newStock,
        referenceType: 'StockReconciliation',
        referenceNumber: reconciliation.reconciliationNumber,
        description: `Stock reconciliation: ${item.reason || 'Physical count adjustment'}`,
        date: new Date(),
      });
    }

    await withTransaction(async (session) => {
      if (bulkOps.length > 0) {
        await Product.bulkWrite(bulkOps, { session });
      }
      if (movements.length > 0) {
        await StockMovement.insertMany(movements, { session });
      }

      reconciliation.status = 'applied';
      await reconciliation.save({ session });
    });

    res.json(reconciliation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteReconciliation = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const reconciliation = await StockReconciliation.findOne({ _id: req.params.id, ...baseFilter });
    if (!reconciliation) return res.status(404).json({ message: 'Reconciliation not found' });
    if (reconciliation.status === 'applied') {
      return res.status(400).json({ message: 'Cannot delete applied reconciliation' });
    }
    await StockReconciliation.findOneAndDelete({ _id: req.params.id, ...baseFilter });
    res.json({ message: 'Reconciliation deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getReconciliations, getReconciliationById, getStockForCount, createReconciliation, applyReconciliation, deleteReconciliation };
