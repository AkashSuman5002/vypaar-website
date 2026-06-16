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
      Sale.find({ ...baseFilter, type: 'invoice', status: { $ne: 'cancelled' } }).select('totalAmount paidAmount remainingBalance date items customerName invoiceNumber paymentStatus createdAt cgstTotal sgstTotal igstTotal').lean(),
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

    // Output GST collected on sales is a liability owed to the govt, not profit.
    // Subtract it so Net Profit matches the corrected P&L (net-of-GST revenue).
    const totalOutputGST = allSales.reduce((sum, s) => sum + (s.cgstTotal || 0) + (s.sgstTotal || 0) + (s.igstTotal || 0), 0);
    const netSales = totalSales - totalOutputGST;

    const netProfit = netSales - totalCOGS - totalExpenses;

    const calcTrend = (current, previous) => {
      if (!previous || previous === 0) return null;
      return Math.round(((current - previous) / previous) * 100);
    };

    const gstOf = (s) => (s.cgstTotal || 0) + (s.sgstTotal || 0) + (s.igstTotal || 0);
    const currentMonthSales = allSales.filter(s => new Date(s.date) >= monthStart).reduce((sum, s) => sum + s.totalAmount, 0);
    const prevMonthSales = allSales.filter(s => new Date(s.date) >= prevMonthStart && new Date(s.date) <= prevMonthEnd).reduce((sum, s) => sum + s.totalAmount, 0);
    // Net-of-GST sales for the profit trend, to mirror the corrected netProfit.
    const currentMonthNetSales = allSales.filter(s => new Date(s.date) >= monthStart).reduce((sum, s) => sum + s.totalAmount - gstOf(s), 0);
    const prevMonthNetSales = allSales.filter(s => new Date(s.date) >= prevMonthStart && new Date(s.date) <= prevMonthEnd).reduce((sum, s) => sum + s.totalAmount - gstOf(s), 0);

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

    const currentMonthProfit = currentMonthNetSales - currentMonthCOGS - currentMonthExpenses;
    const prevMonthProfit = prevMonthNetSales - prevMonthCOGS - prevMonthExpenses;

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

    // Year-over-Year comparison
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;
    const thisYearStart = new Date(`${currentYear}-01-01`);
    const thisYearEnd = new Date(`${currentYear}-12-31T23:59:59.999Z`);
    const lastYearStart = new Date(`${lastYear}-01-01`);
    const lastYearEnd = new Date(`${lastYear}-12-31T23:59:59.999Z`);

    const thisYearSales = await Sale.find({ ...baseFilter, type: 'invoice', date: { $gte: thisYearStart, $lte: thisYearEnd } }).lean();
    const lastYearSales = await Sale.find({ ...baseFilter, type: 'invoice', date: { $gte: lastYearStart, $lte: lastYearEnd } }).lean();
    const thisYearPurchases = await Purchase.find({ ...baseFilter, date: { $gte: thisYearStart, $lte: thisYearEnd } }).lean();
    const lastYearPurchases = await Purchase.find({ ...baseFilter, date: { $gte: lastYearStart, $lte: lastYearEnd } }).lean();

    const yoyComparison = {
      thisYear: {
        sales: thisYearSales.reduce((s, x) => s + (x.totalAmount || 0), 0),
        purchases: thisYearPurchases.reduce((s, x) => s + (x.totalAmount || 0), 0),
        salesCount: thisYearSales.length,
        purchasesCount: thisYearPurchases.length,
      },
      lastYear: {
        sales: lastYearSales.reduce((s, x) => s + (x.totalAmount || 0), 0),
        purchases: lastYearPurchases.reduce((s, x) => s + (x.totalAmount || 0), 0),
        salesCount: lastYearSales.length,
        purchasesCount: lastYearPurchases.length,
      },
    };

    // Top selling items
    const allSalesForItems = await Sale.find({ ...baseFilter, type: 'invoice', status: { $ne: 'cancelled' } }).limit(500).lean();
    const itemSalesMap = {};
    allSalesForItems.forEach(sale => {
      (sale.items || []).forEach(item => {
        const key = item.productName || 'Unknown';
        if (!itemSalesMap[key]) itemSalesMap[key] = { name: key, quantity: 0, revenue: 0 };
        itemSalesMap[key].quantity += item.quantity || 0;
        itemSalesMap[key].revenue += item.amount || 0;
      });
    });
    const topItems = Object.values(itemSalesMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    // Receivable aging buckets
    const allPending = await Sale.find({ ...baseFilter, type: 'invoice', paymentStatus: { $in: ['unpaid', 'partial'] } }).lean();
    const agingBuckets = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
    allPending.forEach(sale => {
      const balance = sale.remainingBalance || 0;
      const dueDate = sale.dueDate ? new Date(sale.dueDate) : new Date(sale.date);
      const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
      if (daysOverdue <= 0) agingBuckets.current += balance;
      else if (daysOverdue <= 30) agingBuckets.days30 += balance;
      else if (daysOverdue <= 60) agingBuckets.days60 += balance;
      else if (daysOverdue <= 90) agingBuckets.days90 += balance;
      else agingBuckets.over90 += balance;
    });

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
      yoyComparison,
      topItems,
      agingBuckets,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getDashboardData };
