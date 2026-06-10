const Staff = require('../models/Staff');
const Sale = require('../models/Sale');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');

const getStaff = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { page = 1, limit = 50, search, role } = req.query;
    const filter = { ...baseFilter, isActive: true };
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    const total = await Staff.countDocuments(filter);
    const staff = await Staff.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(parseInt(limit));
    res.json({ staff, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createStaff = async (req, res) => {
  try {
    const { name, phone, email, role, commissionRate, notes } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });
    const staff = await Staff.create(getCreateData(req, { name, phone, email, role, commissionRate, notes }));
    res.status(201).json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateStaff = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const staff = await Staff.findOne({ ...baseFilter, _id: req.params.id });
    if (!staff) return res.status(404).json({ message: 'Staff not found' });
    const allowedFields = ['name', 'phone', 'email', 'role', 'commissionRate', 'notes', 'isActive'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    const updated = await Staff.findOneAndUpdate({ _id: req.params.id, ...baseFilter }, updates, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteStaff = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const staff = await Staff.findOne({ ...baseFilter, _id: req.params.id });
    if (!staff) return res.status(404).json({ message: 'Staff not found' });
    staff.isActive = false;
    await staff.save();
    res.json({ message: 'Staff deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getStaffStats = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const staff = await Staff.findOne({ ...baseFilter, _id: req.params.id });
    if (!staff) return res.status(404).json({ message: 'Staff not found' });

    const { dateFrom, dateTo } = req.query;
    const saleFilter = { ...baseFilter, salesman: staff.name };
    if (dateFrom || dateTo) {
      saleFilter.date = {};
      if (dateFrom) saleFilter.date.$gte = new Date(dateFrom);
      if (dateTo) saleFilter.date.$lte = new Date(dateTo + 'T23:59:59.999Z');
    }

    const sales = await Sale.find(saleFilter);
    const totalSalesCount = sales.length;
    const totalSalesAmount = sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const totalPendingDues = sales.reduce((sum, s) => sum + (s.remainingBalance || 0), 0);

    res.json({ staff, totalSalesCount, totalSalesAmount, totalPendingDues });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getStaff, createStaff, updateStaff, deleteStaff, getStaffStats };
