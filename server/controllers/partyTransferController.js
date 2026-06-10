const PartyToPartyTransfer = require('../models/PartyToPartyTransfer');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Transaction = require('../models/Transaction');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');

const getPartyTransfers = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { page = 1, limit = 50 } = req.query;
    const filter = { ...baseFilter };
    const total = await PartyToPartyTransfer.countDocuments(filter);
    const transfers = await PartyToPartyTransfer.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit));
    res.json({ transfers, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPartyTransferById = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const transfer = await PartyToPartyTransfer.findById(req.params.id);
    if (!transfer) return res.status(404).json({ message: 'Transfer not found' });
    if (transfer.user.toString() !== req.user._id.toString()) return res.status(401).json({ message: 'Not authorized' });
    res.json(transfer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createPartyTransfer = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { fromPartyType, fromParty, fromPartyName, toPartyType, toParty, toPartyName, amount, date, notes } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid transfer amount' });

    const transfer = await PartyToPartyTransfer.create({
      ...getCreateData(req, { fromPartyType, fromParty, fromPartyName, toPartyType, toParty, toPartyName,
      amount, date: date || new Date(), notes }),
    });

    const transferDesc = `Transfer ${amount} from ${fromPartyName} (${fromPartyType}) to ${toPartyName} (${toPartyType})`;

    if (fromPartyType === 'customer') {
      await Customer.findByIdAndUpdate({ _id: fromParty, user: req.user._id }, { $inc: { openingBalance: -amount } });
    } else {
      await Supplier.findByIdAndUpdate({ _id: fromParty, user: req.user._id }, { $inc: { openingBalance: -amount } });
    }

    if (toPartyType === 'customer') {
      await Customer.findByIdAndUpdate({ _id: toParty, user: req.user._id }, { $inc: { openingBalance: amount } });
    } else {
      await Supplier.findByIdAndUpdate({ _id: toParty, user: req.user._id }, { $inc: { openingBalance: amount } });
    }

    await Transaction.create({
      ...getCreateData(req, { type: 'bank_out', amount,
      description: `Party transfer - ${transferDesc}`,
      date: date || new Date(), reference: transfer._id, referenceModel: 'PartyToPartyTransfer', referenceId: transfer._id,
      partyName: fromPartyName, partyType: fromPartyType }),
    });

    await Transaction.create({
      ...getCreateData(req, { type: 'bank_in', amount,
      description: `Party transfer - ${transferDesc}`,
      date: date || new Date(), reference: transfer._id, referenceModel: 'PartyToPartyTransfer', referenceId: transfer._id,
      partyName: toPartyName, partyType: toPartyType }),
    });

    res.status(201).json(transfer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deletePartyTransfer = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const transfer = await PartyToPartyTransfer.findById(req.params.id);
    if (!transfer) return res.status(404).json({ message: 'Transfer not found' });
    if (transfer.user.toString() !== req.user._id.toString()) return res.status(401).json({ message: 'Not authorized' });

    if (transfer.fromPartyType === 'customer') {
      await Customer.findByIdAndUpdate({ _id: transfer.fromParty, user: req.user._id }, { $inc: { openingBalance: transfer.amount } });
    } else {
      await Supplier.findByIdAndUpdate({ _id: transfer.fromParty, user: req.user._id }, { $inc: { openingBalance: transfer.amount } });
    }

    if (transfer.toPartyType === 'customer') {
      await Customer.findByIdAndUpdate({ _id: transfer.toParty, user: req.user._id }, { $inc: { openingBalance: -transfer.amount } });
    } else {
      await Supplier.findByIdAndUpdate({ _id: transfer.toParty, user: req.user._id }, { $inc: { openingBalance: -transfer.amount } });
    }

    await PartyToPartyTransfer.findOneAndDelete({ _id: req.params.id, ...getBaseFilter(req) });
    res.json({ message: 'Transfer removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getPartyTransfers, getPartyTransferById, createPartyTransfer, deletePartyTransfer };
