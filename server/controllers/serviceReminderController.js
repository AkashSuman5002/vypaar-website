const ServiceReminder = require('../models/ServiceReminder');
const Product = require('../models/Product');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');

const getReminders = async (req, res) => {
  try {
    const filter = getBaseFilter(req);
    const reminders = await ServiceReminder.find(filter)
      .sort({ createdAt: -1 })
      .populate('items.product', 'name price unit');
    res.json({ reminders });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getReminder = async (req, res) => {
  try {
    const filter = getBaseFilter(req);
    const reminder = await ServiceReminder.findOne({ ...filter, _id: req.params.id })
      .populate('items.product', 'name price unit');
    if (!reminder) return res.status(404).json({ message: 'Reminder not found' });
    res.json({ reminder });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createReminder = async (req, res) => {
  try {
    const data = getCreateData(req, {
      name: req.body.name || 'Service Reminder',
      items: req.body.items || [],
      servicePeriod: req.body.servicePeriod,
      sendRemindersTo: req.body.sendRemindersTo || 'only_me',
      isActive: req.body.isActive !== false,
    });

    if (data.servicePeriod) {
      const now = new Date();
      data.nextReminderAt = new Date(now.getTime() + data.servicePeriod * 24 * 60 * 60 * 1000);
    }

    const reminder = await ServiceReminder.create(data);
    res.status(201).json({ reminder });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const updateReminder = async (req, res) => {
  try {
    const filter = getBaseFilter(req);
    const updates = {};
    const allowed = ['name', 'items', 'servicePeriod', 'sendRemindersTo', 'isActive'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (updates.servicePeriod) {
      const now = new Date();
      updates.nextReminderAt = new Date(now.getTime() + updates.servicePeriod * 24 * 60 * 60 * 1000);
    }

    const reminder = await ServiceReminder.findOneAndUpdate(
      { ...filter, _id: req.params.id },
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('items.product', 'name price unit');

    if (!reminder) return res.status(404).json({ message: 'Reminder not found' });
    res.json({ reminder });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const deleteReminder = async (req, res) => {
  try {
    const filter = getBaseFilter(req);
    const reminder = await ServiceReminder.findOneAndDelete({ ...filter, _id: req.params.id });
    if (!reminder) return res.status(404).json({ message: 'Reminder not found' });
    res.json({ message: 'Reminder deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getItemsForReminder = async (req, res) => {
  try {
    const filter = getBaseFilter(req);
    const { search, type } = req.query;

    const query = { ...filter, isActive: true };
    if (search) query.name = { $regex: search, $options: 'i' };
    if (type && type !== 'all') {
      query.type = type === 'services' ? 'service' : 'product';
    }

    const products = await Product.find(query)
      .select('name price unit sku barcode type')
      .sort({ name: 1 })
      .limit(200);

    res.json({ items: products });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getReminders,
  getReminder,
  createReminder,
  updateReminder,
  deleteReminder,
  getItemsForReminder,
};
