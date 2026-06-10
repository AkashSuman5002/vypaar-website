const Supplier = require('../models/Supplier');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');
const { createNotification } = require('../controllers/notificationController');

const getSuppliers = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const suppliers = await Supplier.find({ ...baseFilter }).sort({ name: 1 });
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createSupplier = async (req, res) => {
  try {
    const {
      name, phone, email, address, openingBalance,
      shippingAddress, state, pincode, gstNumber,
      creditLimit, dueDays, notes, customFields,
    } = req.body;
    const supplier = await Supplier.create({
      ...getCreateData(req),
      name,
      phone,
      email,
      address,
      shippingAddress: shippingAddress || '',
      state: state || '',
      pincode: pincode || '',
      gstNumber,
      openingBalance: openingBalance || 0,
      creditLimit: creditLimit || 0,
      dueDays: dueDays || 30,
      notes: notes || '',
      customFields: customFields || {},
    });
    createNotification(req.user._id, 'party_added', 'New Supplier Added',
      `${name}${phone ? ` (${phone})` : ''} added to your party list`,
      supplier._id, 'Supplier'
    ).catch(() => {});
    res.status(201).json(supplier);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateSupplier = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const supplier = await Supplier.findOne({ ...baseFilter, _id: req.params.id });
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    const allowed = [
      'name', 'phone', 'email', 'address', 'shippingAddress', 'state', 'pincode',
      'gstNumber', 'openingBalance', 'creditLimit', 'dueDays', 'notes', 'customFields', 'isActive',
    ];
    const patch = {};
    for (const k of allowed) if (req.body[k] !== undefined) patch[k] = req.body[k];
    const updated = await Supplier.findOneAndUpdate({ _id: req.params.id, ...baseFilter }, patch, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteSupplier = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const supplier = await Supplier.findOne({ ...baseFilter, _id: req.params.id });
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    await Supplier.findOneAndDelete({ _id: req.params.id, ...baseFilter });
    res.json({ message: 'Supplier removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getSupplierById = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const supplier = await Supplier.findOne({ ...baseFilter, _id: req.params.id });
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getSuppliers, getSupplierById, createSupplier, updateSupplier, deleteSupplier };
