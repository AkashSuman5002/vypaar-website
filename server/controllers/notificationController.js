const Notification = require('../models/Notification');
const Setting = require('../models/Setting');
const pushNotificationService = require('../services/pushNotificationService');

const getNotifications = async (req, res) => {
  try {
    const filter = { user: req.user._id };
    const notes = await Notification.find(filter).sort({ createdAt: -1 }).limit(50);
    const unreadCount = await Notification.countDocuments({ ...filter, read: false });
    res.json({ notifications: notes, unreadCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const markAsRead = async (req, res) => {
  try {
    const note = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
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
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteNotification = async (req, res) => {
  try {
    const note = await Notification.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!note) return res.status(404).json({ message: 'Notification not found' });
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// "Clear all" must permanently remove notifications, not just mark them read —
// otherwise getNotifications() (which returns read + unread) re-shows them on reload.
const clearAllNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ user: req.user._id });
    res.json({ message: 'All notifications cleared' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ user: req.user._id, read: false });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createNotification = async (userId, type, title, message, referenceId, referenceModel) => {
  try {
    const settings = await Setting.findOne({ user: userId });
    const notifPrefs = settings?.preferences?.notifications;
    if (notifPrefs) {
      if (notifPrefs.enableNotifications === false) return;
      if (notifPrefs[type] === false) return;
    }
    await Notification.create({ user: userId, type, title, message, referenceId, referenceModel });
  } catch (err) {
    console.error('Failed to create notification:', err.message);
  }
};

const getVapidPublicKey = async (req, res) => {
  try {
    res.json({ publicKey: pushNotificationService.getVapidPublicKey() });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const subscribePush = async (req, res) => {
  try {
    const subscription = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ message: 'Invalid subscription' });
    }
    pushNotificationService.saveSubscription(req.user._id, subscription);
    res.status(201).json({ message: 'Subscribed to push notifications' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const unsubscribePush = async (req, res) => {
  try {
    pushNotificationService.removeSubscription(req.user._id);
    res.json({ message: 'Unsubscribed from push notifications' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getNotifications, markAsRead, markAllAsRead, deleteNotification, clearAllNotifications, getUnreadCount, createNotification, getVapidPublicKey, subscribePush, unsubscribePush };
