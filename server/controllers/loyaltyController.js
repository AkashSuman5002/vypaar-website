const LoyaltyPoint = require('../models/LoyaltyPoint');
const Customer = require('../models/Customer');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');

const EARNING_RATE = 10; // 1 point per ₹10 spent

const getLoyaltyPoints = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { customer, page = 1, limit = 50 } = req.query;
    const filter = { ...baseFilter };
    if (customer) filter.customer = customer;
    const total = await LoyaltyPoint.countDocuments(filter);
    const points = await LoyaltyPoint.find(filter)
      .populate('customer', 'name phone')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    res.json({ points, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getCustomerBalance = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { customerId } = req.params;
    const balance = await LoyaltyPoint.aggregate([
      { $match: { ...baseFilter, customer: require('mongoose').Types.ObjectId.createFromHexString(customerId) } },
      { $group: { _id: null, totalEarned: { $sum: '$points' }, totalRedeemed: { $sum: { $cond: ['$isRedeemed', '$points', 0] } } } },
    ]);
    const result = balance[0] || { totalEarned: 0, totalRedeemed: 0 };
    result.balance = result.totalEarned - result.totalRedeemed;
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const earnPoints = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { customer, customerName, transaction, points, description, referenceNumber } = req.body;
    if (!customer || !points) {
      return res.status(400).json({ message: 'Customer and points are required' });
    }
    const lastEntry = await LoyaltyPoint.findOne({ ...baseFilter, customer }).sort({ createdAt: -1 });
    const currentBalance = lastEntry ? lastEntry.balance : 0;
    const newBalance = currentBalance + points;
    const loyaltyPoint = await LoyaltyPoint.create({
      ...getCreateData(req, { customer, customerName, transaction,
      transactionType: 'earn', points, balance: newBalance,
      description: description || 'Points earned', referenceNumber,
    }) });
    await Customer.findByIdAndUpdate(customer, { $set: { loyaltyPoints: newBalance } });
    res.status(201).json(loyaltyPoint);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const redeemPoints = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { customer, customerName, points, description, referenceNumber } = req.body;
    if (!customer || !points) {
      return res.status(400).json({ message: 'Customer and points are required' });
    }
    const lastEntry = await LoyaltyPoint.findOne({ ...baseFilter, customer }).sort({ createdAt: -1 });
    const currentBalance = lastEntry ? lastEntry.balance : 0;
    if (points > currentBalance) {
      return res.status(400).json({ message: `Insufficient points. Available: ${currentBalance}` });
    }
    const newBalance = currentBalance - points;
    const loyaltyPoint = await LoyaltyPoint.create({
      ...getCreateData(req, { customer, customerName,
      transactionType: 'redeem', points, balance: newBalance,
      isRedeemed: true, redeemedAt: new Date(),
      description: description || 'Points redeemed', referenceNumber,
    }) });
    await Customer.findByIdAndUpdate(customer, { $set: { loyaltyPoints: newBalance } });
    res.status(201).json(loyaltyPoint);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const adjustPoints = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { customer, customerName, points, description } = req.body;
    if (!customer || points === undefined) {
      return res.status(400).json({ message: 'Customer and points are required' });
    }
    const lastEntry = await LoyaltyPoint.findOne({ ...baseFilter, customer }).sort({ createdAt: -1 });
    const currentBalance = lastEntry ? lastEntry.balance : 0;
    const newBalance = currentBalance + points;
    if (newBalance < 0) {
      return res.status(400).json({ message: `Adjustment would result in negative balance (${newBalance})` });
    }
    const loyaltyPoint = await LoyaltyPoint.create({
      ...getCreateData(req, { customer, customerName,
      transactionType: 'adjustment', points: Math.abs(points), balance: newBalance,
      description: description || `Adjustment: ${points > 0 ? '+' : ''}${points}`,
    }) });
    await Customer.findByIdAndUpdate(customer, { $set: { loyaltyPoints: newBalance } });
    res.status(201).json(loyaltyPoint);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getLoyaltyPoints, getCustomerBalance, earnPoints, redeemPoints, adjustPoints, EARNING_RATE };
