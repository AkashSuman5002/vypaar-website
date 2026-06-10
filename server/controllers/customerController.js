const Customer = require('../models/Customer');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');
const { createNotification } = require('../controllers/notificationController');

const getCustomers = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const customers = await Customer.find({ ...baseFilter }).sort({ createdAt: -1 });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createCustomer = async (req, res) => {
  try {
    const {
      name, phone, email, address, openingBalance,
      shippingAddress, state, pincode, gstNumber,
      creditLimit, dueDays, notes, customFields,
    } = req.body;
    const customer = await Customer.create({
      ...getCreateData(req),
      name,
      phone,
      email,
      address,
      shippingAddress: shippingAddress || '',
      state: state || '',
      pincode: pincode || '',
      gstNumber,
      openingBalance,
      creditLimit: creditLimit || 0,
      dueDays: dueDays || 30,
      notes: notes || '',
      customFields: customFields || {},
    });
    createNotification(req.user._id, 'party_added', 'New Customer Added',
      `${name}${phone ? ` (${phone})` : ''} added to your party list`,
      customer._id, 'Customer'
    ).catch(() => {});
    res.status(201).json(customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateCustomer = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const customer = await Customer.findOne({ ...baseFilter, _id: req.params.id });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    const allowed = [
      'name', 'phone', 'email', 'address', 'shippingAddress', 'state', 'pincode',
      'gstNumber', 'openingBalance', 'creditLimit', 'dueDays', 'notes', 'customFields', 'isActive',
    ];
    const patch = {};
    for (const k of allowed) if (req.body[k] !== undefined) patch[k] = req.body[k];
    const updated = await Customer.findOneAndUpdate({ _id: req.params.id, ...baseFilter }, patch, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteCustomer = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const customer = await Customer.findOne({ ...baseFilter, _id: req.params.id });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    await Customer.findOneAndDelete({ _id: req.params.id, ...baseFilter });
    res.json({ message: 'Customer removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getCustomerById = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const customer = await Customer.findOne({ ...baseFilter, _id: req.params.id });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer };
