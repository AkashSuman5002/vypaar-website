const Product = require('../models/Product');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');

const getProducts = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const products = await Product.find({ ...baseFilter }).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createProduct = async (req, res) => {
  try {
    const { name, category, price, costPrice, stock, unit, gstRate, sku, brand, hsn, description, image, supplier, warehouse, storageLocation, modelNo, size, serialNo, batchNo, expiryDate, mfgDate, cgst, sgst, igst, minStock, barcode, mrp } = req.body;
    const product = await Product.create({
      ...getCreateData(req),
      name, category, price, costPrice, stock, unit, gstRate,
      sku, brand, hsn, description, image, supplier, warehouse,
      storageLocation, modelNo, size, serialNo, batchNo,
      expiryDate, mfgDate, cgst, sgst, igst, minStock, barcode, mrp,
    });
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const product = await Product.findOne({ ...baseFilter, _id: req.params.id });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const { name, category, price, costPrice, stock, unit, gstRate, sku, brand, hsn, description, image, supplier, warehouse, storageLocation, modelNo, size, serialNo, batchNo, expiryDate, mfgDate, cgst, sgst, igst, minStock, barcode, mrp } = req.body;
    const updated = await Product.findByIdAndUpdate(req.params.id, { name, category, price, costPrice, stock, unit, gstRate, sku, brand, hsn, description, image, supplier, warehouse, storageLocation, modelNo, size, serialNo, batchNo, expiryDate, mfgDate, cgst, sgst, igst, minStock, barcode, mrp }, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProductById = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const product = await Product.findOne({ ...baseFilter, _id: req.params.id });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProductSales = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const product = await Product.findOne({ ...baseFilter, _id: req.params.id });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const Sale = require('../models/Sale');
    const sales = await Sale.find({ ...baseFilter, 'items.product': req.params.id })
      .sort({ date: -1 })
      .limit(20)
      .select('invoiceNumber date totalAmount customerName items');
    const filtered = sales.map((s) => ({
      _id: s._id,
      invoiceNumber: s.invoiceNumber,
      date: s.date,
      customerName: s.customerName,
      totalAmount: s.totalAmount,
      items: s.items.filter((i) => String(i.product) === req.params.id),
    }));
    const totalQty = filtered.reduce((sum, s) => sum + s.items.reduce((q, i) => q + i.quantity, 0), 0);
    const totalRevenue = filtered.reduce((sum, s) => sum + s.items.reduce((r, i) => r + i.amount, 0), 0);
    res.json({ sales: filtered, totalQty, totalRevenue });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const product = await Product.findOne({ ...baseFilter, _id: req.params.id });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getLastPurchasePrice = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const Purchase = require('../models/Purchase');
    const purchase = await Purchase.findOne({
      ...baseFilter,
      'items.product': req.params.id,
    }).sort({ date: -1 });
    if (!purchase) return res.json({ lastPrice: 0 });
    const item = purchase.items.find(i => String(i.product) === req.params.id);
    res.json({ lastPrice: item ? item.rate : 0 });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getProducts, getProductById, getProductSales, createProduct, updateProduct, deleteProduct, getLastPurchasePrice };
