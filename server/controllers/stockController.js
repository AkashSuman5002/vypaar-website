const StockMovement = require('../models/StockMovement');
const Product = require('../models/Product');
const Purchase = require('../models/Purchase');
const Sale = require('../models/Sale');

const { calculateCOGSFromMovements, getWeightedAverageCostFromMovements } = require('../utils/valuation');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');
const { withTransaction } = require('../utils/withTransaction');

const VALUATION_METHODS = ['fifo', 'lifo', 'average'];

const calculateCOGS = async (req, productId, quantitySold, method = 'average') => {
  const movements = await StockMovement.find({
    product: productId,
    ...getBaseFilter(req),
    type: { $in: ['purchase', 'sale'] },
  }).sort({ date: method === 'lifo' ? -1 : 1 });

  return calculateCOGSFromMovements(movements, quantitySold, method);
};

const getWeightedAverageCost = async (req, productId) => {
  const purchases = await StockMovement.find({
    product: productId,
    ...getBaseFilter(req),
    type: 'purchase',
  }).sort({ date: 1 });

  return getWeightedAverageCostFromMovements(purchases);
};

const recordStockMovement = async ({
  userId, businessId, productId, productName, type, quantity, rate, totalAmount,
  referenceType, referenceId, referenceNumber, description, batchNo, serialNo,
  session = null,
}) => {
  // When a session is passed the read + write join the caller's transaction so
  // the stock ledger row and the Product.stock change commit atomically.
  const opts = session ? { session } : {};
  // Scope the product lookup by business when available: a staff/member user's
  // req.user._id differs from the owner id stored on the product, so matching by
  // `user` alone would fail to resolve shared business documents.
  const productFilter = businessId
    ? { _id: productId, business: businessId }
    : { _id: productId, user: userId };
  const product = await Product.findOne(productFilter, null, opts);
  if (!product) throw new Error('Product not found');

  const balanceBefore = product.stock;
  const qty = type === 'sale' ? -Math.abs(quantity) : (type === 'adjustment' ? quantity : Math.abs(quantity));
  const balanceAfter = Math.max(0, balanceBefore + qty);

  await StockMovement.create([{
    user: userId,
    business: businessId,
    product: productId,
    productName,
    type,
    quantity: qty,
    balanceBefore,
    balanceAfter,
    rate: rate || 0,
    totalAmount: totalAmount || 0,
    referenceType,
    referenceId,
    referenceNumber,
    batchNo,
    serialNo,
    description,
    date: new Date(),
  }], opts);

  return balanceAfter;
};

const getStockMovements = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { productId, type, startDate, endDate, page = 1, limit = 50 } = req.query;
    const filter = { ...baseFilter };
    if (productId) filter.product = productId;
    if (type) filter.type = type;
    if (startDate && endDate) {
      filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const movements = await StockMovement.find(filter)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('product', 'name unit');

    const total = await StockMovement.countDocuments(filter);
    res.json({ movements, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getStockValuation = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const products = await Product.find({ ...baseFilter, isActive: true });
    const valuation = products.map((p) => ({
      _id: p._id,
      name: p.name,
      category: p.category,
      stock: p.stock,
      unit: p.unit,
      costPrice: p.costPrice,
      price: p.price,
      valueAtCost: (p.stock || 0) * (p.costPrice || 0),
      valueAtPrice: (p.stock || 0) * (p.price || 0),
      minStock: p.minStock,
      lowStock: p.type !== 'service' && p.stock <= p.minStock,
    }));

    const totalValue = valuation.reduce((s, v) => s + v.valueAtCost, 0);
    res.json({ items: valuation, totalValue, totalItems: valuation.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const adjustStock = async (req, res) => {
  try {
    const { productId, newStock, reason } = req.body;
    let updated;
    // Atomic: the stock-ledger row and the Product.stock write must both commit
    // or both roll back, otherwise the movement ledger desyncs from the product.
    await withTransaction(async (session) => {
      const product = await Product.findOne(
        { _id: productId, ...getBaseFilter(req) },
        null,
        { session },
      );
      if (!product) {
        const e = new Error('Product not found');
        e.statusCode = 404;
        throw e;
      }

      // Compute the delta from the in-transaction snapshot so concurrent edits
      // cannot record a stale adjustment quantity.
      const diff = newStock - product.stock;

      await recordStockMovement({
        userId: req.user._id,
        businessId: req.businessId,
        productId: product._id,
        productName: product.name,
        type: 'adjustment',
        quantity: diff,
        description: reason || 'Stock adjustment',
        session,
      });

      product.stock = newStock;
      await product.save({ session });
      updated = product;
    });

    res.json({ message: 'Stock adjusted', product: updated });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

const getValuationByMethod = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const method = req.query.method || 'average';
    const products = await Product.find({ ...baseFilter, isActive: true });

    // Avoid the N+1 (one StockMovement query per product). Fetch every relevant
    // movement for these products in a single query, then group by product in
    // memory and feed the existing pure valuation helpers. This preserves the
    // exact per-product cost computation (and therefore the output shape).
    const productIds = products.map((p) => p._id);
    // fifo/average use purchase+sale movements; average effectively only uses
    // purchases. Pulling both types in one query covers all methods.
    const allMovements = productIds.length
      ? await StockMovement.find({
          product: { $in: productIds },
          ...baseFilter,
          type: { $in: ['purchase', 'sale'] },
        })
      : [];

    // Bucket movements per product, then sort to match the original per-product
    // query ordering: ascending date for fifo/average, descending for lifo.
    const movementsByProduct = new Map();
    for (const m of allMovements) {
      const key = String(m.product);
      if (!movementsByProduct.has(key)) movementsByProduct.set(key, []);
      movementsByProduct.get(key).push(m);
    }
    const sortDir = method === 'lifo' ? -1 : 1;
    for (const list of movementsByProduct.values()) {
      list.sort((a, b) => (new Date(a.date) - new Date(b.date)) * sortDir);
    }

    const valuation = products.map((p) => {
      let costPrice = p.costPrice || 0;
      const movements = movementsByProduct.get(String(p._id)) || [];
      if (method === 'fifo' || method === 'lifo') {
        costPrice = calculateCOGSFromMovements(movements, 1, method);
      } else if (method === 'average') {
        costPrice = getWeightedAverageCostFromMovements(movements);
      }
      return {
        _id: p._id,
        name: p.name,
        category: p.category,
        stock: p.stock,
        unit: p.unit,
        costPrice,
        price: p.price,
        valueAtCost: (p.stock || 0) * costPrice,
        valueAtPrice: (p.stock || 0) * (p.price || 0),
        lowStock: p.type !== 'service' && p.stock <= (p.minStock || 5),
      };
    });

    const totalValue = valuation.reduce((s, v) => s + v.valueAtCost, 0);
    res.json({ items: valuation, totalValue, totalItems: valuation.length, method });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  recordStockMovement, getStockMovements, getStockValuation, adjustStock,
  getValuationByMethod, calculateCOGS, getWeightedAverageCost,
};
