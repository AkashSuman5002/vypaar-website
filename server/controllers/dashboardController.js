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

    const [allSales, allPurchases, allExpenses, totalCustomers, totalProducts] = await Promise.all([
      Sale.find({ ...baseFilter, type: 'invoice', status: { $ne: 'cancelled' } }).select('totalAmount paidAmount remainingBalance date items customerName invoiceNumber paymentStatus createdAt').lean(),
      Purchase.find(baseFilter).select('totalAmount date').lean(),
      Expense.find(baseFilter).select('totalAmount amount date').lean(),
      Customer.countDocuments(baseFilter),
      Product.countDocuments(baseFilter),
    ]);

    const totalSales = allSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const totalPurchases = allPurchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const totalExpenses = allExpenses.reduce((sum, e) => sum + (e.totalAmount || e.amount || 0), 0);

    const products = await Product.find(baseFilter).select('costPrice stock price').lean();
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    let totalCOGS = 0;
    allSales.forEach((s) => {
      (s.items || []).forEach((item) => {
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

    const currentMonthSales = allSales.filter(s => new Date(s.date) >= monthStart).reduce((sum, s) => sum + s.totalAmount, 0);
    const prevMonthSales = allSales.filter(s => new Date(s.date) >= prevMonthStart && new Date(s.date) <= prevMonthEnd).reduce((sum, s) => sum + s.totalAmount, 0);

    const currentMonthPurchases = allPurchases.filter(p => new Date(p.date) >= monthStart).reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const prevMonthPurchases = allPurchases.filter(p => new Date(p.date) >= prevMonthStart && new Date(p.date) <= prevMonthEnd).reduce((sum, p) => sum + (p.totalAmount || 0), 0);

    let currentMonthCOGS = 0;
    allSales.filter(s => new Date(s.date) >= monthStart).forEach(s => {
      (s.items || []).forEach(item => {
        if (item.product) {
          const prod = productMap.get(item.product.toString());
          if (prod) currentMonthCOGS += prod.costPrice * item.quantity;
        }
      });
    });
    let prevMonthCOGS = 0;
    allSales.filter(s => new Date(s.date) >= prevMonthStart && new Date(s.date) <= prevMonthEnd).forEach(s => {
      (s.items || []).forEach(item => {
        if (item.product) {
          const prod = productMap.get(item.product.toString());
          if (prod) prevMonthCOGS += prod.costPrice * item.quantity;
        }
      });
    });

    const currentMonthExpenses = allExpenses.filter(e => new Date(e.date) >= monthStart).reduce((sum, e) => sum + (e.totalAmount || e.amount || 0), 0);
    const prevMonthExpenses = allExpenses.filter(e => new Date(e.date) >= prevMonthStart && new Date(e.date) <= prevMonthEnd).reduce((sum, e) => sum + (e.totalAmount || e.amount || 0), 0);

    const currentMonthProfit = currentMonthSales - currentMonthCOGS - currentMonthExpenses;
    const prevMonthProfit = prevMonthSales - prevMonthCOGS - prevMonthExpenses;

    const lowStockProducts = products.filter(p => (p.stock || 0) <= (p.minStock || 0)).map(p => ({ name: p.name, stock: p.stock, minStock: p.minStock }));

    const pendingDuesTotal = allSales.reduce((sum, s) => sum + (s.remainingBalance || 0), 0);
    const pendingInvoices = allSales.filter((s) => (s.remainingBalance || 0) > 0).length;
    const overdueInvoices = allSales.filter(
      (s) => (s.remainingBalance || 0) > 0 && new Date(s.date) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    ).length;

    const [cashAccounts, bankAccounts, allTransactions] = await Promise.all([
      Account.find({ ...baseFilter, type: 'asset', category: 'cash' }).select('balance').lean(),
      Account.find({ ...baseFilter, type: 'asset', category: 'bank' }).select('balance').lean(),
      Transaction.find(baseFilter).select('type amount').lean(),
    ]);

    const txnMap = {};
    allTransactions.forEach(t => {
      if (!txnMap[t.type]) txnMap[t.type] = 0;
      txnMap[t.type] += t.amount || 0;
    });

    let cashBalance = cashAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);
    let bankBalance = bankAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);

    cashBalance += (txnMap.cash_in || 0) - (txnMap.cash_out || 0);
    bankBalance += (txnMap.bank_in || 0) - (txnMap.bank_out || 0);

    const recentTransactions = allSales
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

    const monthlySalesMap = {};
    allSales.filter(s => {
      const d = new Date(s.date);
      return d >= yearStart && d <= yearEnd;
    }).forEach(s => {
      const month = new Date(s.date).getMonth() + 1;
      if (!monthlySalesMap[month]) monthlySalesMap[month] = { total: 0, count: 0 };
      monthlySalesMap[month].total += s.totalAmount || 0;
      monthlySalesMap[month].count += 1;
    });
    const monthlySales = Object.entries(monthlySalesMap).map(([month, data]) => ({
      _id: parseInt(month),
      total: data.total,
      count: data.count,
    })).sort((a, b) => a._id - b._id);

    const inventoryValue = products.reduce((s, p) => s + (p.stock || 0) * (p.costPrice || 0), 0);
    const inventoryValueAtPrice = products.reduce((s, p) => s + (p.stock || 0) * (p.price || 0), 0);

    const recentActivity = allSales
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);

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
