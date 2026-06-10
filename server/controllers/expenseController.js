const Expense = require('../models/Expense');
const Transaction = require('../models/Transaction');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');
const { createNotification } = require('../controllers/notificationController');

const getExpenses = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { page = 1, limit = 50, category, search, dateFrom, dateTo } = req.query;
    const filter = { ...baseFilter };
    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { category: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { expenseNumber: { $regex: search, $options: 'i' } },
      ];
    }
    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom);
      if (dateTo) filter.date.$lte = new Date(dateTo + 'T23:59:59.999Z');
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
    const { expenseNumber, category, description, amount: rawAmount, tax: rawTax, date, paymentMethod, reference, notes, isRecurring, recurringInterval } = req.body;
    const amount = rawAmount ?? (req.body.totalAmount ? req.body.totalAmount - (rawTax || 0) : 0);
    const tax = rawTax ?? 0;
    const totalAmount = amount + tax;
    const expense = await Expense.create({
      ...getCreateData(req, { expenseNumber, category: category || 'Other', description,
        amount, tax, totalAmount, date, paymentMethod: paymentMethod || 'cash',
        reference, notes, isRecurring, recurringInterval }),
    });

    const txnType = paymentMethod === 'cash' ? 'cash_out' : 'bank_out';
    await Transaction.create({
      ...getCreateData(req, { type: txnType, amount: totalAmount,
        description: `Expense - ${category || 'Other'}: ${description || ''}`,
        date: date || new Date(), reference: expenseNumber || expense._id,
        referenceModel: 'Expense', referenceId: expense._id,
        partyName: description, partyType: 'expense' }),
    });

    createNotification(req.user._id, 'expense_created', 'Expense Recorded',
      `${category || 'Other'} expense of Rs.${totalAmount.toFixed(2)}${description ? ` - ${description}` : ''}`,
      expense._id, 'Expense'
    ).catch(() => {});

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

    const { amount: rawAmount, tax: rawTax, category, description, paymentMethod, totalAmount: sentTotal, date, expenseNumber, items, roundOff } = req.body;
    const amount = rawAmount ?? (sentTotal ? sentTotal - (rawTax || 0) : expense.amount);
    const tax = rawTax ?? expense.tax;
    const totalAmount = amount + tax;
    const updated = await Expense.findOneAndUpdate({ _id: req.params.id, ...baseFilter }, { date, expenseNumber, category, description, paymentMethod, items, roundOff, amount, tax, totalAmount }, { new: true });

    const txnType = (paymentMethod || expense.paymentMethod) === 'cash' ? 'cash_out' : 'bank_out';
    await Transaction.findOneAndUpdate(
      { referenceModel: 'Expense', referenceId: expense._id, user: req.user._id },
      {
        ...getCreateData(req, { type: txnType, amount: totalAmount,
          description: `Expense - ${category || expense.category || 'Other'}: ${description || expense.description || ''}`,
          date: req.body.date || expense.date || new Date(),
          reference: req.body.expenseNumber || expense.expenseNumber || expense._id,
          partyName: description || expense.description,
          partyType: 'expense' }),
      },
      { upsert: true, new: true }
    );

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
    await Expense.findOneAndDelete({ _id: req.params.id, ...baseFilter });
    await Transaction.deleteMany({ referenceModel: 'Expense', referenceId: expense._id, user: req.user._id });
    res.json({ message: 'Expense removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getExpenses, getExpenseById, createExpense, updateExpense, deleteExpense };
