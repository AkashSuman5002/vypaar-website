const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const Expense = require('../models/Expense');
const Account = require('../models/Account');
const mongoose = require('mongoose');
const { getBaseFilter } = require('../utils/queryHelper');

const getDashboardData = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

    const currentYear = now.getFullYear();
    const lastYear = currentYear - 1;
    const thisYearStart = new Date(`${currentYear}-01-01`);
    const thisYearEnd = new Date(`${currentYear}-12-31T23:59:59.999Z`);
    const lastYearStart = new Date(`${lastYear}-01-01`);
    const lastYearEnd = new Date(`${lastYear}-12-31T23:59:59.999Z`);

    // The aggregation pipeline does NOT auto-cast ids to ObjectId the way Model.find()
    // does, so build an explicitly-cast copy of baseFilter for every $match stage.
    const toId = (v) => (v instanceof mongoose.Types.ObjectId ? v : new mongoose.Types.ObjectId(v));
    const aggBase = {};
    if (baseFilter.business !== undefined) aggBase.business = toId(baseFilter.business);
    if (baseFilter.user !== undefined) aggBase.user = toId(baseFilter.user);

    // Aggregation expressions reused across pipelines.
    // GST per sale (each field defaulted to 0, mirroring the old `|| 0` reduce).
    const salesMatch = { ...aggBase, type: 'invoice', status: { $ne: 'cancelled' } };
    const gstExpr = { $add: [{ $ifNull: ['$cgstTotal', 0] }, { $ifNull: ['$sgstTotal', 0] }, { $ifNull: ['$igstTotal', 0] }] };
    const inRange = (start, end) => (end
      ? { $and: [{ $gte: ['$date', start] }, { $lte: ['$date', end] }] }
      : { $gte: ['$date', start] });
    // Expense amount mirrors the old `(e.totalAmount || e.amount || 0)` — note `|| 0`
    // treats 0 as falsy, so $ifNull is NOT sufficient; fall through when totalAmount is 0/null.
    const expenseAmountExpr = {
      $cond: [
        { $and: [{ $ne: ['$totalAmount', null] }, { $ne: ['$totalAmount', 0] }] },
        '$totalAmount',
        { $ifNull: ['$amount', 0] },
      ],
    };

    const [
      salesScalarArr, cogsArr, purchArr, expArr, txnArr, yoySalesArr,
      totalCustomers, totalProducts, products,
      monthlyDocs, recentDocs, pendingDocs, topItemDocs,
      cashAccounts, bankAccounts,
    ] = await Promise.all([
      // 1. Sales scalar sums (totals, dues, month splits) — replaces loading every sale.
      Sale.aggregate([
        { $match: salesMatch },
        { $group: {
          _id: null,
          totalSales: { $sum: { $ifNull: ['$totalAmount', 0] } },
          totalOutputGST: { $sum: gstExpr },
          pendingDuesTotal: { $sum: { $ifNull: ['$remainingBalance', 0] } },
          pendingInvoices: { $sum: { $cond: [{ $gt: [{ $ifNull: ['$remainingBalance', 0] }, 0] }, 1, 0] } },
          overdueInvoices: { $sum: { $cond: [{ $and: [{ $gt: [{ $ifNull: ['$remainingBalance', 0] }, 0] }, { $lt: ['$date', thirtyDaysAgo] }] }, 1, 0] } },
          currentMonthSales: { $sum: { $cond: [inRange(monthStart), { $ifNull: ['$totalAmount', 0] }, 0] } },
          prevMonthSales: { $sum: { $cond: [inRange(prevMonthStart, prevMonthEnd), { $ifNull: ['$totalAmount', 0] }, 0] } },
          currentMonthGST: { $sum: { $cond: [inRange(monthStart), gstExpr, 0] } },
          prevMonthGST: { $sum: { $cond: [inRange(prevMonthStart, prevMonthEnd), gstExpr, 0] } },
        } },
      ]),
      // 2. COGS (total + month splits) via $unwind + $lookup on products — no in-memory join.
      Sale.aggregate([
        { $match: salesMatch },
        { $unwind: '$items' },
        { $match: { 'items.product': { $ne: null } } },
        { $lookup: {
          from: 'products',
          let: { pid: '$items.product' },
          pipeline: [
            { $match: { ...aggBase, $expr: { $eq: ['$_id', '$$pid'] } } },
            { $project: { costPrice: 1 } },
          ],
          as: 'prod',
        } },
        { $unwind: '$prod' },
        { $set: { lineCost: { $multiply: [{ $ifNull: ['$prod.costPrice', 0] }, { $ifNull: ['$items.quantity', 0] }] } } },
        { $group: {
          _id: null,
          totalCOGS: { $sum: '$lineCost' },
          currentMonthCOGS: { $sum: { $cond: [inRange(monthStart), '$lineCost', 0] } },
          prevMonthCOGS: { $sum: { $cond: [inRange(prevMonthStart, prevMonthEnd), '$lineCost', 0] } },
        } },
      ]),
      // 3. Purchases scalar sums + YoY (single scan).
      Purchase.aggregate([
        { $match: aggBase },
        { $group: {
          _id: null,
          totalPurchases: { $sum: { $ifNull: ['$totalAmount', 0] } },
          currentMonthPurchases: { $sum: { $cond: [inRange(monthStart), { $ifNull: ['$totalAmount', 0] }, 0] } },
          prevMonthPurchases: { $sum: { $cond: [inRange(prevMonthStart, prevMonthEnd), { $ifNull: ['$totalAmount', 0] }, 0] } },
          thisYearPurchases: { $sum: { $cond: [inRange(thisYearStart, thisYearEnd), { $ifNull: ['$totalAmount', 0] }, 0] } },
          thisYearPurchasesCount: { $sum: { $cond: [inRange(thisYearStart, thisYearEnd), 1, 0] } },
          lastYearPurchases: { $sum: { $cond: [inRange(lastYearStart, lastYearEnd), { $ifNull: ['$totalAmount', 0] }, 0] } },
          lastYearPurchasesCount: { $sum: { $cond: [inRange(lastYearStart, lastYearEnd), 1, 0] } },
        } },
      ]),
      // 4. Expense scalar sums.
      Expense.aggregate([
        { $match: aggBase },
        { $set: { amt: expenseAmountExpr } },
        { $group: {
          _id: null,
          totalExpenses: { $sum: '$amt' },
          currentMonthExpenses: { $sum: { $cond: [inRange(monthStart), '$amt', 0] } },
          prevMonthExpenses: { $sum: { $cond: [inRange(prevMonthStart, prevMonthEnd), '$amt', 0] } },
        } },
      ]),
      // 5. Transaction sums grouped by type — replaces loading every transaction.
      Transaction.aggregate([
        { $match: aggBase },
        { $group: { _id: '$type', total: { $sum: { $ifNull: ['$amount', 0] } } } },
      ]),
      // 6. YoY sales (type:invoice, INCLUDING cancelled — mirrors the old yoy query).
      Sale.aggregate([
        { $match: { ...aggBase, type: 'invoice' } },
        { $group: {
          _id: null,
          thisYearSales: { $sum: { $cond: [inRange(thisYearStart, thisYearEnd), { $ifNull: ['$totalAmount', 0] }, 0] } },
          thisYearSalesCount: { $sum: { $cond: [inRange(thisYearStart, thisYearEnd), 1, 0] } },
          lastYearSales: { $sum: { $cond: [inRange(lastYearStart, lastYearEnd), { $ifNull: ['$totalAmount', 0] }, 0] } },
          lastYearSalesCount: { $sum: { $cond: [inRange(lastYearStart, lastYearEnd), 1, 0] } },
        } },
      ]),
      Customer.countDocuments(baseFilter),
      Product.countDocuments(baseFilter),
      Product.find(baseFilter).select('costPrice stock price type').lean(),
      // Month-by-month chart: scoped to this year, only the 2 fields needed.
      Sale.find({ ...salesMatch, date: { $gte: yearStart, $lte: yearEnd } }).select('date totalAmount').lean(),
      // Recent activity: top 10 by createdAt instead of sorting the whole collection.
      Sale.find(salesMatch).sort({ createdAt: -1 }).limit(10)
        .select('totalAmount paidAmount remainingBalance date items customerName invoiceNumber paymentStatus createdAt cgstTotal sgstTotal igstTotal').lean(),
      // Receivable aging: only unpaid/partial, only the 3 fields needed.
      Sale.find({ ...baseFilter, type: 'invoice', paymentStatus: { $in: ['unpaid', 'partial'] } }).select('remainingBalance dueDate date').lean(),
      // Top items: bounded to 500 sales, only items needed.
      Sale.find(salesMatch).limit(500).select('items').lean(),
      Account.find({ ...baseFilter, type: 'asset', category: 'cash' }).select('balance').lean(),
      Account.find({ ...baseFilter, type: 'asset', category: 'bank' }).select('balance').lean(),
    ]);

    const S = salesScalarArr[0] || {};
    const C = cogsArr[0] || {};
    const P = purchArr[0] || {};
    const E = expArr[0] || {};
    const Y = yoySalesArr[0] || {};

    const totalSales = S.totalSales || 0;
    const totalOutputGST = S.totalOutputGST || 0;
    const totalCOGS = C.totalCOGS || 0;
    const totalPurchases = P.totalPurchases || 0;
    const totalExpenses = E.totalExpenses || 0;

    const netSales = totalSales - totalOutputGST;
    const netProfit = netSales - totalCOGS - totalExpenses;

    const calcTrend = (current, previous) => {
      if (!previous || previous === 0) return null;
      return Math.round(((current - previous) / previous) * 100);
    };

    const currentMonthSales = S.currentMonthSales || 0;
    const prevMonthSales = S.prevMonthSales || 0;
    const currentMonthNetSales = (S.currentMonthSales || 0) - (S.currentMonthGST || 0);
    const prevMonthNetSales = (S.prevMonthSales || 0) - (S.prevMonthGST || 0);
    const currentMonthPurchases = P.currentMonthPurchases || 0;
    const prevMonthPurchases = P.prevMonthPurchases || 0;
    const currentMonthCOGS = C.currentMonthCOGS || 0;
    const prevMonthCOGS = C.prevMonthCOGS || 0;
    const currentMonthExpenses = E.currentMonthExpenses || 0;
    const prevMonthExpenses = E.prevMonthExpenses || 0;

    const currentMonthProfit = currentMonthNetSales - currentMonthCOGS - currentMonthExpenses;
    const prevMonthProfit = prevMonthNetSales - prevMonthCOGS - prevMonthExpenses;

    // Services are not stockable, so they must never contribute to inventory/stock metrics.
    const stockProducts = products.filter(p => p.type !== 'service');
    const lowStockProducts = stockProducts.filter(p => (p.stock || 0) <= (p.minStock || 0)).map(p => ({ name: p.name, stock: p.stock, minStock: p.minStock }));

    const pendingDuesTotal = S.pendingDuesTotal || 0;
    const pendingInvoices = S.pendingInvoices || 0;
    const overdueInvoices = S.overdueInvoices || 0;

    const txnMap = {};
    txnArr.forEach(t => { txnMap[t._id] = t.total || 0; });

    let cashBalance = cashAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);
    let bankBalance = bankAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);
    cashBalance += (txnMap.cash_in || 0) - (txnMap.cash_out || 0);
    bankBalance += (txnMap.bank_in || 0) - (txnMap.bank_out || 0);

    const recentActivity = recentDocs;
    const recentTransactions = recentDocs.slice(0, 5);

    const monthlySalesMap = {};
    monthlyDocs.forEach(s => {
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

    const inventoryValue = stockProducts.reduce((s, p) => s + (p.stock || 0) * (p.costPrice || 0), 0);
    const inventoryValueAtPrice = stockProducts.reduce((s, p) => s + (p.stock || 0) * (p.price || 0), 0);

    const yoyComparison = {
      thisYear: {
        sales: Y.thisYearSales || 0,
        purchases: P.thisYearPurchases || 0,
        salesCount: Y.thisYearSalesCount || 0,
        purchasesCount: P.thisYearPurchasesCount || 0,
      },
      lastYear: {
        sales: Y.lastYearSales || 0,
        purchases: P.lastYearPurchases || 0,
        salesCount: Y.lastYearSalesCount || 0,
        purchasesCount: P.lastYearPurchasesCount || 0,
      },
    };

    // Top selling items (bounded to 500 sales).
    const itemSalesMap = {};
    topItemDocs.forEach(sale => {
      (sale.items || []).forEach(item => {
        const key = item.productName || 'Unknown';
        if (!itemSalesMap[key]) itemSalesMap[key] = { name: key, quantity: 0, revenue: 0 };
        itemSalesMap[key].quantity += item.quantity || 0;
        itemSalesMap[key].revenue += item.amount || 0;
      });
    });
    const topItems = Object.values(itemSalesMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    // Receivable aging buckets
    const agingBuckets = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
    pendingDocs.forEach(sale => {
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
