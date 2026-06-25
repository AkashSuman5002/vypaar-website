const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authorize } = require('../middleware/authorize');
const { withTransaction } = require('../utils/withTransaction');
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
const Staff = require('../models/Staff');
const StockMovement = require('../models/StockMovement');
const Receipt = require('../models/Receipt');
const Business = require('../models/Business');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// Verify data integrity across all modules
router.get('/verify', authorize('settings:view'), async (req, res) => {
  try {
    const userId = req.user.id;
    const results = {};

    // Customers
    const customerCount = await Customer.countDocuments({ user: userId });
    const customersWithIssues = await Customer.countDocuments({ user: userId, name: { $in: [null, ''] } });
    const invalidGstCustomers = await Customer.countDocuments({ user: userId, gstNumber: { $exists: true, $ne: '', $not: GST_REGEX } });
    const duplicateCustomers = await Customer.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: { name: { $toLower: '$name' }, phone: '$phone' }, count: { $sum: 1 }, ids: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } },
    ]);
    const customerIssues = [];
    if (customersWithIssues > 0) customerIssues.push(`${customersWithIssues} customers missing name`);
    if (invalidGstCustomers > 0) customerIssues.push(`${invalidGstCustomers} customers with invalid GSTIN format`);
    if (duplicateCustomers.length > 0) customerIssues.push(`${duplicateCustomers.length} duplicate customer group(s) (same name+phone)`);
    results.customers = { count: customerCount, status: customerIssues.length > 0 ? 'warning' : 'pass', issues: customerIssues };

    // Products
    const productCount = await Product.countDocuments({ user: userId });
    const productsWithZeroPrice = await Product.countDocuments({ user: userId, price: { $lte: 0 } });
    const productsWithNegativeStock = await Product.countDocuments({ user: userId, stock: { $lt: 0 } });
    const duplicateProducts = await Product.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: { $toLower: '$name' }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]);
    const prodIssues = [];
    if (productsWithZeroPrice > 0) prodIssues.push(`${productsWithZeroPrice} items with zero price`);
    if (productsWithNegativeStock > 0) prodIssues.push(`${productsWithNegativeStock} items with negative stock`);
    if (duplicateProducts.length > 0) prodIssues.push(`${duplicateProducts.length} duplicate item name(s)`);
    results.products = { count: productCount, status: prodIssues.length > 0 ? 'warning' : 'pass', issues: prodIssues };

    // Sales
    const saleCount = await Sale.countDocuments({ user: userId });
    const unpaidSales = await Sale.countDocuments({ user: userId, paymentStatus: { $ne: 'paid' }, type: 'invoice' });
    const salesWithMissingCustomer = await Sale.countDocuments({ user: userId, customer: { $exists: true, $ne: null } });
    const totalCustomersReferenced = await Sale.distinct('customer', { user: userId });
    const brokenSaleRefs = salesWithMissingCustomer > 0 ? Math.max(0, salesWithMissingCustomer - totalCustomersReferenced.length) : 0;
    const saleIssues = [];
    if (unpaidSales > 0) saleIssues.push(`${unpaidSales} unpaid invoices`);
    if (brokenSaleRefs > 0) saleIssues.push(`${brokenSaleRefs} sales with broken customer references`);
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
    const lowStockProducts = await Product.countDocuments({ user: userId, type: { $ne: 'service' }, $expr: { $lte: ['$stock', '$minStock'] }, minStock: { $gt: 0 } });
    const negativeStockProducts = await Product.countDocuments({ user: userId, stock: { $lt: 0 } });
    const stockIssues = [];
    if (stockMovements === 0 && productCount > 0) stockIssues.push('No stock movement history');
    if (lowStockProducts > 0) stockIssues.push(`${lowStockProducts} products low on stock`);
    if (negativeStockProducts > 0) stockIssues.push(`${negativeStockProducts} products with negative stock`);
    results.stock = { count: stockMovements, status: stockIssues.length > 0 ? 'warning' : 'pass', issues: stockIssues };

    // Transactions
    const transactionCount = await Transaction.countDocuments({ user: userId });
    const unbalancedTransactions = await Transaction.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: '$date', totalIn: { $sum: { $cond: [{ $eq: ['$type', 'cash_in'] }, '$amount', 0] } }, totalOut: { $sum: { $cond: [{ $eq: ['$type', 'cash_out'] }, '$amount', 0] } } } },
      { $match: { $expr: { $ne: ['$totalIn', '$totalOut'] } } },
      { $limit: 5 },
    ]);
    const transactionIssues = [];
    if (unbalancedTransactions.length > 0) transactionIssues.push(`${unbalancedTransactions.length} date(s) with unbalanced cash in/out`);
    results.transactions = { count: transactionCount, status: transactionIssues.length > 0 ? 'warning' : 'pass', issues: transactionIssues };

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Financial year status
router.get('/financial-year-status', authorize('settings:view'), async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
    const fyEndYear = fyStartYear + 1;

    const firstEntry = await JournalEntry.findOne({ user: userId }).sort({ entryDate: 1 });
    const lastEntry = await JournalEntry.findOne({ user: userId }).sort({ entryDate: -1 });

    const setting = await Setting.findOne({ user: userId });
    const lock = setting?.financialYearLock || {};
    const isLocked = !!(lock.isLocked && lock.lockedUntil);

    res.json({
      currentFY: `${fyStartYear}-${String(fyEndYear).slice(-2)}`,
      nextFY: `${fyEndYear}-${String(fyEndYear + 1).slice(-2)}`,
      isOpen: !isLocked,
      isLocked,
      lockedUntil: lock.lockedUntil || null,
      closedFY: lock.closedFY || null,
      closedAt: lock.closedAt || null,
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
router.post('/close-financial-year', authorize('accounting:manage'), async (req, res) => {
  try {
    const { confirmation } = req.body;
    if (confirmation !== 'CLOSE') {
      return res.status(400).json({ message: 'Please type CLOSE to confirm' });
    }
    const userId = req.user.id;

    const result = await withTransaction(async (session) => {
      // Get P&L summary
      const journals = await JournalEntry.find({ user: userId, isPosted: true }).session(session);
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
      let retainedEarnings = await Account.findOne({ user: userId, category: 'retained_earnings' }).session(session);
      if (!retainedEarnings) {
        const [created] = await Account.create([{ user: userId, name: 'Retained Earnings', code: '3002', type: 'equity', category: 'retained_earnings', balance: 0 }], { session });
        retainedEarnings = created;
      }
      let incomeSummary = await Account.findOne({ user: userId, category: 'sales' }).session(session);
      let expenseSummary = await Account.findOne({ user: userId, category: 'direct_expense' }).session(session);

      // Create closing journal entry
      const entryNumber = `FY-${Date.now()}`;
      const closingEntry = await JournalEntry.create([{
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
      }], { session });

      // Update retained earnings balance
      retainedEarnings.balance += netProfit;
      await retainedEarnings.save({ session });

      // Persist a real financial-year lock so transactions dated within the closed
      // period are blocked going forward. The closed period ends on the FY end
      // (March 31 of the current financial year).
      const now = new Date();
      const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      const fyEndYear = fyStartYear + 1;
      const lockedUntil = new Date(Date.UTC(fyEndYear, 2, 31, 23, 59, 59)); // March 31, end of day
      const closedFY = `${fyStartYear}-${String(fyEndYear).slice(-2)}`;

      let setting = await Setting.findOne({ user: userId }).session(session);
      if (!setting) {
        const [created] = await Setting.create([{ user: userId }], { session });
        setting = created;
      }
      setting.financialYearLock = {
        isLocked: true,
        lockedUntil,
        closedFY,
        closedAt: new Date(),
      };
      await setting.save({ session });

      // Create opening balance entries for new FY (carry-forward)
      const allAccounts = await Account.find({ user: userId, isActive: true, balance: { $ne: 0 } }).session(session);
      const openingEntries = [];
      for (const acct of allAccounts) {
        if (acct.balance !== 0) {
          openingEntries.push({
            account: acct._id,
            accountName: acct.name,
            accountType: acct.type,
            debit: acct.balance > 0 ? acct.balance : 0,
            credit: acct.balance < 0 ? Math.abs(acct.balance) : 0,
          });
        }
      }
      if (openingEntries.length > 0) {
        const openingTotalDebit = openingEntries.reduce((s, e) => s + e.debit, 0);
        const openingTotalCredit = openingEntries.reduce((s, e) => s + e.credit, 0);
        await JournalEntry.create([{
          user: userId,
          entryNumber: `FY-OPEN-${Date.now()}`,
          entryDate: new Date(Date.UTC(fyEndYear, 3, 1)),
          referenceType: 'journal',
          narration: `Opening balances carried forward to ${fyEndYear}-${String(fyEndYear + 1).slice(-2)}`,
          description: 'Auto-generated opening balance entry for new financial year',
          lines: openingEntries,
          totalDebit: openingTotalDebit,
          totalCredit: openingTotalCredit,
        }], { session });
      }

      return {
        closingEntry: closingEntry[0].entryNumber,
        netProfit,
        totalIncome,
        totalExpense,
        lockedUntil,
        closedFY,
      };
    });

    res.json({
      message: 'Financial year closed successfully',
      ...result,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Export to Tally - generate XML from real data
router.post('/export-tally', authorize('reports:export'), async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { modules, dateFrom, dateTo } = req.body;
    const selected = Array.isArray(modules) ? modules : [];
    if (selected.length === 0) {
      return res.status(400).json({ message: 'Select at least one module to export' });
    }
    const dateFilter = {};
    if (dateFrom) dateFilter.$gte = new Date(dateFrom);
    if (dateTo) dateFilter.$lte = new Date(dateTo);

    // XML escaping for attribute/text values so names with &, <, > do not corrupt the file.
    const esc = (v) => String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    const fmtDate = (d) => {
      const dt = d ? new Date(d) : null;
      return dt && !isNaN(dt.getTime()) ? dt.toISOString().split('T')[0] : '';
    };

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<ENVELOPE>\n<HEADER>\n<VERSION>1</VERSION>\n<TALLYREQUEST>Export Data</TALLYREQUEST>\n</HEADER>\n<BODY>\n<EXPORTDATA>\n<REQUESTDESC>\n<REPORTNAME>All Masters</REPORTNAME>\n</REQUESTDESC>\n<REQUESTDATA>\n`;

    if (selected.includes('groups')) {
      // Standard Tally account groups so ledgers below have valid parents.
      ['Sundry Debtors', 'Sundry Creditors', 'Sales Accounts', 'Purchase Accounts'].forEach(g => {
        xml += `<TALLYMESSAGE xmlns:UDF="TallyUDF"><GROUP NAME="${esc(g)}" ACTION="Create"><NAME>${esc(g)}</NAME></GROUP></TALLYMESSAGE>\n`;
      });
    }

    if (selected.includes('ledgers')) {
      const customers = await Customer.find({ ...baseFilter });
      const suppliers = await Supplier.find({ ...baseFilter });
      customers.forEach(c => {
        xml += `<TALLYMESSAGE xmlns:UDF="TallyUDF"><LEDGER NAME="${esc(c.name)}" ACTION="Create"><NAME>${esc(c.name)}</NAME><PARENT>Sundry Debtors</PARENT><OPENINGBALANCE>${c.openingBalance || 0}</OPENINGBALANCE></LEDGER></TALLYMESSAGE>\n`;
      });
      suppliers.forEach(s => {
        xml += `<TALLYMESSAGE xmlns:UDF="TallyUDF"><LEDGER NAME="${esc(s.name)}" ACTION="Create"><NAME>${esc(s.name)}</NAME><PARENT>Sundry Creditors</PARENT><OPENINGBALANCE>${s.openingBalance || 0}</OPENINGBALANCE></LEDGER></TALLYMESSAGE>\n`;
      });
    }

    if (selected.includes('vouchers')) {
      const saleFilter = { ...baseFilter, type: 'invoice' };
      if (dateFilter.$gte || dateFilter.$lte) saleFilter.date = dateFilter;
      const sales = await Sale.find(saleFilter).populate('customer');
      sales.forEach(s => {
        xml += `<TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER ACTION="Create"><VOUCHERTYPENAME>Sales</VOUCHERTYPENAME><DATE>${fmtDate(s.date)}</DATE><PARTYLEDGERNAME>${esc(s.customerName || s.customer?.name || 'Walk-in')}</PARTYLEDGERNAME><AMOUNT>${s.totalAmount || 0}</AMOUNT></VOUCHER></TALLYMESSAGE>\n`;
      });

      const purchaseFilter = { ...baseFilter };
      if (dateFilter.$gte || dateFilter.$lte) purchaseFilter.date = dateFilter;
      const purchases = await Purchase.find(purchaseFilter);
      purchases.forEach(p => {
        xml += `<TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER ACTION="Create"><VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME><DATE>${fmtDate(p.date)}</DATE><PARTYLEDGERNAME>${esc(p.supplierName || 'Supplier')}</PARTYLEDGERNAME><AMOUNT>${p.totalAmount || 0}</AMOUNT></VOUCHER></TALLYMESSAGE>\n`;
      });
    }

    if (selected.includes('stock')) {
      const products = await Product.find({ ...baseFilter });
      products.forEach(p => {
        xml += `<TALLYMESSAGE xmlns:UDF="TallyUDF"><STOCKITEM ACTION="Create"><NAME>${esc(p.name)}</NAME><OPENINGBALANCE>${p.stock || 0} ${esc(p.unit || 'Pcs')}</OPENINGBALANCE><RATE>${p.costPrice || p.price || 0}</RATE></STOCKITEM></TALLYMESSAGE>\n`;
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
router.post('/import-tally', authorize('settings:manage'), async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { data, source } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ message: 'No records to import. Upload and parse a valid Tally XML / parties CSV first.' });
    }

    // Validate each record before processing
    const validTypes = ['ledger', 'stock', 'voucher'];
    const validPartyTypes = ['customer', 'supplier', ''];
    const validationErrors = [];
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      if (!item || typeof item !== 'object') {
        validationErrors.push(`Row ${i + 1}: must be an object`);
        continue;
      }
      const name = (item.name || '').trim();
      if (!name) {
        validationErrors.push(`Row ${i + 1}: missing required field "name"`);
      }
      if (item.type && !validTypes.includes(item.type)) {
        validationErrors.push(`Row ${i + 1}: invalid type "${item.type}" (expected: ${validTypes.join(', ')})`);
      }
      if (item.partyType && !validPartyTypes.includes(item.partyType)) {
        validationErrors.push(`Row ${i + 1}: invalid partyType "${item.partyType}" (expected: customer, supplier, or empty)`);
      }
      if (item.openingBalance !== undefined && isNaN(Number(item.openingBalance))) {
        validationErrors.push(`Row ${i + 1}: openingBalance must be a number`);
      }
      if (item.rate !== undefined && isNaN(Number(item.rate))) {
        validationErrors.push(`Row ${i + 1}: rate must be a number`);
      }
      if (item.quantity !== undefined && isNaN(Number(item.quantity))) {
        validationErrors.push(`Row ${i + 1}: quantity must be a number`);
      }
    }
    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: `Validation failed for ${validationErrors.length} record(s)`,
        errors: validationErrors.slice(0, 20),
        totalErrors: validationErrors.length,
      });
    }

    const imported = { ledgers: 0, customers: 0, suppliers: 0, stockItems: 0 };
    const skipped = [];
    const errors = [];

    for (const item of data) {
      try {
        const name = (item.name || '').trim();
        if (!name) { skipped.push('Row missing name'); continue; }

        if (item.type === 'ledger') {
          const isSupplier = item.partyType === 'supplier';
          const Model = isSupplier ? Supplier : Customer;
          // Skip duplicates by name within the same scope.
          const exists = await Model.findOne({ ...baseFilter, name });
          if (exists) { skipped.push(`${name} (already exists)`); continue; }
          await Model.create(getCreateData(req, {
            name,
            phone: item.phone || '',
            type: isSupplier ? 'supplier' : 'customer',
            openingBalance: Number(item.openingBalance) || 0,
            isActive: true,
          }));
          imported.ledgers++;
          if (isSupplier) imported.suppliers++; else imported.customers++;
        } else if (item.type === 'stock') {
          const exists = await Product.findOne({ ...baseFilter, name });
          if (exists) { skipped.push(`${name} (already exists)`); continue; }
          const rate = Number(item.rate) || 0;
          await Product.create(getCreateData(req, {
            name,
            stock: Number(item.quantity) || 0,
            price: rate,
            costPrice: rate,
            isActive: true,
          }));
          imported.stockItems++;
        } else {
          skipped.push(`${name} (unknown type)`);
        }
      } catch (e) {
        errors.push(`${item.name || 'record'}: ${e.message}`);
      }
    }

    const totalImported = imported.ledgers + imported.stockItems;
    res.json({
      message: totalImported > 0
        ? `Imported ${totalImported} record(s) successfully`
        : 'No new records imported (all duplicates or invalid)',
      imported,
      skipped: skipped.slice(0, 50),
      skippedCount: skipped.length,
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Accountant access - list users
router.get('/accountant-access', authorize('settings:view'), async (req, res) => {
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

// Sync / connect accountant access — a REAL authenticated backend call.
// Confirms the logged-in user's identity + active business and returns the
// current shared-access state so the client can reflect a genuine connected
// status (no fake client-only "logged in" flag).
router.post('/accountant-access/sync', authorize('settings:view'), async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('-password');
    if (!user) return res.status(401).json({ message: 'Not authenticated' });

    let setting = await Setting.findOne({ user: userId });
    if (!setting) setting = await Setting.create({ user: userId });

    const business = await Business.findOne({ owner: userId }).sort({ updatedAt: -1 });
    const sharedWith = setting.sharedWith || [];
    const sharedCount = sharedWith.length;

    res.json({
      connected: true,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role },
      company: {
        name: business?.name || setting.businessName || user.name,
        phone: business?.phone || setting.phone || user.phone || '',
      },
      sharedCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Invite accountant
router.post('/accountant-access/invite', authorize('settings:manage'), async (req, res) => {
  try {
    const { email, name, role } = req.body;
    const userId = req.user.id;

    // Validate email format
    if (!email || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim())) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }

    let invitee = await User.findOne({ email: email.toLowerCase().trim() });
    if (!invitee) {
      const crypto = require('crypto');
      const tempPassword = crypto.randomBytes(12).toString('base64url');
      invitee = await User.create({ name: name.trim(), email: email.toLowerCase().trim(), password: tempPassword, role: role || 'user', isPendingPasswordReset: true });
    } else {
      // Update role if user already exists
      if (role && invitee.role !== role) {
        invitee.role = role;
        await invitee.save();
      }
    }

    const setting = await Setting.findOne({ user: userId });
    if (setting) {
      if (!setting.sharedWith) setting.sharedWith = [];
      if (!setting.sharedWith.includes(invitee._id)) {
        setting.sharedWith.push(invitee._id);
        await setting.save();
      }
    }

    res.json({ message: 'Invitation sent successfully', user: { _id: invitee._id, name: invitee.name, email: invitee.email, role: invitee.role } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Remove accountant access
router.delete('/accountant-access/:id', authorize('settings:manage'), async (req, res) => {
  try {
    const userId = req.user.id;
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
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
router.get('/track-salesmen', authorize('reports:view'), async (req, res) => {
  try {
    const userId = req.user.id;
    const baseFilter = getBaseFilter(req);

    // Get staff with salesman role and commission rates
    const salesmenStaff = await Staff.find({ ...baseFilter, role: 'salesman', isActive: true }).lean();
    const commissionMap = {};
    salesmenStaff.forEach(s => { commissionMap[s.name] = s.commissionRate || 0; });

    // Use MongoDB aggregation pipeline for efficient salesman tracking
    const salesAggregation = await Sale.aggregate([
      { $match: { ...baseFilter, type: 'invoice' } },
      {
        $lookup: {
          from: 'customers',
          localField: 'customer',
          foreignField: '_id',
          as: 'customerDoc',
        },
      },
      { $unwind: { path: '$customerDoc', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $toLower: { $ifNull: ['$customerDoc.salesman', 'Unassigned'] } },
          displayName: { $first: { $ifNull: ['$customerDoc.salesman', 'Unassigned'] } },
          totalSales: { $sum: 1 },
          totalAmount: { $sum: { $ifNull: ['$totalAmount', 0] } },
          totalPaid: { $sum: { $ifNull: ['$paidAmount', 0] } },
          lastActive: { $max: '$date' },
          saleIds: { $push: '$_id' },
        },
      },
      {
        $addFields: {
          pendingAmount: { $subtract: ['$totalAmount', '$totalPaid'] },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    // Get customer counts per salesman
    const customerCounts = await Customer.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: { $toLower: { $ifNull: ['$salesman', 'Unassigned'] } },
          count: { $sum: 1 },
        },
      },
    ]);
    const customerCountMap = {};
    customerCounts.forEach(c => { customerCountMap[c._id] = c.count; });

    const result = salesAggregation.map(s => ({
      name: s.displayName,
      totalSales: s.totalSales,
      totalAmount: s.totalAmount,
      totalPaid: s.totalPaid,
      pendingAmount: s.pendingAmount,
      customers: customerCountMap[s._id] || 0,
      lastActive: s.lastActive,
      commissionRate: commissionMap[s.displayName] || 0,
      commissionEarned: Math.round((s.totalAmount * (commissionMap[s.displayName] || 0)) / 100),
    }));

    // Add salesmen with customers but no sales
    for (const staff of salesmenStaff) {
      if (!result.find(r => r.name === staff.name)) {
        result.push({
          name: staff.name,
          totalSales: 0,
          totalAmount: 0,
          totalPaid: 0,
          pendingAmount: 0,
          customers: customerCountMap[staff.name.toLowerCase()] || 0,
          lastActive: null,
          commissionRate: staff.commissionRate || 0,
          commissionEarned: 0,
        });
      }
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Bulk update items
router.post('/bulk-update-items', authorize('products:manage'), async (req, res) => {
  try {
    const { updates } = req.body;
    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({ message: 'Updates array is required' });
    }
    const results = [];
    const allowedFields = ['name', 'price', 'costPrice', 'stock', 'minStock', 'hsnCode', 'unit', 'description', 'category', 'images', 'salePrice', 'purchasePrice', 'saleTaxType', 'purchaseTaxType', 'discount', 'discountType', 'taxRate'];
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
