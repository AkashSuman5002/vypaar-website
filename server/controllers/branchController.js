const Branch = require('../models/Branch');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');

const getAll = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const branches = await Branch.find({ ...baseFilter, isActive: true }).sort({ isDefault: -1, name: 1 });
    res.json(branches);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getById = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const branch = await Branch.findOne({ _id: req.params.id, ...baseFilter });
    if (!branch) return res.status(404).json({ message: 'Branch not found' });
    res.json(branch);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const create = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { name, code, address, city, state, phone, email, gstNumber, isDefault } = req.body;
    if (!name) return res.status(400).json({ message: 'Branch name is required' });
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await Branch.findOne({ ...baseFilter, name: new RegExp(`^${escaped}$`, 'i') });
    if (existing) return res.status(400).json({ message: 'Branch with this name already exists' });
    if (isDefault) {
      await Branch.updateMany({ ...baseFilter, isDefault: true }, { isDefault: false });
    }
    const branch = await Branch.create({
      ...getCreateData(req, { name, code, address, city, state, phone, email, gstNumber, isDefault }),
    });
    res.status(201).json(branch);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const update = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const branch = await Branch.findOne({ _id: req.params.id, ...baseFilter });
    if (!branch) return res.status(404).json({ message: 'Branch not found' });
    const fields = ['name', 'code', 'address', 'city', 'state', 'phone', 'email', 'gstNumber', 'isActive', 'isDefault'];
    for (const field of fields) {
      if (req.body[field] !== undefined) branch[field] = req.body[field];
    }
    if (req.body.isDefault) {
      await Branch.updateMany({ ...baseFilter, _id: { $ne: branch._id } }, { isDefault: false });
    }
    await branch.save();
    res.json(branch);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const remove = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const branch = await Branch.findOneAndUpdate(
      { _id: req.params.id, ...baseFilter },
      { isActive: false },
      { new: true }
    );
    if (!branch) return res.status(404).json({ message: 'Branch not found' });
    res.json({ message: 'Branch deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getAll, getById, create, update, remove };
