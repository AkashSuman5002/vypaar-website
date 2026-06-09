const Godown = require('../models/Godown');
const Product = require('../models/Product');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');

const getGodowns = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const godowns = await Godown.find({ ...baseFilter }).sort({ name: 1 });
    const godownsWithStock = await Promise.all(godowns.map(async (g) => {
      const obj = g.toObject();
      obj.productCount = await Product.countDocuments({ ...baseFilter, godown: g._id, isActive: true });
      return obj;
    }));
    res.json(godownsWithStock);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createGodown = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { name, code, address, city, state, phone, email, managerName, capacity, notes } = req.body;
    if (!name) return res.status(400).json({ message: 'Godown name is required' });
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await Godown.findOne({ ...baseFilter, name: new RegExp(`^${escaped}$`, 'i') });
    if (existing) return res.status(400).json({ message: 'Godown with this name already exists' });
    const godown = await Godown.create({
      ...getCreateData(req, { name, code, address, city, state, phone, email, managerName, capacity, notes }),
    });
    res.status(201).json(godown);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateGodown = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const godown = await Godown.findOne({ _id: req.params.id, ...baseFilter });
    if (!godown) return res.status(404).json({ message: 'Godown not found' });
    const fields = ['name', 'code', 'address', 'city', 'state', 'phone', 'email', 'managerName', 'capacity', 'notes', 'isActive', 'isDefault'];
    for (const field of fields) {
      if (req.body[field] !== undefined) godown[field] = req.body[field];
    }
    if (req.body.isDefault) {
      await Godown.updateMany({ ...baseFilter, _id: { $ne: godown._id } }, { isDefault: false });
    }
    await godown.save();
    res.json(godown);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteGodown = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const godown = await Godown.findOne({ _id: req.params.id, ...baseFilter });
    if (!godown) return res.status(404).json({ message: 'Godown not found' });
    const productCount = await Product.countDocuments({ ...baseFilter, godown: godown._id, isActive: true });
    if (productCount > 0) {
      return res.status(400).json({ message: `Cannot delete: ${productCount} products are assigned to this godown` });
    }
    await Godown.findByIdAndDelete(req.params.id);
    res.json({ message: 'Godown deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getGodowns, createGodown, updateGodown, deleteGodown };
