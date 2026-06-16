const Budget = require('../models/Budget');
const Expense = require('../models/Expense');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');

const getPeriodDateRange = (period, month, year) => {
  let start, end;
  if (period === 'yearly') {
    start = new Date(year, 0, 1);
    end = new Date(year, 11, 31, 23, 59, 59, 999);
  } else if (period === 'quarterly') {
    const q = Math.ceil((month || 1) / 3);
    start = new Date(year, (q - 1) * 3, 1);
    end = new Date(year, q * 3, 0, 23, 59, 59, 999);
  } else {
    start = new Date(year, (month || 1) - 1, 1);
    end = new Date(year, month || 1, 0, 23, 59, 59, 999);
  }
  return { start, end };
};

const getBudgets = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { year, month, category, period } = req.query;
    const filter = { ...baseFilter, isActive: true };
    if (year) filter.year = parseInt(year);
    if (month) filter.month = parseInt(month);
    if (category) filter.category = category;
    if (period) filter.period = period;

    const budgets = await Budget.find(filter).sort({ year: -1, month: -1, category: 1 });

    const budgetsAndSpent = await Promise.all(budgets.map(async (b) => {
      const { start, end } = getPeriodDateRange(b.period, b.month, b.year);
      const result = await Expense.aggregate([
        { $match: { user: b.user, business: b.business, category: b.category, date: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]);
      const spent = result.length > 0 ? result[0].total : 0;
      if (spent !== b.spent) {
        await Budget.findByIdAndUpdate(b._id, { spent });
        b.spent = spent;
      }
      return b;
    }));

    res.json(budgetsAndSpent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createBudget = async (req, res) => {
  try {
    const { category, amount, period, month, year, alertThreshold, notes } = req.body;
    if (!category || !amount || !year) {
      return res.status(400).json({ message: 'Category, amount, and year are required' });
    }

    const existing = await Budget.findOne({
      ...getBaseFilter(req),
      category, period: period || 'monthly', month: month || null, year, isActive: true,
    });
    if (existing) {
      return res.status(400).json({ message: 'A budget already exists for this category and period' });
    }

    const budget = await Budget.create({
      ...getCreateData(req, {
        category, amount, period: period || 'monthly', month, year,
        alertThreshold: alertThreshold || 80, notes,
      }),
    });
    res.status(201).json(budget);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateBudget = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const budget = await Budget.findOne({ ...baseFilter, _id: req.params.id });
    if (!budget) return res.status(404).json({ message: 'Budget not found' });

    const { category, amount, period, month, year, alertThreshold, notes, isActive } = req.body;
    const updated = await Budget.findOneAndUpdate(
      { _id: req.params.id, ...baseFilter },
      { category, amount, period, month, year, alertThreshold, notes, isActive },
      { new: true }
    );
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteBudget = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const budget = await Budget.findOne({ ...baseFilter, _id: req.params.id });
    if (!budget) return res.status(404).json({ message: 'Budget not found' });
    budget.isActive = false;
    await budget.save();
    res.json({ message: 'Budget removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getBudgetVsActual = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { year, month } = req.query;
    const filter = { ...baseFilter, isActive: true };
    if (year) filter.year = parseInt(year);
    if (month) filter.month = parseInt(month);

    const budgets = await Budget.find(filter).sort({ category: 1 });
    const result = await Promise.all(budgets.map(async (b) => {
      const { start, end } = getPeriodDateRange(b.period, b.month, b.year);
      const agg = await Expense.aggregate([
        { $match: { user: b.user, business: b.business, category: b.category, date: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]);
      const spent = agg.length > 0 ? agg[0].total : 0;
      return { ...b.toObject(), spent, remaining: b.amount - spent, percentage: b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0 };
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getBudgetAlerts = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const budgets = await Budget.find({ ...baseFilter, isActive: true });
    const alerts = [];

    for (const b of budgets) {
      const { start, end } = getPeriodDateRange(b.period, b.month, b.year);
      const agg = await Expense.aggregate([
        { $match: { user: b.user, business: b.business, category: b.category, date: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]);
      const spent = agg.length > 0 ? agg[0].total : 0;
      const percentage = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0;
      if (percentage >= b.alertThreshold) {
        alerts.push({ ...b.toObject(), spent, percentage });
      }
    }

    res.json(alerts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getBudgets, createBudget, updateBudget, deleteBudget, getBudgetVsActual, getBudgetAlerts };
