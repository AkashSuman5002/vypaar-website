const Transaction = require('../models/Transaction');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');

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
      { $group: {
        _id: '$type',
        total: { $sum: '$amount' },
      }},
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
