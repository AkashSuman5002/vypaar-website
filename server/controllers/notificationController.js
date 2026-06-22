const Notification = require('../models/Notification');
const Setting = require('../models/Setting');
const pushNotificationService = require('../services/pushNotificationService');
const { sendEmailNotification } = require('../services/emailService');
const { sendSMSNotification } = require('../services/smsService');

// Maps an in-app notification type to a target route for push deep-linking.
const TYPE_URL = {
  new_sale: '/sales',
  sale_cancelled: '/sales',
  sale_return: '/sales/returns',
  new_purchase: '/purchases',
  purchase_cancelled: '/purchases',
  purchase_updated: '/purchases',
  purchase_deleted: '/purchases',
  purchase_return: '/purchases/returns',
  payment_received: '/sales/payments',
  payment_due: '/sales/payments',
  payment_out: '/purchases/payments',
  payment_out_deleted: '/purchases/payments',
  low_stock: '/products',
  expense_created: '/expenses',
  expense_updated: '/expenses',
  expense_deleted: '/expenses',
  party_added: '/parties',
  bank_transaction: '/cash-and-bank',
  service_reminder: '/parties',
};

// The cron-based paymentReminderService already sends an SMS for overdue
// invoices. Suppress the SMS channel here for that event type to avoid a
// duplicate text; email + push still dispatch (the cron sends neither).
const SMS_SUPPRESS_TYPES = new Set(['payment_due']);

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
      // Master switch + per-event toggle gate the entire notification, including
      // every outbound channel (in-app, email, SMS, push).
      if (notifPrefs.enableNotifications === false) return;
      if (notifPrefs[type] === false) return;
    }

    // 1) Always persist the in-app notification.
    await Notification.create({ user: userId, type, title, message, referenceId, referenceModel });

    // 2) Best-effort fan-out to the configured external channels. Each service
    //    independently re-checks its own `enabled` flag and per-event toggle
    //    (preferences.notifications.{email,sms,push}.*), so we just hand off and
    //    swallow any failure so a broken channel never breaks notification flow.
    const subject = title || 'Notification';
    const body = message || title || '';

    // Email -> user's own business email on file.
    const email = settings?.email;
    if (email) {
      sendEmailNotification(
        userId,
        { to: email, subject, text: body, html: `<p>${body}</p>` },
        type
      ).catch(err => console.error('[Notify:email] Failed:', err.message));
    }

    // SMS -> user's own phone on file (suppressed for events dispatched elsewhere).
    const phone = settings?.phone;
    if (phone && !SMS_SUPPRESS_TYPES.has(type)) {
      sendSMSNotification(
        userId,
        { to: phone, message: `${subject}: ${body}` },
        type
      ).catch(err => console.error('[Notify:sms] Failed:', err.message));
    }

    // Push -> active web-push subscription for this user.
    pushNotificationService
      .sendPushNotification(userId, { title: subject, body, url: TYPE_URL[type] || '/' }, type)
      .catch(err => console.error('[Notify:push] Failed:', err.message));
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
    await pushNotificationService.saveSubscription(req.user._id, subscription);
    res.status(201).json({ message: 'Subscribed to push notifications' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const unsubscribePush = async (req, res) => {
  try {
    await pushNotificationService.removeSubscription(req.user._id, req.body?.endpoint);
    res.json({ message: 'Unsubscribed from push notifications' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getNotifications, markAsRead, markAllAsRead, deleteNotification, clearAllNotifications, getUnreadCount, createNotification, getVapidPublicKey, subscribePush, unsubscribePush };
