const Account = require('../models/Account');
const JournalEntry = require('../models/JournalEntry');
const Receipt = require('../models/Receipt');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');

// Seed default chart of accounts for a new user+business (runs once per user+business)
const seedAccounts = async (userId, businessId) => {
  try {
    const filter = { user: userId, code: '1000' };
    if (businessId) filter.business = businessId;
    const hasHierarchy = await Account.findOne(filter);
    if (hasHierarchy) return;

    const upsert = async (acc) => {
      const update = { ...acc, user: userId, isDefault: true };
      if (businessId) update.business = businessId;
      return Account.findOneAndUpdate(
        { user: userId, ...(businessId ? { business: businessId } : {}), code: acc.code },
        { $set: update },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    };

    // Level 1: Top-level groups
    const fixedAssets = await upsert({ name: 'Fixed Assets', code: '1300', type: 'asset', category: 'fixed_asset' });
    const currentAssets = await upsert({ name: 'Current Assets', code: '1000', type: 'asset', category: 'current_asset' });

    const capitalAccount = await upsert({ name: 'Capital Account', code: '3000', type: 'equity', category: 'capital' });
    const currentLiab = await upsert({ name: 'Current Liabilities', code: '2000', type: 'liability', category: 'current_liability' });

    const saleAccounts = await upsert({ name: 'Sale Accounts', code: '4000', type: 'income', category: 'sales' });
    const purchaseAccounts = await upsert({ name: 'Purchase Accounts', code: '5000', type: 'expense', category: 'purchase' });
    const directExpenses = await upsert({ name: 'Direct Expenses', code: '5100', type: 'expense', category: 'direct_expense' });
    const indirectExpenses = await upsert({ name: 'Indirect Expenses', code: '5200', type: 'expense', category: 'indirect_expense' });

    // Level 2: Sub-groups
    const sundryDebtors = await upsert({ name: 'Sundry Debtors', code: '1100', type: 'asset', category: 'receivable', parent: currentAssets._id });
    await upsert({ name: 'Accounts Receivable', code: '1101', type: 'asset', category: 'receivable', parent: sundryDebtors._id });
    const inputDuties = await upsert({ name: 'Input Duties & Taxes', code: '1150', type: 'asset', category: 'input_duties', parent: currentAssets._id });
    await upsert({ name: 'Bank Accounts', code: '1020', type: 'asset', category: 'bank', parent: currentAssets._id });
    const cashAccounts = await upsert({ name: 'Cash Accounts', code: '1010', type: 'asset', category: 'cash', parent: currentAssets._id });

    const reservesSurplus = await upsert({ name: 'Reserves & Surplus', code: '3002', type: 'equity', category: 'retained_earnings', parent: capitalAccount._id });
    await upsert({ name: "Owner's Equity", code: '3001', type: 'equity', category: 'capital', parent: capitalAccount._id });

    await upsert({ name: 'Sundry Creditors', code: '2001', type: 'liability', category: 'payable', parent: currentLiab._id });
    const outwardDuties = await upsert({ name: 'Outward Duties & Taxes', code: '2100', type: 'liability', category: 'output_duties', parent: currentLiab._id });

    await upsert({ name: 'Purchase', code: '5002', type: 'expense', category: 'purchase', parent: purchaseAccounts._id });
    await upsert({ name: 'Payment-in Discount', code: '5101', type: 'expense', category: 'direct_expense', parent: directExpenses._id });
    await upsert({ name: 'Manufacturing Expense', code: '5102', type: 'expense', category: 'direct_expense', parent: directExpenses._id });
    await upsert({ name: 'Petrol', code: '5103', type: 'expense', category: 'direct_expense', parent: directExpenses._id });

    await upsert({ name: 'Rent', code: '5206', type: 'expense', category: 'indirect_expense', parent: indirectExpenses._id });
    await upsert({ name: 'Salary', code: '5207', type: 'expense', category: 'indirect_expense', parent: indirectExpenses._id });
    await upsert({ name: 'Transport', code: '5209', type: 'expense', category: 'indirect_expense', parent: indirectExpenses._id });

    await upsert({ name: 'Sale (Revenue) Account', code: '4001', type: 'income', category: 'sales', parent: saleAccounts._id });
    await upsert({ name: 'Additional Charges on Sale', code: '4002', type: 'income', category: 'sales', parent: saleAccounts._id });

    // Level 3
    await upsert({ name: 'Retained Earnings', code: '3006', type: 'equity', category: 'retained_earnings', parent: reservesSurplus._id });
    const inputGST = await upsert({ name: 'Input GST', code: '1160', type: 'asset', category: 'gst_collectible', parent: inputDuties._id });
    await upsert({ name: 'Input GST [Default]', code: '1161', type: 'asset', category: 'gst_collectible', parent: inputGST._id });
    await upsert({ name: 'Input CGST', code: '1162', type: 'asset', category: 'gst_collectible', parent: inputGST._id });
    await upsert({ name: 'Input SGST', code: '1163', type: 'asset', category: 'gst_collectible', parent: inputGST._id });
    await upsert({ name: 'Input IGST', code: '1164', type: 'asset', category: 'gst_collectible', parent: inputGST._id });

    const outputGST = await upsert({ name: 'Output GST', code: '2110', type: 'liability', category: 'gst_payable', parent: outwardDuties._id });
    await upsert({ name: 'Output GST [Default]', code: '2111', type: 'liability', category: 'gst_payable', parent: outputGST._id });
    await upsert({ name: 'Output CGST', code: '2112', type: 'liability', category: 'gst_payable', parent: outputGST._id });
    await upsert({ name: 'Output SGST', code: '2113', type: 'liability', category: 'gst_payable', parent: outputGST._id });

    await upsert({ name: 'Cash', code: '1001', type: 'asset', category: 'cash', parent: cashAccounts._id });
  } catch (err) {
    console.error('seedAccounts error:', err.message);
  }
};

const getAccounts = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const userId = req.user._id;
    const businessId = req.businessId || null;

    // Only seed on first request if no accounts exist (not every request)
    const accountCount = await Account.countDocuments({ ...baseFilter, isActive: true });
    if (accountCount === 0) {
      await seedAccounts(userId, businessId);
    }

    let accounts = await Account.find({ ...baseFilter, isActive: true }).sort({ code: 1 });
    // Query ALL journal entries for this user (ignore business filter) to compute balances correctly
    // JournalEntries may have been created with different business context
    const entries = await JournalEntry.find({ ...baseFilter, isPosted: true });
    const accountsWithBalance = [];
    for (const acc of accounts) {
      let totalDebit = 0;
      let totalCredit = 0;
      entries.forEach((je) => {
        je.lines.forEach((line) => {
          if (line.account.toString() === acc._id.toString()) {
            totalDebit += line.debit;
            totalCredit += line.credit;
          }
        });
      });
      const balance = ['asset', 'expense'].includes(acc.type)
        ? totalDebit - totalCredit
        : totalCredit - totalDebit;
      if (Math.abs(acc.balance - balance) > 0.01) {
        await Account.findByIdAndUpdate(acc._id, { balance });
      }
      accountsWithBalance.push({ ...acc.toObject(), balance });
    }
    res.json(accountsWithBalance);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const postJournalEntry = async (userId, entry, businessId) => {
  const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Debit (${totalDebit}) != Credit (${totalCredit})`);
  }

  const je = await JournalEntry.create({
    user: userId,
    business: businessId,
    entryNumber: entry.entryNumber,
    entryDate: entry.entryDate,
    narration: entry.narration || entry.description || '',
    description: entry.narration || entry.description || '',
    referenceType: entry.referenceType || 'journal',
    referenceId: entry.referenceId,
    referenceNumber: entry.referenceNumber,
    lines: entry.lines.map(l => ({
      account: l.account,
      accountName: l.accountName || '',
      accountType: l.accountType || '',
      particular: l.particular || '',
      debit: l.debit || 0,
      credit: l.credit || 0,
    })),
    totalDebit,
    totalCredit,
    isPosted: true,
    postedAt: new Date(),
  });

  for (const line of entry.lines) {
    const account = await Account.findById(line.account);
    if (!account) continue;
    let balanceChange = 0;
    if (['asset', 'expense'].includes(account.type)) {
      balanceChange = line.debit - line.credit;
    } else {
      balanceChange = line.credit - line.debit;
    }
    await Account.findByIdAndUpdate(line.account, { $inc: { balance: balanceChange } });
  }

  return je;
};

const getJournalEntries = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate, referenceType, page = 1, limit = 50 } = req.query;
    const filter = { ...baseFilter };
    if (startDate && endDate) {
      filter.entryDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (referenceType) filter.referenceType = referenceType;

    const entries = await JournalEntry.find(filter)
      .sort({ entryDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('lines.account', 'name code type');

    const total = await JournalEntry.countDocuments(filter);
    res.json({
      entries: entries.map(e => ({
        ...e.toObject(),
        narration: e.narration || e.description || '',
      })),
      total, page: parseInt(page), pages: Math.ceil(total / limit)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getTrialBalance = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    let { startDate, endDate } = req.query;
    const filter = { ...baseFilter, isPosted: true };
    if (startDate && endDate) {
      filter.entryDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const accounts = await Account.find({ ...baseFilter, isActive: true }).sort({ code: 1 });
    const entries = await JournalEntry.find(filter);

    const result = accounts.map((acc) => {
      let totalDebit = 0;
      let totalCredit = 0;
      entries.forEach((je) => {
        je.lines.forEach((line) => {
          if (line.account.toString() === acc._id.toString()) {
            totalDebit += line.debit;
            totalCredit += line.credit;
          }
        });
      });
      const balance = ['asset', 'expense'].includes(acc.type)
        ? totalDebit - totalCredit
        : totalCredit - totalDebit;
      return {
        _id: acc._id,
        name: acc.name,
        code: acc.code,
        type: acc.type,
        category: acc.category,
        debit: totalDebit,
        credit: totalCredit,
        balance,
      };
    });

    const totalDebit = result.reduce((s, r) => s + r.debit, 0);
    const totalCredit = result.reduce((s, r) => s + r.credit, 0);

    res.json({ accounts: result, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const calcProfitLoss = async (baseFilter, query) => {
  const filter = { ...baseFilter, isPosted: true };
  const { startDate, endDate } = query || {};
  if (startDate && endDate) {
    filter.entryDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  const [incomeAccounts, expenseAccounts, entries] = await Promise.all([
    Account.find({ ...baseFilter, type: 'income', isActive: true }),
    Account.find({ ...baseFilter, type: 'expense', isActive: true }),
    JournalEntry.find(filter),
  ]);

  const calculateBalance = (acc) => {
    let totalCredit = 0;
    let totalDebit = 0;
    entries.forEach((je) => {
      je.lines.forEach((line) => {
        if (line.account.toString() === acc._id.toString()) {
          totalDebit += line.debit;
          totalCredit += line.credit;
        }
      });
    });
    return totalCredit - totalDebit;
  };

  const income = incomeAccounts.map((a) => ({ name: a.name, amount: calculateBalance(a) }));
  const expense = expenseAccounts.map((a) => ({ name: a.name, amount: calculateBalance(a) }));
  const totalIncome = income.reduce((s, i) => s + i.amount, 0);
  const totalExpense = expense.reduce((s, e) => s + e.amount, 0);
  const netProfit = totalIncome - totalExpense;

  return { income, expense, totalIncome, totalExpense, netProfit };
};

const getProfitLoss = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const result = await calcProfitLoss(baseFilter, req.query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getBalanceSheet = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const filter = { ...baseFilter, isPosted: true };
    const accounts = await Account.find({ ...baseFilter, isActive: true }).sort({ code: 1 });
    const entries = await JournalEntry.find(filter);

    const getBalance = (acc) => {
      let d = 0, c = 0;
      entries.forEach((je) => {
        je.lines.forEach((line) => {
          if (line.account.toString() === acc._id.toString()) {
            d += line.debit; c += line.credit;
          }
        });
      });
      return ['asset', 'expense'].includes(acc.type) ? d - c : c - d;
    };

    const assets = accounts.filter((a) => a.type === 'asset').map((a) => ({ name: a.name, amount: getBalance(a) }));
    const liabilities = accounts.filter((a) => a.type === 'liability').map((a) => ({ name: a.name, amount: getBalance(a) }));
    const equity = accounts.filter((a) => a.type === 'equity').map((a) => ({ name: a.name, amount: getBalance(a) }));
    const pl = await calcProfitLoss(baseFilter, req.query);

    const totalAssets = assets.reduce((s, a) => s + a.amount, 0);
    const totalLiabilities = liabilities.reduce((s, l) => s + l.amount, 0);
    const totalEquity = equity.reduce((s, e) => s + e.amount, 0);

    res.json({
      assets,
      liabilities,
      equity,
      profitLoss: pl.netProfit,
      totalAssets,
      totalLiabilities,
      totalEquity,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createJournalEntry = async (req, res) => {
  try {
    const userId = req.user._id;
    const { entryNumber, entryDate, narration, referenceType, lines } = req.body;
    const je = await postJournalEntry(userId, {
      entryNumber, entryDate, narration, referenceType: referenceType || 'journal',
      description: narration, lines,
    }, req.businessId);
    res.status(201).json(je);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const getBankAccounts = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const accounts = await Account.find({ ...baseFilter, type: 'asset', category: 'bank', isActive: true }).sort({ code: 1 });
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createBankAccount = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { name, openingBalance, accountNumber, ifscCode, bankName, upiId, accountHolderName, printQr, printDetails, acceptPayments } = req.body;
    const userId = req.user._id;
    const lastAccount = await Account.findOne({ ...baseFilter, category: 'bank' }).sort({ code: -1 });
    const nextCode = lastAccount ? String(parseInt(lastAccount.code) + 1) : '1003';
    const account = await Account.create({
      user: userId,
      business: req.businessId,
      name: name || bankName || 'Bank Account',
      code: nextCode,
      type: 'asset',
      category: 'bank',
      balance: parseFloat(openingBalance) || 0,
      description: accountNumber ? `${bankName || ''} - ${accountNumber}` : '',
      metadata: { accountNumber, ifscCode, bankName, upiId, accountHolderName, printQr, printDetails, acceptPayments },
      isActive: true,
    });
    res.status(201).json(account);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createAccount = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const userId = req.user._id;
    const { name, type, category, code, description, parent, balance } = req.body;
    if (!name || !type || !category) {
      return res.status(400).json({ message: 'Name, type and category are required' });
    }
    let accountCode = code;
    if (!accountCode) {
      const lastAccount = await Account.findOne({ ...baseFilter, type }).sort({ code: -1 });
      const prefix = { asset: '1', liability: '2', equity: '3', income: '4', expense: '5' }[type] || '1';
      accountCode = lastAccount ? String(parseInt(lastAccount.code) + 1) : `${prefix}001`;
    }
    const account = await Account.create({
      user: userId, business: req.businessId, name, code: accountCode, type, category,
      parent: parent || undefined, balance: parseFloat(balance) || 0,
      description: description || '', isActive: true,
    });
    res.status(201).json(account);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateAccount = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { name, code, type, group, description, metadata, isActive } = req.body;
    const account = await Account.findOneAndUpdate(
      { _id: req.params.id, ...baseFilter },
      { $set: { name, code, type, group, description, metadata, isActive } },
      { new: true }
    );
    if (!account) return res.status(404).json({ message: 'Account not found' });
    res.json(account);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteAccount = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const account = await Account.findOneAndUpdate(
      { _id: req.params.id, ...baseFilter },
      { $set: { isActive: false } },
      { new: true }
    );
    if (!account) return res.status(404).json({ message: 'Account not found' });
    res.json({ message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getAccountStatement = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate, page = 1, limit = 50 } = req.query;
    const account = await Account.findOne({ _id: req.params.id, ...baseFilter });
    if (!account) return res.status(404).json({ message: 'Account not found' });

    const allFilter = { ...baseFilter, isPosted: true, 'lines.account': req.params.id };
    const allEntries = await JournalEntry.find(allFilter).sort({ entryDate: 1 });

    let openingBalance = 0;
    const start = startDate ? new Date(startDate) : null;
    allEntries.forEach((je) => {
      if (start && je.entryDate >= start) return;
      const line = je.lines.find(l => l.account.toString() === req.params.id);
      if (!line) return;
      if (['asset', 'expense'].includes(account.type)) {
        openingBalance += line.debit - line.credit;
      } else {
        openingBalance += line.credit - line.debit;
      }
    });

    const filter = { ...baseFilter, isPosted: true, 'lines.account': req.params.id };
    if (startDate && endDate) {
      filter.entryDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const total = await JournalEntry.countDocuments(filter);
    const entries = await JournalEntry.find(filter)
      .sort({ entryDate: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('lines.account', 'name code type');

    let runningBalance = openingBalance;
    const statement = entries.map(e => {
      const line = e.lines.find(l => l.account.toString() === req.params.id);
      const debit = line ? line.debit : 0;
      const credit = line ? line.credit : 0;
      if (['asset', 'expense'].includes(account.type)) {
        runningBalance += debit - credit;
      } else {
        runningBalance += credit - debit;
      }
      return {
        _id: e._id,
        entryNumber: e.entryNumber,
        entryDate: e.entryDate,
        narration: e.narration || e.description || '',
        referenceType: e.referenceType,
        debit,
        credit,
        balance: runningBalance,
      };
    });

    res.json({
      account: { _id: account._id, name: account.name, code: account.code, type: account.type, category: account.category, balance: openingBalance },
      entries: statement,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getLoanAccounts = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const accounts = await Account.find({ ...baseFilter, type: 'liability', category: 'loan', isActive: true }).sort({ code: 1 });
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createLoanAccount = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const userId = req.user._id;
    const { name, balance, accountNumber, lenderBank, interestRate, processingFee, description, termDuration } = req.body;
    const lastAccount = await Account.findOne({ ...baseFilter, category: 'loan' }).sort({ code: -1 });
    const nextCode = lastAccount ? String(parseInt(lastAccount.code) + 1) : '2301';
    const account = await Account.create({
      user: userId,
      business: req.businessId,
      name: name || 'Loan Account',
      code: nextCode,
      type: 'liability',
      category: 'loan',
      balance: parseFloat(balance) || 0,
      description: description || '',
      metadata: { accountNumber, lenderBank, interestRate, processingFee, termDuration },
      isActive: true,
    });
    res.status(201).json(account);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getCheques = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const filter = { ...baseFilter, mode: 'cheque' };
    const receipts = await Receipt.find(filter).sort({ date: -1 }).limit(100);
    res.json(receipts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  seedAccounts,
  getAccounts,
  postJournalEntry,
  getJournalEntries,
  createJournalEntry,
  getTrialBalance,
  getProfitLoss,
  getBalanceSheet,
  getBankAccounts,
  createBankAccount,
  getLoanAccounts,
  createLoanAccount,
  getCheques,
  createAccount,
  updateAccount,
  deleteAccount,
  getAccountStatement,
};
