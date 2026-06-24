const Account = require('../models/Account');
const JournalEntry = require('../models/JournalEntry');
const Receipt = require('../models/Receipt');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const Transaction = require('../models/Transaction');
const Expense = require('../models/Expense');
const Setting = require('../models/Setting');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');
const { withTransaction } = require('../utils/withTransaction');
const { aggregateLedgerByAccount } = require('../utils/reportHelpers');

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
    const setting = await Setting.findOne({ user: req.user._id });
    if (setting?.preferences?.accounting?.enableAccounting === false) {
      return res.json([]);
    }
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
    // JournalEntries may have been created with different business context or before business feature
    const entries = await JournalEntry.find({ user: userId, isPosted: true });
    const ledger = aggregateLedgerByAccount(entries);
    const accountsWithBalance = [];
    for (const acc of accounts) {
      const t = ledger.get(acc._id.toString());
      const totalDebit = t ? t.debit : 0;
      const totalCredit = t ? t.credit : 0;
      const hasJournalEntries = !!t;
      // Use journal entry computed balance if entries exist, otherwise use stored balance
      // (stored balance was correctly updated via $inc during sale/purchase/payment creation)
      const balance = hasJournalEntries
        ? (['asset', 'expense'].includes(acc.type) ? totalDebit - totalCredit : totalCredit - totalDebit)
        : acc.balance;
      // NOTE: GETs must not write. We return the JE-computed balance in the
      // response without persisting it (previously self-healed via
      // findByIdAndUpdate outside any transaction). Stored balances are kept
      // correct by the $inc updates in sale/purchase/payment create handlers.
      accountsWithBalance.push({ ...acc.toObject(), balance });
    }
    res.json(accountsWithBalance);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Posts a balanced journal entry and applies the per-account balance deltas.
// When `session` is provided every write joins that transaction so the JE row and
// the account balances commit atomically (no partial / unbalanced ledger). When
// called standalone (session === null) the caller is responsible for wrapping it
// in withTransaction — see createJournalEntry.
const postJournalEntry = async (userId, entry, businessId, session = null) => {
  const opts = session ? { session } : {};
  const setting = await Setting.findOne({ user: userId }, null, opts);
  if (setting?.preferences?.accounting?.allowJournalEntries === false) {
    throw new Error('Journal entries are disabled in settings');
  }

  const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Debit (${totalDebit}) != Credit (${totalCredit})`);
  }

  // create([...]) array form is required to pass a session; it returns an array.
  const [je] = await JournalEntry.create([{
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
  }], opts);

  for (const line of entry.lines) {
    const account = await Account.findOne(
      { _id: line.account, user: userId, business: businessId || undefined },
      null,
      opts,
    );
    if (!account) continue;
    let balanceChange = 0;
    if (['asset', 'expense'].includes(account.type)) {
      balanceChange = line.debit - line.credit;
    } else {
      balanceChange = line.credit - line.debit;
    }
    // `account` was already resolved (and scoped) above; update it by its real _id.
    // (The previous call passed a filter object to findByIdAndUpdate, which expects an
    // id — Mongoose tried to cast the object to an ObjectId and threw, failing the
    // whole journal entry and never updating account balances.)
    await Account.updateOne({ _id: account._id }, { $inc: { balance: balanceChange } }, opts);
  }

  return je;
};

const getJournalEntries = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { startDate, endDate, referenceType, page = 1, limit = 50 } = req.query;
    const filter = { user: req.user._id };
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
    const setting = await Setting.findOne({ user: req.user._id });
    if (setting?.preferences?.accounting?.enableAccounting === false) {
      return res.json({ accounts: [], totalDebit: 0, totalCredit: 0, accountingDisabled: true });
    }
    const baseFilter = getBaseFilter(req);
    let { startDate, endDate } = req.query;
    const journalFilter = { user: req.user._id, isPosted: true };
    if (startDate && endDate) {
      journalFilter.entryDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const accounts = await Account.find({ ...baseFilter, isActive: true }).sort({ code: 1 });
    const entries = await JournalEntry.find(journalFilter);
    const ledger = aggregateLedgerByAccount(entries);

    const result = accounts.map((acc) => {
      const t = ledger.get(acc._id.toString()) || { debit: 0, credit: 0 };
      const totalDebit = t.debit;
      const totalCredit = t.credit;
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

const calcProfitLoss = async (baseFilter, query, userId) => {
  const { startDate, endDate } = query || {};
  const journalFilter = { user: userId, isPosted: true };
  if (startDate && endDate) {
    journalFilter.entryDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  const expenseFilter = { ...baseFilter };
  if (startDate && endDate) {
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1);
    expenseFilter.date = { $gte: new Date(startDate), $lt: end };
  }

  const [incomeAccounts, expenseAccounts, entries, expenses] = await Promise.all([
    Account.find({ ...baseFilter, type: 'income', isActive: true }),
    Account.find({ ...baseFilter, type: 'expense', isActive: true }),
    JournalEntry.find(journalFilter),
    Expense.find(expenseFilter).lean(),
  ]);

  const ledger = aggregateLedgerByAccount(entries);
  const calculateBalance = (acc) => {
    const t = ledger.get(acc._id.toString()) || { debit: 0, credit: 0 };
    return t.credit - t.debit;
  };

  const income = incomeAccounts.map((a) => ({ name: a.name, amount: calculateBalance(a), category: a.category, parent: a.parent }));
  const expense = expenseAccounts.map((a) => ({ name: a.name, amount: Math.abs(calculateBalance(a)), category: a.category, parent: a.parent }));

  // Group Expense model records by category and merge with Account-based expenses
  const expenseByCategory = {};
  expenses.forEach((e) => {
    const cat = (e.category || 'Other').trim();
    if (!expenseByCategory[cat]) expenseByCategory[cat] = 0;
    expenseByCategory[cat] += e.totalAmount || e.amount || 0;
  });

  // Map Expense model categories to expense accounts (add amounts not already covered by journal entries)
  const accountNamesCovered = new Set(expense.map((a) => a.name.toLowerCase()));
  Object.entries(expenseByCategory).forEach(([cat, total]) => {
    const matchedAccount = expense.find((a) => a.name.toLowerCase() === cat.toLowerCase());
    if (matchedAccount) {
      // Already has journal entry balance — only add the difference if journal entry missed it
      if (matchedAccount.amount === 0 && total > 0) {
        matchedAccount.amount = total;
      }
    } else {
      // No account exists for this category — add as a standalone expense item
      expense.push({ name: cat, amount: total, category: 'indirect_expense', parent: null });
    }
  });

  const totalIncome = income.reduce((s, i) => s + i.amount, 0);
  const totalExpense = expense.reduce((s, e) => s + e.amount, 0);
  const netProfit = totalIncome - totalExpense;

  // Build hierarchical tree for Accounting view
  const buildTree = (accounts) => {
    const childMap = {};
    accounts.forEach((a) => {
      const pid = a.parent ? a.parent.toString() : null;
      if (!childMap[pid]) childMap[pid] = [];
      childMap[pid].push(a);
    });
    const traverse = (parentId) => {
      const children = childMap[parentId] || [];
      return children.map((c) => {
        const subChildren = traverse(c._id.toString());
        return { name: c.name, amount: c.amount, category: c.category, children: subChildren };
      });
    };
    return traverse(null);
  };

  // If tree is empty (no Account hierarchy), build flat group tree from expense/income arrays
  const buildFlatTree = (items, parentMap) => {
    const roots = [];
    items.forEach((item) => {
      const pid = item.parent ? item.parent.toString() : null;
      if (!parentMap[pid]) parentMap[pid] = [];
      parentMap[pid].push(item);
    });
    return parentMap[null] || [];
  };

  const incomeTree = buildTree(incomeAccounts);
  const expenseTree = buildTree(expenseAccounts);

  // If accounting hierarchy is empty, build from flat expense/income data
  const buildCategoryTree = (items) => {
    const groups = {};
    items.forEach((item) => {
      const cat = item.category || 'other';
      if (!groups[cat]) groups[cat] = { _id: cat, name: cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), amount: 0, category: cat, children: [] };
      groups[cat].amount += item.amount;
      groups[cat].children.push({ name: item.name, amount: item.amount, category: item.category, children: [] });
    });
    return Object.values(groups);
  };

  const finalIncomeTree = incomeTree.length > 0 ? incomeTree : buildCategoryTree(income.filter((i) => i.amount !== 0));
  const finalExpenseTree = expenseTree.length > 0 ? expenseTree : buildCategoryTree(expense.filter((e) => e.amount !== 0));

  return {
    income: income.filter((i) => i.amount !== 0),
    expense: expense.filter((e) => e.amount !== 0),
    totalIncome,
    totalExpense,
    netProfit,
    incomeTree: finalIncomeTree,
    expenseTree: finalExpenseTree,
  };
};

const getProfitLoss = async (req, res) => {
  try {
    const setting = await Setting.findOne({ user: req.user._id });
    if (setting?.preferences?.accounting?.enableAccounting === false) {
      return res.json({ revenue: 0, expenses: 0, netProfit: 0, revenueItems: [], expenseItems: [], accountingDisabled: true });
    }
    const baseFilter = getBaseFilter(req);
    const result = await calcProfitLoss(baseFilter, req.query, req.user._id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getBalanceSheet = async (req, res) => {
  try {
    const setting = await Setting.findOne({ user: req.user._id });
    if (setting?.preferences?.accounting?.enableAccounting === false) {
      return res.json({ assets: [], liabilities: [], equity: [], totalAssets: 0, totalLiabilities: 0, totalEquity: 0, accountingDisabled: true });
    }
    const baseFilter = getBaseFilter(req);
    const { endDate } = req.query;
    const accounts = await Account.find({ ...baseFilter, isActive: true }).sort({ code: 1 });

    // A balance sheet is a snapshot "as of" a date: include every posted entry up to
    // and including endDate (not just a single period, and not all-time when a date is
    // chosen). Without bounding by endDate, balances drifted out of sync with the
    // period retained-earnings figure and Assets != Liabilities + Equity.
    const entryFilter = { user: req.user._id, isPosted: true };
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      entryFilter.entryDate = { $lte: end };
    }
    const entries = await JournalEntry.find(entryFilter);
    const ledger = aggregateLedgerByAccount(entries);

    const getBalance = (acc) => {
      const t = ledger.get(acc._id.toString()) || { debit: 0, credit: 0 };
      return ['asset', 'expense'].includes(acc.type) ? t.debit - t.credit : t.credit - t.debit;
    };

    const assets = accounts.filter((a) => a.type === 'asset').map((a) => ({ name: a.name, amount: getBalance(a) }));
    const liabilities = accounts.filter((a) => a.type === 'liability').map((a) => ({ name: a.name, amount: getBalance(a) }));
    const equity = accounts.filter((a) => a.type === 'equity').map((a) => ({ name: a.name, amount: getBalance(a) }));

    // Retained earnings = net income (income - expense) computed from the SAME posted
    // entries used for the balances above. Deriving it from the identical entry set
    // (rather than a separately date-filtered P&L) guarantees Assets = Liabilities +
    // Equity by construction, for any "as of" date.
    const incomeTotal = accounts
      .filter((a) => a.type === 'income')
      .reduce((s, a) => s + getBalance(a), 0);
    const expenseTotal = accounts
      .filter((a) => a.type === 'expense')
      .reduce((s, a) => s + getBalance(a), 0);
    const periodProfit = incomeTotal - expenseTotal;
    equity.push({ name: 'Retained Earnings', amount: periodProfit });

    const totalAssets = assets.reduce((s, a) => s + a.amount, 0);
    const totalLiabilities = liabilities.reduce((s, l) => s + l.amount, 0);
    const totalEquity = equity.reduce((s, e) => s + e.amount, 0);

    res.json({
      assets,
      liabilities,
      equity,
      profitLoss: periodProfit,
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
    const setting = await Setting.findOne({ user: req.user._id });
    if (setting?.preferences?.accounting?.enableAccounting === false) {
      return res.status(400).json({ message: 'Accounting is disabled in settings' });
    }
    const userId = req.user._id;
    const { entryNumber, entryDate, narration, referenceType, lines } = req.body;
    // Atomic: the JE row and every account balance delta commit together.
    const je = await withTransaction((session) => postJournalEntry(userId, {
      entryNumber, entryDate, narration, referenceType: referenceType || 'journal',
      description: narration, lines,
    }, req.businessId, session));
    res.status(201).json(je);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const getBankAccounts = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const userId = req.user._id;
    const [accounts, entries, transactions] = await Promise.all([
      Account.find({ ...baseFilter, type: 'asset', category: 'bank', isActive: true }).sort({ code: 1 }),
      JournalEntry.find({ user: userId, isPosted: true }),
      Transaction.find(baseFilter).select('type amount').lean(),
    ]);

    const txnMap = {};
    transactions.forEach(t => {
      if (!txnMap[t.type]) txnMap[t.type] = 0;
      txnMap[t.type] += t.amount || 0;
    });
    const totalBankTxnBalance = (txnMap.bank_in || 0) - (txnMap.bank_out || 0);

    const ledger = aggregateLedgerByAccount(entries);
    const accountsWithBalance = accounts.map(acc => {
      const t = ledger.get(acc._id.toString());
      const balance = t ? (t.debit - t.credit) : (acc.balance || 0);
      return { ...acc.toObject(), balance };
    });

    const totalAccountBalance = accountsWithBalance.reduce((sum, a) => sum + (a.balance || 0), 0);
    const totalBankBalance = totalAccountBalance + totalBankTxnBalance;

    res.json({ accounts: accountsWithBalance, totalBankBalance });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createBankAccount = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const body = req.body || {};
    // The client sends the details nested under `metadata` and the balance as `balance`;
    // older callers used top-level fields and `openingBalance`. Accept both so the saved
    // account actually keeps its details/balance.
    const meta = body.metadata || {};
    const pick = (k) => (meta[k] !== undefined ? meta[k] : body[k]);
    const name = body.name;
    const balanceInput = body.balance !== undefined ? body.balance : body.openingBalance;
    const accountNumber = pick('accountNumber');
    const ifscCode = pick('ifscCode');
    const bankName = pick('bankName');
    const upiId = pick('upiId');
    const accountHolderName = pick('accountHolderName');
    const printQr = pick('printQr');
    const printDetails = pick('printDetails');
    const acceptPayments = pick('acceptPayments');
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
      balance: parseFloat(balanceInput) || 0,
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
    const { name, code, type, category, group, parent, description, metadata, isActive } = req.body;
    // `balance` is intentionally NOT accepted here. Account balances must only change
    // via journal entries (postJournalEntry) to preserve double-entry integrity.
    const update = { name, code, type, category, group, parent, description, metadata, isActive };
    const account = await Account.findOneAndUpdate(
      { _id: req.params.id, ...baseFilter },
      { $set: update },
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

    const isAsset = ['asset', 'expense'].includes(account.type);
    const isCash = account.code === '1001' || account.category === 'cash';
    const isBank = account.category === 'bank' || (account.code >= '1002' && account.code <= '1099');

    const allFilter = { ...baseFilter, isPosted: true, 'lines.account': req.params.id };
    const allEntries = await JournalEntry.find(allFilter).sort({ entryDate: 1 });

    let openingBalance = 0;
    const start = startDate ? new Date(startDate) : null;
    allEntries.forEach((je) => {
      if (start && je.entryDate >= start) return;
      const line = je.lines.find(l => {
        const accId = l.account?._id ? l.account._id.toString() : l.account?.toString();
        return accId === req.params.id;
      });
      if (!line) return;
      if (isAsset) {
        openingBalance += line.debit - line.credit;
      } else {
        openingBalance += line.credit - line.debit;
      }
    });

    // Build combined entries from JournalEntry + Transaction
    const combinedEntries = [];

    // Add journal entry entries
    allEntries.forEach(e => {
      const line = e.lines.find(l => {
        const accId = l.account?._id ? l.account._id.toString() : l.account?.toString();
        return accId === req.params.id;
      });
      if (!line) return;
      combinedEntries.push({
        _id: e._id,
        entryDate: e.entryDate,
        entryNumber: e.entryNumber,
        narration: e.narration || e.description || '',
        referenceType: e.referenceType,
        debit: line.debit || 0,
        credit: line.credit || 0,
        source: 'journal',
      });
    });

    // Also include Transaction records for cash/bank accounts
    if (isCash || isBank) {
      const txnFilter = { ...baseFilter };
      if (startDate || endDate) {
        txnFilter.date = {};
        if (startDate) txnFilter.date.$gte = new Date(startDate);
        if (endDate) txnFilter.date.$lte = new Date(endDate);
      }
      if (isCash) {
        txnFilter.type = { $in: ['cash_in', 'cash_out'] };
      } else {
        txnFilter.type = { $in: ['bank_in', 'bank_out'] };
      }

      const txns = await Transaction.find(txnFilter).sort({ date: 1 });
      txns.forEach(t => {
        const alreadyHasJE = combinedEntries.some(e =>
          e.source === 'journal' &&
          Math.abs(new Date(e.entryDate).getTime() - new Date(t.date).getTime()) < 86400000 &&
          Math.abs((e.debit || e.credit || 0) - t.amount) < 0.01
        );
        if (alreadyHasJE) return;

        const isCredit = (isCash && t.type === 'cash_in') || (isBank && t.type === 'bank_in');
        combinedEntries.push({
          _id: t._id,
          entryDate: t.date,
          entryNumber: t.reference || `TXN-${String(t._id).slice(-6).toUpperCase()}`,
          narration: t.description || t.partyName || t.type,
          referenceType: t.type.replace('_', ' '),
          debit: isCredit ? 0 : t.amount,
          credit: isCredit ? t.amount : 0,
          source: 'transaction',
        });
      });
    }

    // Sort all entries by date
    combinedEntries.sort((a, b) => new Date(a.entryDate) - new Date(b.entryDate));

    // Filter by date range if provided
    let filtered = combinedEntries;
    if (startDate || endDate) {
      filtered = combinedEntries.filter(e => {
        const d = new Date(e.entryDate);
        if (startDate && d < new Date(startDate)) return false;
        if (endDate && d > new Date(endDate)) return false;
        return true;
      });
    }

    // Recompute opening balance from combined entries before startDate
    let finalOpening = 0;
    const effectiveStart = startDate ? new Date(startDate) : null;
    combinedEntries.forEach(e => {
      if (effectiveStart && new Date(e.entryDate) >= effectiveStart) return;
      if (isAsset) {
        finalOpening += e.debit - e.credit;
      } else {
        finalOpening += e.credit - e.debit;
      }
    });

    const total = filtered.length;
    const pg = parseInt(page);
    const pgSize = parseInt(limit);
    const paged = filtered.slice((pg - 1) * pgSize, pg * pgSize);

    let runningBalance = finalOpening;
    const statement = paged.map(e => {
      if (isAsset) {
        runningBalance += e.debit - e.credit;
      } else {
        runningBalance += e.credit - e.debit;
      }
      return {
        _id: e._id,
        entryNumber: e.entryNumber,
        entryDate: e.entryDate,
        narration: e.narration,
        referenceType: e.referenceType,
        debit: e.debit,
        credit: e.credit,
        balance: runningBalance,
      };
    });

    res.json({
      account: { _id: account._id, name: account.name, code: account.code, type: account.type, category: account.category, balance: account.balance },
      entries: statement,
      total,
      page: pg,
      pages: Math.ceil(total / pgSize),
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

const createCheque = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const receipt = await Receipt.create({
      ...getCreateData(req, {
        ...req.body,
        mode: 'cheque',
      }),
    });
    res.status(201).json(receipt);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateCheque = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const receipt = await Receipt.findOne({ ...baseFilter, _id: req.params.id, mode: 'cheque' });
    if (!receipt) return res.status(404).json({ message: 'Cheque not found' });

    const allowed = ['date', 'chequeNo', 'bankName', 'customerName', 'amount', 'status', 'partyName'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) receipt[key] = req.body[key];
    }
    await receipt.save();
    res.json(receipt);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteCheque = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const receipt = await Receipt.findOneAndDelete({ ...baseFilter, _id: req.params.id, mode: 'cheque' });
    if (!receipt) return res.status(404).json({ message: 'Cheque not found' });
    res.json({ message: 'Cheque deleted' });
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
  createCheque,
  updateCheque,
  deleteCheque,
  createAccount,
  updateAccount,
  deleteAccount,
  getAccountStatement,
};
