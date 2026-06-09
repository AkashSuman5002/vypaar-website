const StockMovement = require('../models/StockMovement');
const Product = require('../models/Product');
const Purchase = require('../models/Purchase');
const Sale = require('../models/Sale');

const { calculateCOGSFromMovements, getWeightedAverageCostFromMovements } = require('../utils/valuation');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');

const VALUATION_METHODS = ['fifo', 'lifo', 'average'];

const calculateCOGS = async (productId, quantitySold, method = 'average') => {
  const movements = await StockMovement.find({
    product: productId,
    type: { $in: ['purchase', 'sale'] },
  }).sort({ date: method === 'lifo' ? -1 : 1 });

  return calculateCOGSFromMovements(movements, quantitySold, method);
};

const getWeightedAverageCost = async (productId) => {
  const purchases = await StockMovement.find({
    product: productId,
    type: 'purchase',
  }).sort({ date: 1 });

  return getWeightedAverageCostFromMovements(purchases);
};

const recordStockMovement = async ({
  userId, businessId, productId, productName, type, quantity, rate, totalAmount,
  referenceType, referenceId, referenceNumber, description,
}) => {
  const product = await Product.findById(productId);
  if (!product) throw new Error('Product not found');

  const balanceBefore = product.stock;
  const qty = type === 'sale' ? -Math.abs(quantity) : (type === 'adjustment' ? quantity : Math.abs(quantity));
  const balanceAfter = Math.max(0, balanceBefore + qty);

  await StockMovement.create({
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
    description,
    date: new Date(),
  });

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
      lowStock: p.stock <= p.minStock,
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
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (product.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const diff = newStock - product.stock;

    await recordStockMovement({
      userId: req.user._id,
      businessId: req.businessId,
      productId: product._id,
      productName: product.name,
      type: 'adjustment',
      quantity: diff,
      balanceBefore: product.stock,
      balanceAfter: newStock,
      description: reason || 'Stock adjustment',
    });

    product.stock = newStock;
    await product.save();

    res.json({ message: 'Stock adjusted', product });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getValuationByMethod = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const method = req.query.method || 'average';
    const products = await Product.find({ ...baseFilter, isActive: true });

    const valuation = await Promise.all(products.map(async (p) => {
      let costPrice = p.costPrice || 0;
      if (method === 'fifo' || method === 'lifo') {
        costPrice = await calculateCOGS(p._id, 1, method);
      } else if (method === 'average') {
        costPrice = await getWeightedAverageCost(p._id);
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
        lowStock: p.stock <= (p.minStock || 5),
      };
    }));

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
