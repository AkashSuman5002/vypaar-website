const Notification = require('../models/Notification');
const { getBaseFilter } = require('../utils/queryHelper');

const getNotifications = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const notes = await Notification.find({ ...baseFilter }).sort({ createdAt: -1 }).limit(50);
    const unreadCount = await Notification.countDocuments({ ...baseFilter, read: false });
    res.json({ notifications: notes, unreadCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const markAsRead = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const note = await Notification.findOneAndUpdate(
      { _id: req.params.id, ...baseFilter },
      { read: true },
      { new: true }
    );
    if (!note) return res.status(404).json({ message: 'Notification not found' });
    res.json(note);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const markAllAsRead = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    await Notification.updateMany({ ...baseFilter, read: false }, { read: true });
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteNotification = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const note = await Notification.findOneAndDelete({ _id: req.params.id, ...baseFilter });
    if (!note) return res.status(404).json({ message: 'Notification not found' });
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const count = await Notification.countDocuments({ ...baseFilter, read: false });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createNotification = async (userId, type, title, message, referenceId, referenceModel) => {
  try {
    await Notification.create({ user: userId, type, title, message, referenceId, referenceModel });
  } catch (err) {
    console.error('Failed to create notification:', err.message);
  }
};

module.exports = { getNotifications, markAsRead, markAllAsRead, deleteNotification, getUnreadCount, createNotification };
