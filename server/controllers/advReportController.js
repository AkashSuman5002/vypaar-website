const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const { getBaseFilter } = require('../utils/queryHelper');

const getCustomerReport = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    // Two queries instead of N+1: one for all customers, one aggregation that
    // sums sales totals/payments grouped by customer. Joined in memory below.
    const [customers, salesByCustomer] = await Promise.all([
      Customer.find({ ...baseFilter }),
      Sale.aggregate([
        { $match: { ...baseFilter, customer: { $ne: null } } },
        {
          $group: {
            _id: '$customer',
            totalSales: { $sum: { $ifNull: ['$totalAmount', 0] } },
            totalPayments: { $sum: { $ifNull: ['$paidAmount', 0] } },
          },
        },
      ]),
    ]);

    const totalsByCustomer = new Map(
      salesByCustomer.map((s) => [String(s._id), s])
    );

    const report = customers.map((c) => {
      const totals = totalsByCustomer.get(String(c._id));
      const totalSales = totals ? totals.totalSales : 0;
      const totalPayments = totals ? totals.totalPayments : 0;
      return {
        _id: c._id,
        name: c.name,
        phone: c.phone,
        totalSales,
        totalPayments,
        outstandingBalance: totalSales - totalPayments + (c.openingBalance || 0),
      };
    });
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
