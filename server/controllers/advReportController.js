const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const { getBaseFilter } = require('../utils/queryHelper');

const getCustomerReport = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const customers = await Customer.find({ ...baseFilter });
    const report = await Promise.all(customers.map(async (c) => {
      const sales = await Sale.find({ customer: c._id, ...baseFilter });
      const totalSales = sales.reduce((s, x) => s + x.totalAmount, 0);
      const totalPayments = sales.reduce((s, x) => s + x.paidAmount, 0);
      return {
        _id: c._id,
        name: c.name,
        phone: c.phone,
        totalSales,
        totalPayments,
        outstandingBalance: totalSales - totalPayments + (c.openingBalance || 0),
      };
    }));
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProductReport = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const products = await Product.find({ ...baseFilter });
    const report = products.map((p) => ({
      _id: p._id,
      name: p.name,
      stock: p.stock,
      price: p.price,
      costPrice: p.costPrice,
      minStock: p.minStock,
      lowStock: p.stock <= p.minStock,
    }));
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPendingPaymentReport = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const sales = await Sale.find({
      ...baseFilter,
      remainingBalance: { $gt: 0 },
    }).sort({ date: -1 }).populate('customer', 'name phone');
    const report = sales.map((s) => ({
      _id: s._id,
      invoiceNumber: s.invoiceNumber,
      customerName: s.customerName,
      customer: s.customer,
      dueAmount: s.remainingBalance,
      date: s.date,
      totalAmount: s.totalAmount,
    }));
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getCustomerReport, getProductReport, getPendingPaymentReport };
