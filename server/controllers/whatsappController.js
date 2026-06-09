const { startSession, disconnectSession, getConnectionStatus } = require('../services/whatsappService');
const { sendManualMessage, defaultTemplates } = require('../services/messageService');
const WhatsAppMessage = require('../models/WhatsAppMessage');
const Setting = require('../models/Setting');

const qrListeners = new Map();

const getStatus = async (req, res) => {
  try {
    const status = await getConnectionStatus(req.user._id);
    res.json(status);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const connect = async (req, res) => {
  try {
    const userId = req.user._id.toString();

    const onQR = (qr) => {
      const listeners = qrListeners.get(userId);
      if (listeners) {
        listeners.forEach(cb => cb(qr));
      }
    };

    const onStatus = (status) => {
      const listeners = qrListeners.get(userId);
      if (listeners) {
        listeners.forEach(cb => cb(status));
      }
    };

    const result = await startSession(userId, onQR, onStatus);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const disconnect = async (req, res) => {
  try {
    const result = await disconnectSession(req.user._id.toString());
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const qrStream = async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const userId = req.user._id.toString();

  if (!qrListeners.has(userId)) {
    qrListeners.set(userId, new Set());
  }
  qrListeners.get(userId).add((data) => {
    res.write(`data: ${JSON.stringify({ type: 'qr', data })}\n\n`);
  });

  const status = await getConnectionStatus(userId);
  res.write(`data: ${JSON.stringify({ type: 'status', data: status })}\n\n`);

  req.on('close', () => {
    const listeners = qrListeners.get(userId);
    if (listeners) {
      listeners.clear();
      qrListeners.delete(userId);
    }
  });
};

const send = async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ message: 'Phone and message are required' });
    }
    const result = await sendManualMessage(req.user._id, req.businessId, phone, message);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getMessages = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, type } = req.query;
    const filter = { user: req.user._id };
    if (status) filter.status = status;
    if (type) filter.transactionType = type;

    const total = await WhatsAppMessage.countDocuments(filter);
    const messages = await WhatsAppMessage.find(filter)
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    res.json({ messages, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getMessageStats = async (req, res) => {
  try {
    const total = await WhatsAppMessage.countDocuments({ user: req.user._id });
    const sent = await WhatsAppMessage.countDocuments({ user: req.user._id, status: 'sent' });
    const failed = await WhatsAppMessage.countDocuments({ user: req.user._id, status: 'failed' });
    const pending = await WhatsAppMessage.countDocuments({ user: req.user._id, status: 'pending' });
    res.json({ total, sent, failed, pending });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getTemplates = async (req, res) => {
  try {
    const settings = await Setting.findOne({ user: req.user._id });
    const customTemplates = settings?.preferences?.transactionMessage?.templates || {};
    res.json({ templates: { ...defaultTemplates, ...customTemplates } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const saveTemplates = async (req, res) => {
  try {
    const { templates } = req.body;
    if (!templates) return res.status(400).json({ message: 'Templates required' });

    let settings = await Setting.findOne({ user: req.user._id });
    if (!settings) settings = await Setting.create({ user: req.user._id });

    if (!settings.preferences) settings.preferences = {};
    if (!settings.preferences.transactionMessage) settings.preferences.transactionMessage = {};
    settings.preferences.transactionMessage.templates = templates;
    await settings.save();

    res.json({ success: true, templates: { ...defaultTemplates, ...templates } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getStatus, connect, disconnect, qrStream, send,
  getMessages, getMessageStats, getTemplates, saveTemplates,
};
