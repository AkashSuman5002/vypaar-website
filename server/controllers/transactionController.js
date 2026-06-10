const Transaction = require('../models/Transaction');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');
const { createNotification } = require('../controllers/notificationController');

const getTransactions = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const transactions = await Transaction.find({ ...baseFilter }).sort({ createdAt: -1 });
    res.json(transactions);
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
    const transactions = await Transaction.find(baseFilter).select('type amount').lean();
    const balanceMap = {};
    transactions.forEach(t => {
      if (!balanceMap[t.type]) balanceMap[t.type] = 0;
      balanceMap[t.type] += t.amount || 0;
    });

    const cashBalance = (balanceMap.cash_in || 0) - (balanceMap.cash_out || 0);
    const bankBalance = (balanceMap.bank_in || 0) - (balanceMap.bank_out || 0);

    res.json({ cashBalance, bankBalance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getTransactions, createTransaction, getCashBankBalance };
