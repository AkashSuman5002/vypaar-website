const Transaction = require('../models/Transaction');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');

const getPaymentOuts = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { page = 1, limit = 50, search, dateFrom, dateTo } = req.query;
    const filter = { ...baseFilter, type: { $in: ['cash_out', 'bank_out'] } };
    if (search) {
      filter.$or = [
        { description: { $regex: search, $options: 'i' } },
        { partyName: { $regex: search, $options: 'i' } },
        { reference: { $regex: search, $options: 'i' } },
      ];
    }
    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom);
      if (dateTo) filter.date.$lte = new Date(dateTo + 'T23:59:59.999Z');
    }
    const total = await Transaction.countDocuments(filter);
    const payments = await Transaction.find(filter).sort({ date: -1 }).skip((page - 1) * limit).limit(parseInt(limit));
    res.json({ payments, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createPaymentOut = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { amount, description, date, paymentMethod, partyName, partyType, reference } = req.body;
    const txnType = paymentMethod === 'cash' ? 'cash_out' : 'bank_out';
    const payment = await Transaction.create({
      user: req.user._id, business: req.businessId, type: txnType, amount, description: description || 'Payment out',
      date: date || new Date(), reference: reference || '', referenceModel: 'PaymentOut',
      partyName: partyName || '', partyType: partyType || 'supplier',
    });
    res.status(201).json(payment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deletePaymentOut = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const payment = await Transaction.findById(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    if (payment.user.toString() !== req.user._id.toString()) return res.status(401).json({ message: 'Not authorized' });
    await Transaction.findByIdAndDelete(req.params.id);
    res.json({ message: 'Payment removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getPaymentOuts, createPaymentOut, deletePaymentOut };
