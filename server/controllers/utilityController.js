const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const Expense = require('../models/Expense');
const Transaction = require('../models/Transaction');
const JournalEntry = require('../models/JournalEntry');
const Account = require('../models/Account');
const User = require('../models/User');
const Setting = require('../models/Setting');
const StockMovement = require('../models/StockMovement');
const Receipt = require('../models/Receipt');

// Verify data integrity across all modules
router.get('/verify', async (req, res) => {
  try {
    const userId = req.user.id;
    const results = {};

    // Customers
    const customerCount = await Customer.countDocuments({ user: userId });
    const customersWithIssues = await Customer.countDocuments({ user: userId, name: { $in: [null, ''] } });
    results.customers = { count: customerCount, status: customersWithIssues > 0 ? 'warning' : 'pass', issues: customersWithIssues > 0 ? [`${customersWithIssues} customers missing name`] : [] };

    // Products
    const productCount = await Product.countDocuments({ user: userId });
    const productsWithZeroPrice = await Product.countDocuments({ user: userId, price: { $lte: 0 } });
    const productsWithNegativeStock = await Product.countDocuments({ user: userId, stock: { $lt: 0 } });
    const prodIssues = [];
    if (productsWithZeroPrice > 0) prodIssues.push(`${productsWithZeroPrice} items with zero price`);
    if (productsWithNegativeStock > 0) prodIssues.push(`${productsWithNegativeStock} items with negative stock`);
    results.products = { count: productCount, status: prodIssues.length > 0 ? 'warning' : 'pass', issues: prodIssues };

    // Sales
    const saleCount = await Sale.countDocuments({ user: userId });
    const unpaidSales = await Sale.countDocuments({ user: userId, paymentStatus: { $ne: 'paid' }, type: 'invoice' });
    const saleIssues = [];
    if (unpaidSales > 0) saleIssues.push(`${unpaidSales} unpaid invoices`);
    results.sales = { count: saleCount, status: saleIssues.length > 0 ? 'warning' : 'pass', issues: saleIssues };

    // Purchases
    const purchaseCount = await Purchase.countDocuments({ user: userId });
    const unpaidPurchases = await Purchase.countDocuments({ user: userId, paymentStatus: { $ne: 'paid' } });
    const purchaseIssues = [];
    if (unpaidPurchases > 0) purchaseIssues.push(`${unpaidPurchases} unpaid purchases`);
    results.purchases = { count: purchaseCount, status: purchaseIssues.length > 0 ? 'warning' : 'pass', issues: purchaseIssues };

    // Expenses
    const expenseCount = await Expense.countDocuments({ user: userId });
    results.expenses = { count: expenseCount, status: 'pass', issues: [] };

    // Journal Entries
    const journalCount = await JournalEntry.countDocuments({ user: userId });
    const unbalancedEntries = await JournalEntry.countDocuments({ user: userId, $expr: { $ne: ['$totalDebit', '$totalCredit'] } });
    const journalIssues = [];
    if (unbalancedEntries > 0) journalIssues.push(`${unbalancedEntries} unbalanced entries`);
    if (journalCount === 0 && saleCount > 0) journalIssues.push('No journal entries for existing sales');
    results.journalEntries = { count: journalCount, status: journalIssues.length > 0 ? 'warning' : 'pass', issues: journalIssues };

    // Accounts
    const accountCount = await Account.countDocuments({ user: userId, isActive: true });
    results.accounts = { count: accountCount, status: accountCount > 0 ? 'pass' : 'warning', issues: accountCount === 0 ? ['No chart of accounts set up'] : [] };

    // Stock
    const stockMovements = await StockMovement.countDocuments({ user: userId });
    const lowStockProducts = await Product.countDocuments({ user: userId, $expr: { $lte: ['$stock', '$minStock'] }, minStock: { $gt: 0 } });
    const stockIssues = [];
    if (stockMovements === 0 && productCount > 0) stockIssues.push('No stock movement history');
    if (lowStockProducts > 0) stockIssues.push(`${lowStockProducts} products low on stock`);
    results.stock = { count: stockMovements, status: stockIssues.length > 0 ? 'warning' : 'pass', issues: stockIssues };

    // Transactions
    const transactionCount = await Transaction.countDocuments({ user: userId });
    results.transactions = { count: transactionCount, status: 'pass', issues: [] };

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Financial year status
router.get('/financial-year-status', async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
    const fyEndYear = fyStartYear + 1;

    const firstEntry = await JournalEntry.findOne({ user: userId }).sort({ entryDate: 1 });
    const lastEntry = await JournalEntry.findOne({ user: userId }).sort({ entryDate: -1 });

    res.json({
      currentFY: `${fyStartYear}-${String(fyEndYear).slice(-2)}`,
      nextFY: `${fyEndYear}-${String(fyEndYear + 1).slice(-2)}`,
      isOpen: true,
      startDate: `${fyStartYear}-04-01`,
      endDate: `${fyEndYear}-03-31`,
      firstEntryDate: firstEntry?.entryDate,
      lastEntryDate: lastEntry?.entryDate,
      totalEntries: await JournalEntry.countDocuments({ user: userId }),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Close financial year - create closing entries
router.post('/close-financial-year', async (req, res) => {
  try {
    const { confirmation } = req.body;
    if (confirmation !== 'CLOSE') {
      return res.status(400).json({ message: 'Please type CLOSE to confirm' });
    }
    const userId = req.user.id;

    // Get P&L summary
    const journals = await JournalEntry.find({ user: userId, isPosted: true });
    let totalIncome = 0;
    let totalExpense = 0;
    journals.forEach(j => {
      j.lines.forEach(l => {
        if (l.accountType === 'income') totalIncome += l.credit - l.debit;
        if (l.accountType === 'expense') totalExpense += l.debit - l.credit;
      });
    });
    const netProfit = totalIncome - totalExpense;

    // Get accounts for closing entry
    let retainedEarnings = await Account.findOne({ user: userId, category: 'retained_earnings' });
    if (!retainedEarnings) {
      retainedEarnings = await Account.create({ user: userId, name: 'Retained Earnings', code: '3002', type: 'equity', category: 'retained_earnings', balance: 0 });
    }
    let incomeSummary = await Account.findOne({ user: userId, category: 'sales' });
    let expenseSummary = await Account.findOne({ user: userId, category: 'direct_expense' });

    // Create closing journal entry
    const entryNumber = `FY-${Date.now()}`;
    const closingEntry = await JournalEntry.create({
      user: userId,
      entryNumber,
      entryDate: new Date(),
      referenceType: 'journal',
      narration: `Financial year closing entry - Net Profit: ₹${netProfit.toFixed(2)}`,
      description: 'Auto-generated financial year closing entry',
      lines: [
        ...(incomeSummary ? [{ account: incomeSummary._id, accountName: incomeSummary.name, accountType: 'income', debit: totalIncome, credit: 0 }] : []),
        ...(expenseSummary ? [{ account: expenseSummary._id, accountName: expenseSummary.name, accountType: 'expense', debit: 0, credit: totalExpense }] : []),
        { account: retainedEarnings._id, accountName: retainedEarnings.name, accountType: 'equity', debit: netProfit < 0 ? Math.abs(netProfit) : 0, credit: netProfit > 0 ? netProfit : 0 },
      ],
      totalDebit: totalIncome + (netProfit < 0 ? Math.abs(netProfit) : 0),
      totalCredit: totalExpense + (netProfit > 0 ? netProfit : 0),
    });

    // Update retained earnings balance
    retainedEarnings.balance += netProfit;
    await retainedEarnings.save();

    res.json({
      message: 'Financial year closed successfully',
      closingEntry: closingEntry.entryNumber,
      netProfit,
      totalIncome,
      totalExpense,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Export to Tally - generate XML from real data
router.post('/export-tally', async (req, res) => {
  try {
    const userId = req.user.id;
    const { modules, dateFrom, dateTo } = req.body;
    const dateFilter = {};
    if (dateFrom) dateFilter.$gte = new Date(dateFrom);
    if (dateTo) dateFilter.$lte = new Date(dateTo);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<ENVELOPE>\n<HEADER>\n<VERSION>1</VERSION>\n<TALLYREQUEST>Export Data</TALLYREQUEST>\n</HEADER>\n<BODY>\n<EXPORTDATA>\n<REQUESTDESC>\n<REPORTNAME>All Masters</REPORTNAME>\n</REQUESTDESC>\n<REQUESTDATA>\n`;

    if (modules.includes('ledgers')) {
      const customers = await Customer.find({ user: userId });
      const suppliers = await Supplier.find({ user: userId });
      customers.forEach(c => {
        xml += `<TALLYMESSAGE xmlns:UDF="TallyUDF"><LEDGER NAME="${c.name}" ACTION="Create"><NAME>${c.name}</NAME><LEDGERNAME>Sundry Debtors</LEDGERNAME><OPENINGBALANCE>${c.openingBalance || 0}</OPENINGBALANCE></LEDGER></TALLYMESSAGE>\n`;
      });
      suppliers.forEach(s => {
        xml += `<TALLYMESSAGE xmlns:UDF="TallyUDF"><LEDGER NAME="${s.name}" ACTION="Create"><NAME>${s.name}</NAME><LEDGERNAME>Sundry Creditors</LEDGERNAME><OPENINGBALANCE>${s.openingBalance || 0}</OPENINGBALANCE></LEDGER></TALLYMESSAGE>\n`;
      });
    }

    if (modules.includes('vouchers')) {
      const saleFilter = { user: userId, type: 'invoice' };
      if (dateFilter.$gte || dateFilter.$lte) saleFilter.date = dateFilter;
      const sales = await Sale.find(saleFilter).populate('customer');
      sales.forEach(s => {
        xml += `<TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER ACTION="Create"><VOUCHERTYPENAME>Sales</VOUCHERTYPENAME><DATE>${s.date.toISOString().split('T')[0]}</DATE><PARTYLEDGERNAME>${s.customerName || s.customer?.name || 'Walk-in'}</PARTYLEDGERNAME><AMOUNT>${s.totalAmount}</AMOUNT></VOUCHER></TALLYMESSAGE>\n`;
      });

      const purchaseFilter = { user: userId };
      if (dateFilter.$gte || dateFilter.$lte) purchaseFilter.date = dateFilter;
      const purchases = await Purchase.find(purchaseFilter);
      purchases.forEach(p => {
        xml += `<TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER ACTION="Create"><VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME><DATE>${p.date.toISOString().split('T')[0]}</DATE><PARTYLEDGERNAME>${p.supplierName || 'Supplier'}</PARTYLEDGERNAME><AMOUNT>${p.totalAmount}</AMOUNT></VOUCHER></TALLYMESSAGE>\n`;
      });
    }

    if (modules.includes('stock')) {
      const products = await Product.find({ user: userId });
      products.forEach(p => {
        xml += `<TALLYMESSAGE xmlns:UDF="TallyUDF"><STOCKITEM ACTION="Create"><NAME>${p.name}</NAME><OPENINGBALANCE>${p.stock || 0} ${p.unit || 'Pcs'}</OPENINGBALANCE><RATE>${p.costPrice || p.price || 0}</RATE></STOCKITEM></TALLYMESSAGE>\n`;
      });
    }

    xml += `</REQUESTDATA>\n</EXPORTDATA>\n</BODY>\n</ENVELOPE>`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename=tally_export_${new Date().toISOString().split('T')[0]}.xml`);
    res.send(xml);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Import from Tally
router.post('/import-tally', async (req, res) => {
  try {
    const userId = req.user.id;
    const { data, type } = req.body;
    let imported = { ledgers: 0, vouchers: 0, stockItems: 0 };

    if (data && Array.isArray(data)) {
      for (const item of data) {
        if (item.type === 'ledger') {
          if (item.partyType === 'customer') {
            await Customer.create({ user: userId, name: item.name, phone: item.phone, openingBalance: item.openingBalance || 0 });
            imported.ledgers++;
          } else {
            await Supplier.create({ user: userId, name: item.name, phone: item.phone, openingBalance: item.openingBalance || 0 });
            imported.ledgers++;
          }
        } else if (item.type === 'stock') {
          await Product.create({ user: userId, name: item.name, stock: item.quantity || 0, price: item.rate || 0, costPrice: item.rate || 0 });
          imported.stockItems++;
        }
      }
    }

    res.json({ message: 'Tally data imported successfully', imported });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Accountant access - list users
router.get('/accountant-access', async (req, res) => {
  try {
    const userId = req.user.id;
    const setting = await Setting.findOne({ user: userId });
    const sharedWith = setting?.sharedWith || [];
    const users = await User.find({ _id: { $in: sharedWith } }).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Invite accountant
router.post('/accountant-access/invite', async (req, res) => {
  try {
    const { email, name, role } = req.body;
    const userId = req.user.id;

    let invitee = await User.findOne({ email });
    if (!invitee) {
      const crypto = require('crypto');
      const tempPassword = crypto.randomBytes(12).toString('base64url');
      invitee = await User.create({ name, email, password: tempPassword, role: 'user', isPendingPasswordReset: true });
    }

    const setting = await Setting.findOne({ user: userId });
    if (setting) {
      if (!setting.sharedWith) setting.sharedWith = [];
      if (!setting.sharedWith.includes(invitee._id)) {
        setting.sharedWith.push(invitee._id);
        await setting.save();
      }
    }

    res.json({ message: 'Invitation sent successfully', user: { _id: invitee._id, name: invitee.name, email: invitee.email, role } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Remove accountant access
router.delete('/accountant-access/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const setting = await Setting.findOne({ user: userId });
    if (setting && setting.sharedWith) {
      setting.sharedWith = setting.sharedWith.filter(id => id.toString() !== req.params.id);
      await setting.save();
    }
    res.json({ message: 'Access removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Track salesmen - aggregate sales by salesman field on customers
router.get('/track-salesmen', async (req, res) => {
  try {
    const userId = req.user.id;
    const customers = await Customer.find({ user: userId });
    const sales = await Sale.find({ user: userId, type: 'invoice' });

    const salesmanMap = {};

    // Group customers by salesman
    customers.forEach(c => {
      const name = c.salesman || 'Unassigned';
      if (!salesmanMap[name]) {
        salesmanMap[name] = { name, totalSales: 0, totalAmount: 0, customers: 0, lastActive: null, saleIds: [] };
      }
      salesmanMap[name].customers += 1;
    });

    // Aggregate sales by customer's salesman
    sales.forEach(s => {
      const customer = customers.find(c => c._id.toString() === (s.customer?.toString() || ''));
      const name = customer?.salesman || 'Unassigned';
      if (!salesmanMap[name]) {
        salesmanMap[name] = { name, totalSales: 0, totalAmount: 0, customers: 0, lastActive: null, saleIds: [] };
      }
      salesmanMap[name].totalSales += 1;
      salesmanMap[name].totalAmount += s.totalAmount || 0;
      salesmanMap[name].saleIds.push(s._id);
      if (!salesmanMap[name].lastActive || s.date > salesmanMap[name].lastActive) {
        salesmanMap[name].lastActive = s.date;
      }
    });

    const result = Object.values(salesmanMap).map(s => {
      const { saleIds, ...rest } = s;
      return rest;
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Bulk update items
router.post('/bulk-update-items', async (req, res) => {
  try {
    const { updates } = req.body;
    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({ message: 'Updates array is required' });
    }
    const results = [];
    const allowedFields = ['name', 'price', 'costPrice', 'stock', 'minStock', 'hsnCode', 'unit', 'description', 'category', 'images'];
    for (const update of updates) {
      const { id, ...rawData } = update;
      const data = {};
      for (const field of allowedFields) {
        if (rawData[field] !== undefined) data[field] = rawData[field];
      }
      if (Object.keys(data).length === 0) continue;
      const product = await Product.findOneAndUpdate({ _id: id, user: req.user.id }, data, { new: true });
      if (product) results.push(product);
    }
    res.json({ message: `${results.length} items updated successfully`, updated: results });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
