const Expense = require('../models/Expense');
const Transaction = require('../models/Transaction');
const JournalEntry = require('../models/JournalEntry');
const Account = require('../models/Account');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');
const { createNotification } = require('../controllers/notificationController');
const { sendEmailNotification } = require('../services/emailService');
const { withTransaction } = require('../utils/withTransaction');
const { getNextSequence } = require('../utils/nextNumber');
const { splitGstTotal } = require('../utils/reportHelpers');

// Seed value = current max numeric EXP- expense number for this tenant (prefix
// stripped). Used only to seed the counter on its first use over existing data.
const EXPENSE_PREFIX = 'EXP-';
const maxExpenseSeq = async (baseFilter) => {
  const all = await Expense.find(baseFilter).select('expenseNumber').lean();
  let max = 0;
  for (const e of all) {
    if (!e.expenseNumber || !String(e.expenseNumber).startsWith(EXPENSE_PREFIX)) continue;
    const num = parseInt(String(e.expenseNumber).slice(EXPENSE_PREFIX.length), 10);
    if (!isNaN(num) && num > max) max = num;
  }
  return max;
};

const getExpenses = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { page = 1, limit = 50, category, search, dateFrom, dateTo } = req.query;
    const filter = { ...baseFilter };
    if (category) filter.category = category;
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { category: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
        { expenseNumber: { $regex: escaped, $options: 'i' } },
      ];
    }
    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom);
      if (dateTo) filter.date.$lte = (dateTo.includes('T') ? new Date(dateTo) : new Date(dateTo + 'T23:59:59.999Z'));
    }
    const total = await Expense.countDocuments(filter);
    const expenses = await Expense.find(filter).sort({ date: -1 }).skip((page - 1) * limit).limit(parseInt(limit));
    res.json({ expenses, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getExpenseById = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const expense = await Expense.findOne({ ...baseFilter, _id: req.params.id });
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createExpense = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { category, description, amount: rawAmount, tax: rawTax, date, paymentMethod, reference, notes, paidTo, items, receiptImage, isRecurring, recurringInterval } = req.body;
    // expenseNumber is reassigned when omitted (atomic counter), so keep it mutable.
    let expenseNumber = req.body.expenseNumber;
    const amount = rawAmount ?? (req.body.totalAmount ? req.body.totalAmount - (rawTax || 0) : 0);
    const tax = rawTax ?? 0;
    const totalAmount = amount + tax;
    // Split the expense tax into CGST/SGST (intra-state) or IGST (inter-state) so it
    // can feed ITC reporting instead of sitting as one undifferentiated `tax` lump.
    const isInterState = req.body.isInterState === true;
    const { cgstTotal, sgstTotal, igstTotal } = splitGstTotal(tax, isInterState);

    let expense;
    await withTransaction(async (session) => {
    // Honor a client-supplied expense number; otherwise allocate one atomically
    // from the per-tenant counter inside this transaction (no read-max-then-+1
    // race). Re-resolved each attempt since the transaction may retry.
    if (!req.body.expenseNumber) {
      const expSeq = await getNextSequence(
        { user: req.user._id, business: req.businessId },
        'expense',
        { session, seedFn: () => maxExpenseSeq(baseFilter) },
      );
      expenseNumber = `${EXPENSE_PREFIX}${String(expSeq).padStart(6, '0')}`;
    }
    [expense] = await Expense.create([
      getCreateData(req, { expenseNumber, category: category || 'Other', description,
        amount, tax, cgstTotal, sgstTotal, igstTotal, isInterState, totalAmount, date,
        paymentMethod: paymentMethod || 'cash',
        reference, notes, paidTo, items: items || [], receiptImage,
        isRecurring, recurringInterval }),
    ], { session });

    const txnType = paymentMethod === 'cash' ? 'cash_out' : 'bank_out';
    await Transaction.create([
      getCreateData(req, { type: txnType, amount: totalAmount,
        description: `Expense - ${category || 'Other'}: ${description || ''}`,
        date: date || new Date(), reference: expenseNumber || expense._id,
        referenceModel: 'Expense', referenceId: expense._id,
        partyName: description, partyType: 'expense' }),
    ], { session });

    // Create journal entry for expense
    try {
      const escapedCat = (category || 'Other').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const expenseAccount = await Account.findOne({ ...baseFilter, type: 'expense', name: { $regex: escapedCat, $options: 'i' } });
      const cashBankAccount = await Account.findOne({ ...baseFilter, type: 'asset', category: paymentMethod === 'cash' ? 'cash' : 'bank' });
      if (expenseAccount && cashBankAccount) {
        const jeLines = [
          { account: expenseAccount._id, accountName: expenseAccount.name, accountType: expenseAccount.type, debit: totalAmount, credit: 0 },
          { account: cashBankAccount._id, accountName: cashBankAccount.name, accountType: cashBankAccount.type, debit: 0, credit: totalAmount },
        ];
        await JournalEntry.create([
          getCreateData(req, {
            entryNumber: `JE-EXP-${expenseNumber || expense._id}`,
            entryDate: date || new Date(),
            referenceType: 'expense',
            referenceId: expense._id,
            lines: jeLines,
            totalDebit: totalAmount,
            totalCredit: totalAmount,
            narration: `Expense: ${description || category || 'Other'}`,
            isPosted: true,
            postedAt: new Date(),
          }),
        ], { session });
        await Account.findByIdAndUpdate(expenseAccount._id, { $inc: { balance: totalAmount } }, { session });
        await Account.findByIdAndUpdate(cashBankAccount._id, { $inc: { balance: -totalAmount } }, { session });
      }
    } catch (jeErr) {
      console.error('Failed to create journal entry for expense:', jeErr.message);
      throw jeErr;
    }

    // Update budget spent amount
    try {
      const Budget = require('../models/Budget');
      const expenseDate = date || new Date();
      const month = expenseDate.getMonth() + 1;
      const year = expenseDate.getFullYear();
      await Budget.findOneAndUpdate(
        { ...baseFilter, category: category || 'Other', month, year, isActive: true },
        { $inc: { spent: totalAmount } },
        { session }
      );
    } catch (e) { /* budget update optional */ }
    });

    createNotification(req.user._id, 'expense_created', 'Expense Recorded',
      `${category || 'Other'} expense of Rs.${totalAmount.toFixed(2)}${description ? ` - ${description}` : ''}`,
      expense._id, 'Expense'
    ).catch(() => {});

    // Send expense email alert to business owner
    const Setting = require('../models/Setting');
    const userSetting = await Setting.findOne({ user: req.user._id });
    const ownerEmail = userSetting?.email;
    if (ownerEmail) {
      sendEmailNotification(req.user._id, {
        to: ownerEmail,
        subject: `Expense Recorded - ${category || 'Other'} - Rs.${totalAmount.toFixed(2)}`,
        html: `<p>An expense of Rs.${totalAmount.toFixed(2)} has been recorded.</p><p>Category: ${category || 'Other'}</p><p>Description: ${description || '-'}</p>`,
      }).catch(() => {});
    }

    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateExpense = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const expense = await Expense.findOne({ ...baseFilter, _id: req.params.id });
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    const { amount: rawAmount, tax: rawTax, category, description, paymentMethod, totalAmount: sentTotal, date, expenseNumber, items, roundOff, reference, paidTo, receiptImage, notes } = req.body;
    const amount = rawAmount ?? (sentTotal ? sentTotal - (rawTax || 0) : expense.amount);
    const tax = rawTax ?? expense.tax;
    const totalAmount = amount + tax;
    const isInterState = req.body.isInterState ?? expense.isInterState ?? false;
    const { cgstTotal, sgstTotal, igstTotal } = splitGstTotal(tax, isInterState);

    let updated;
    await withTransaction(async (session) => {
    updated = await Expense.findOneAndUpdate({ _id: req.params.id, ...baseFilter }, { date, expenseNumber, category, description, paymentMethod, items, roundOff, amount, tax, cgstTotal, sgstTotal, igstTotal, isInterState, totalAmount, reference, paidTo, receiptImage, notes }, { new: true, session });

    const txnType = (paymentMethod || expense.paymentMethod) === 'cash' ? 'cash_out' : 'bank_out';
    await Transaction.findOneAndUpdate(
      { referenceModel: 'Expense', referenceId: expense._id, ...baseFilter },
      {
        ...getCreateData(req, { type: txnType, amount: totalAmount,
          description: `Expense - ${category || expense.category || 'Other'}: ${description || expense.description || ''}`,
          date: req.body.date || expense.date || new Date(),
          reference: req.body.expenseNumber || expense.expenseNumber || expense._id,
          partyName: description || expense.description,
          partyType: 'expense' }),
      },
      { upsert: true, new: true, session }
    );

    // Update journal entry
    try {
      const oldJE = await JournalEntry.findOne({ referenceType: 'expense', referenceId: expense._id, ...baseFilter });
      if (oldJE) {
        const jeAccIds = oldJE.lines.filter(l => l.account).map(l => l.account);
        const jeAccounts = await Account.find({ _id: { $in: jeAccIds }, ...baseFilter });
        const jeAccMap = new Map(jeAccounts.map(a => [a._id.toString(), a]));
        const reverseOps = oldJE.lines.filter(l => l.account).map(line => {
          const acc = jeAccMap.get(line.account.toString());
          if (!acc) return null;
          const change = ['asset', 'expense'].includes(acc.type) ? -(line.debit - line.credit) : -(line.credit - line.debit);
          return { updateOne: { filter: { _id: line.account, ...baseFilter }, update: { $inc: { balance: change } } } };
        }).filter(Boolean);
        if (reverseOps.length > 0) await Account.bulkWrite(reverseOps, { session });
        await JournalEntry.findOneAndDelete({ _id: oldJE._id, ...baseFilter }, { session });
      }

      const baseFilterJE = getBaseFilter(req);
      const escapedCat = (category || 'Other').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const expenseAccount = await Account.findOne({ ...baseFilterJE, type: 'expense', name: { $regex: escapedCat, $options: 'i' } });
      const cashBankAccount = await Account.findOne({ ...baseFilterJE, type: 'asset', category: (paymentMethod || expense.paymentMethod) === 'cash' ? 'cash' : 'bank' });
      if (expenseAccount && cashBankAccount) {
        const newLines = [
          { account: expenseAccount._id, accountName: expenseAccount.name, accountType: expenseAccount.type, debit: totalAmount, credit: 0 },
          { account: cashBankAccount._id, accountName: cashBankAccount.name, accountType: cashBankAccount.type, debit: 0, credit: totalAmount },
        ];
        await JournalEntry.create([
          getCreateData(req, {
            entryNumber: `JE-EXP-${expenseNumber || expense._id}`,
            entryDate: req.body.date || expense.date || new Date(),
            referenceType: 'expense',
            referenceId: expense._id,
            lines: newLines,
            totalDebit: totalAmount,
            totalCredit: totalAmount,
            narration: `Expense: ${description || category || 'Other'}`,
            isPosted: true,
            postedAt: new Date(),
          }),
        ], { session });
        await Account.findByIdAndUpdate(expenseAccount._id, { $inc: { balance: totalAmount } }, { session });
        await Account.findByIdAndUpdate(cashBankAccount._id, { $inc: { balance: -totalAmount } }, { session });
      }
    } catch (jeErr) {
      console.error('Failed to update journal entry for expense:', jeErr.message);
      throw jeErr;
    }
    });

    createNotification(req.user._id, 'expense_updated', 'Expense Updated',
      `Expense ${expense.expenseNumber || ''} has been updated - Rs.${totalAmount.toFixed(2)}`,
      expense._id, 'Expense'
    ).catch(() => {});

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const expense = await Expense.findOne({ ...baseFilter, _id: req.params.id });
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    await withTransaction(async (session) => {
    await Expense.findOneAndDelete({ _id: req.params.id, ...baseFilter }, { session });
    await Transaction.deleteMany({ referenceModel: 'Expense', referenceId: expense._id, ...baseFilter }, { session });

    // Reverse journal entry if one was created
    try {
      const oldJE = await JournalEntry.findOne({ referenceType: 'expense', referenceId: expense._id, ...baseFilter });
      if (oldJE) {
        const jeAccIds = oldJE.lines.filter(l => l.account).map(l => l.account);
        const jeAccounts = await Account.find({ _id: { $in: jeAccIds }, ...baseFilter });
        const jeAccMap = new Map(jeAccounts.map(a => [a._id.toString(), a]));
        const reverseOps = oldJE.lines.filter(l => l.account).map(line => {
          const acc = jeAccMap.get(line.account.toString());
          if (!acc) return null;
          const change = ['asset', 'expense'].includes(acc.type) ? -(line.debit - line.credit) : -(line.credit - line.debit);
          return { updateOne: { filter: { _id: line.account, ...baseFilter }, update: { $inc: { balance: change } } } };
        }).filter(Boolean);
        if (reverseOps.length > 0) await Account.bulkWrite(reverseOps, { session });
        await JournalEntry.findOneAndDelete({ _id: oldJE._id, ...baseFilter }, { session });
      }
    } catch (jeErr) {
      console.error('Failed to reverse journal entry for expense:', jeErr.message);
      throw jeErr;
    }

    // Decrement budget spent amount (mirror the increment done in createExpense)
    try {
      const Budget = require('../models/Budget');
      const expenseDate = expense.date ? new Date(expense.date) : new Date();
      const month = expenseDate.getMonth() + 1;
      const year = expenseDate.getFullYear();
      await Budget.findOneAndUpdate(
        { ...baseFilter, category: expense.category || 'Other', month, year, isActive: true },
        { $inc: { spent: -(expense.totalAmount || 0) } },
        { session }
      );
    } catch (e) { /* budget update optional */ }
    });

    createNotification(req.user._id, 'expense_deleted', 'Expense Removed',
      `Expense ${expense.expenseNumber || ''} of Rs.${expense.totalAmount?.toFixed(2) || '0'} has been removed`,
      expense._id, 'Expense'
    ).catch(() => {});

    res.json({ message: 'Expense removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const approveExpense = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const expense = await Expense.findOne({ ...baseFilter, _id: req.params.id });
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    expense.approvalStatus = 'approved';
    expense.approvedBy = req.user.name || req.user.email;
    expense.approvedAt = new Date();
    await expense.save();
    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const rejectExpense = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const expense = await Expense.findOne({ ...baseFilter, _id: req.params.id });
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    expense.approvalStatus = 'rejected';
    expense.rejectionReason = req.body.reason || '';
    expense.approvedBy = req.user.name || req.user.email;
    expense.approvedAt = new Date();
    await expense.save();
    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getExpenses, getExpenseById, createExpense, updateExpense, deleteExpense, approveExpense, rejectExpense };
