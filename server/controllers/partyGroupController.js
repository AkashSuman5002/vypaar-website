const PartyGroup = require('../models/PartyGroup');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');

const getPartyGroups = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { type } = req.query;
    const filter = { ...baseFilter };
    if (type && type !== 'all') filter.type = type;
    const groups = await PartyGroup.find(filter).sort({ name: 1 });
    res.json(groups);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createPartyGroup = async (req, res) => {
  try {
    const { name, type, description, color } = req.body;
    const group = await PartyGroup.create({
      ...getCreateData(req),
      name,
      type: type || 'both',
      description: description || '',
      color: color || '#3B82F6',
    });
    res.status(201).json(group);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A group with this name already exists' });
    }
    res.status(500).json({ message: error.message });
  }
};

const updatePartyGroup = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const group = await PartyGroup.findOne({ ...baseFilter, _id: req.params.id });
    if (!group) return res.status(404).json({ message: 'Party group not found' });
    const allowed = ['name', 'type', 'description', 'color', 'isActive'];
    const patch = {};
    for (const k of allowed) if (req.body[k] !== undefined) patch[k] = req.body[k];
    const updated = await PartyGroup.findOneAndUpdate({ _id: req.params.id, ...baseFilter }, patch, { new: true });
    res.json(updated);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A group with this name already exists' });
    }
    res.status(500).json({ message: error.message });
  }
};

const deletePartyGroup = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const group = await PartyGroup.findOne({ ...baseFilter, _id: req.params.id });
    if (!group) return res.status(404).json({ message: 'Party group not found' });
    await PartyGroup.findOneAndDelete({ _id: req.params.id, ...baseFilter });
    await Customer.updateMany({ group: req.params.id }, { $set: { group: null } });
    await Supplier.updateMany({ group: req.params.id }, { $set: { group: null } });
    res.json({ message: 'Party group removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPartyGroupSummary = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const groups = await PartyGroup.find({ ...baseFilter, isActive: true }).sort({ name: 1 });
    const summary = await Promise.all(groups.map(async (g) => {
      const customerCount = await Customer.countDocuments({ ...baseFilter, group: g._id, isActive: true });
      const supplierCount = await Supplier.countDocuments({ ...baseFilter, group: g._id, isActive: true });
      const customerIds = (await Customer.find({ ...baseFilter, group: g._id, isActive: true }).select('_id').lean()).map(c => c._id);
      const supplierIds = (await Supplier.find({ ...baseFilter, group: g._id, isActive: true }).select('_id').lean()).map(s => s._id);
      let totalSales = 0;
      let totalPurchases = 0;
      if (customerIds.length > 0) {
        const salesAgg = await Sale.aggregate([
          { $match: { ...baseFilter, customer: { $in: customerIds }, status: { $ne: 'cancelled' } } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]);
        totalSales = salesAgg[0]?.total || 0;
      }
      if (supplierIds.length > 0) {
        const purchaseAgg = await Purchase.aggregate([
          { $match: { ...baseFilter, supplier: { $in: supplierIds }, status: { $ne: 'cancelled' } } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]);
        totalPurchases = purchaseAgg[0]?.total || 0;
      }
      return {
        _id: g._id,
        name: g.name,
        type: g.type,
        color: g.color,
        description: g.description,
        customerCount,
        supplierCount,
        totalSales,
        totalPurchases,
      };
    }));
    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getPartyGroups, createPartyGroup, updatePartyGroup, deletePartyGroup, getPartyGroupSummary };
