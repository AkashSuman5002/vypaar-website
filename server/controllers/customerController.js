const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
const Receipt = require('../models/Receipt');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');
const { createNotification } = require('../controllers/notificationController');

const getCustomers = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { search, page = 1, limit = 50 } = req.query;

    let filter = { ...baseFilter };
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Customer.countDocuments(filter);
    const customers = await Customer.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      data: customers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createCustomer = async (req, res) => {
  try {
    const {
      name, phone, email, address, openingBalance,
      shippingAddress, state, pincode, gstNumber,
      creditLimit, dueDays, notes, customFields, group,
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
      group: group || null,
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
      'gstNumber', 'openingBalance', 'creditLimit', 'dueDays', 'notes', 'customFields', 'group', 'isActive',
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

    // Referential delete-guard: refuse to delete a customer that is referenced
    // by historical documents, which would orphan those references.
    const [sales, receipts] = await Promise.all([
      Sale.countDocuments({ ...baseFilter, customer: req.params.id }),
      Receipt.countDocuments({ ...baseFilter, customer: req.params.id }),
    ]);
    const total = sales + receipts;
    if (total > 0) {
      return res.status(409).json({
        message: `Customer cannot be deleted because it is used in ${total} transaction(s). Mark it inactive instead.`,
        references: { sales, receipts },
      });
    }

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
