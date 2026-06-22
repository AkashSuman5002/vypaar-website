const Transaction = require('../models/Transaction');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');
const { createNotification } = require('../controllers/notificationController');

const getTransactions = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { page = 1, limit = 50, dateFrom, dateTo } = req.query;

    const filter = { ...baseFilter };
    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom);
      if (dateTo) filter.date.$lte = new Date(dateTo + 'T23:59:59.999Z');
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Transaction.countDocuments(filter);
    const transactions = await Transaction.find(filter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createTransaction = async (req, res) => {
  try {
    const { type, amount, description, date, reference } = req.body;
    const transaction = await Transaction.create({
      ...getCreateData(req),
      type,
      amount,
      description,
      date,
      reference,
    });

    const typeLabels = { cash_in: 'Cash Received', cash_out: 'Cash Paid', bank_in: 'Bank Deposit', bank_out: 'Bank Withdrawal' };
    createNotification(req.user._id, 'bank_transaction', typeLabels[type] || 'Transaction',
      `${typeLabels[type] || type} of Rs.${Number(amount).toFixed(2)}${description ? ` - ${description}` : ''}`,
      transaction._id, 'Transaction'
    ).catch(() => {});

    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getCashBankBalance = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const result = await Transaction.aggregate([
      { $match: baseFilter },
      { $group: { _id: '$type', total: { $sum: '$amount' } } }
    ]);

    const balanceMap = {};
    result.forEach(r => { balanceMap[r._id] = r.total; });

    const cashBalance = (balanceMap.cash_in || 0) - (balanceMap.cash_out || 0);
    const bankBalance = (balanceMap.bank_in || 0) - (balanceMap.bank_out || 0);

    res.json({ cashBalance, bankBalance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getTransactions, createTransaction, getCashBankBalance };
