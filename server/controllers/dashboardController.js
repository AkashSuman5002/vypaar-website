const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const Expense = require('../models/Expense');
const Account = require('../models/Account');
const { getBaseFilter } = require('../utils/queryHelper');

const getDashboardData = async (req, res) => {
  try {
    const userId = req.user._id;
    const baseFilter = getBaseFilter(req);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const [totalSalesResult, totalPurchasesResult, totalExpensesResult, totalCustomers, totalProducts] = await Promise.all([
      Sale.aggregate([
        { $match: { ...baseFilter, type: 'invoice', status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Purchase.aggregate([
        { $match: baseFilter },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Expense.aggregate([
        { $match: baseFilter },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$totalAmount', '$amount', 0] } } } },
      ]),
      Customer.countDocuments(baseFilter),
      Product.countDocuments(baseFilter),
    ]);

    const totalSales = totalSalesResult[0]?.total || 0;
    const totalPurchases = totalPurchasesResult[0]?.total || 0;
    const totalExpenses = totalExpensesResult[0]?.total || 0;

    const [invoices, products] = await Promise.all([
      Sale.find({ ...baseFilter, type: 'invoice', status: { $ne: 'cancelled' } }).select('items date totalAmount'),
      Product.find(baseFilter).select('costPrice').lean(),
    ]);

    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    let totalCOGS = 0;
    invoices.forEach((s) => {
      s.items.forEach((item) => {
        if (item.product) {
          const prod = productMap.get(item.product.toString());
          if (prod) totalCOGS += prod.costPrice * item.quantity;
        }
      });
    });

    const netProfit = totalSales - totalCOGS - totalExpenses;

    const calcTrend = (current, previous) => {
      if (!previous || previous === 0) return null;
      return Math.round(((current - previous) / previous) * 100);
    };

    const currentMonthSales = invoices.filter(s => new Date(s.date) >= monthStart).reduce((sum, s) => sum + s.totalAmount, 0);
    const prevMonthSales = invoices.filter(s => new Date(s.date) >= prevMonthStart && new Date(s.date) <= prevMonthEnd).reduce((sum, s) => sum + s.totalAmount, 0);

    const [currentMonthPurchasesResult, prevMonthPurchasesResult, currentMonthExpensesResult, prevMonthExpensesResult] = await Promise.all([
      Purchase.aggregate([
        { $match: { ...baseFilter, date: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Purchase.aggregate([
        { $match: { ...baseFilter, date: { $gte: prevMonthStart, $lte: prevMonthEnd } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Expense.aggregate([
        { $match: { ...baseFilter, date: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$totalAmount', '$amount', 0] } } } },
      ]),
      Expense.aggregate([
        { $match: { ...baseFilter, date: { $gte: prevMonthStart, $lte: prevMonthEnd } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$totalAmount', '$amount', 0] } } } },
      ]),
    ]);

    const currentMonthPurchases = currentMonthPurchasesResult[0]?.total || 0;
    const prevMonthPurchases = prevMonthPurchasesResult[0]?.total || 0;

    let currentMonthCOGS = 0;
    invoices.filter(s => new Date(s.date) >= monthStart).forEach(s => {
      s.items.forEach(item => {
        if (item.product) {
          const prod = productMap.get(item.product.toString());
          if (prod) currentMonthCOGS += prod.costPrice * item.quantity;
        }
      });
    });
    let prevMonthCOGS = 0;
    invoices.filter(s => new Date(s.date) >= prevMonthStart && new Date(s.date) <= prevMonthEnd).forEach(s => {
      s.items.forEach(item => {
        if (item.product) {
          const prod = productMap.get(item.product.toString());
          if (prod) prevMonthCOGS += prod.costPrice * item.quantity;
        }
      });
    });

    const currentMonthExpenses = currentMonthExpensesResult[0]?.total || 0;
    const prevMonthExpenses = prevMonthExpensesResult[0]?.total || 0;

    const currentMonthProfit = currentMonthSales - currentMonthCOGS - currentMonthExpenses;
    const prevMonthProfit = prevMonthSales - prevMonthCOGS - prevMonthExpenses;

    const lowStockProducts = await Product.find({ ...baseFilter, $expr: { $lte: ['$stock', '$minStock'] } }).select('name stock minStock');

    const pendingDuesTotal = invoices.reduce((sum, s) => sum + s.remainingBalance, 0);
    const pendingInvoices = invoices.filter((s) => s.remainingBalance > 0).length;
    const overdueInvoices = invoices.filter(
      (s) => s.remainingBalance > 0 && new Date(s.date) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    ).length;

    const [cashAccounts, bankAccounts, transactionAgg] = await Promise.all([
      Account.find({ ...baseFilter, type: 'asset', category: 'cash' }).select('balance'),
      Account.find({ ...baseFilter, type: 'asset', category: 'bank' }).select('balance'),
      Transaction.aggregate([
        { $match: baseFilter },
        { $group: { _id: '$type', total: { $sum: '$amount' } } },
      ]),
    ]);

    const txnMap = {};
    transactionAgg.forEach(r => { txnMap[r._id] = r.total; });

    let cashBalance = cashAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);
    let bankBalance = bankAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);

    cashBalance += (txnMap.cash_in || 0) - (txnMap.cash_out || 0);
    bankBalance += (txnMap.bank_in || 0) - (txnMap.bank_out || 0);

    const recentTransactions = await Sale.find({ ...baseFilter, type: 'invoice' })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('invoiceNumber totalAmount date customerName');

    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

    const monthlySales = await Sale.aggregate([
      { $match: { ...baseFilter, type: 'invoice', status: { $ne: 'cancelled' }, date: { $gte: yearStart, $lte: yearEnd } } },
      { $group: { _id: { $month: '$date' }, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const productsArray = Array.from(productMap.values());
    const inventoryValue = productsArray.reduce((s, p) => s + (p.stock || 0) * (p.costPrice || 0), 0);
    const inventoryValueAtPrice = productsArray.reduce((s, p) => s + (p.stock || 0) * (p.price || 0), 0);

    const recentActivity = await Sale.find({ ...baseFilter, type: 'invoice' })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('invoiceNumber totalAmount date customerName paymentStatus paidAmount');

    res.json({
      totalSales,
      totalPurchases,
      totalCOGS,
      netProfit,
      totalCustomers,
      totalProducts,
      lowStockProducts,
      pendingDuesTotal,
      pendingInvoices,
      overdueInvoices,
      cashBalance,
      bankBalance,
      recentTransactions,
      monthlySales,
      inventoryValue,
      inventoryValueAtPrice,
      recentActivity,
      trends: {
        sales: calcTrend(currentMonthSales, prevMonthSales),
        purchases: calcTrend(currentMonthPurchases, prevMonthPurchases),
        profit: calcTrend(currentMonthProfit, prevMonthProfit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getDashboardData };
