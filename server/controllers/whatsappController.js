const { startSession, disconnectSession, getConnectionStatus } = require('../services/whatsappService');
const { sendManualMessage, defaultTemplates } = require('../services/messageService');
const WhatsAppMessage = require('../models/WhatsAppMessage');
const Setting = require('../models/Setting');
const { getBaseFilter } = require('../utils/queryHelper');

const qrListeners = new Map();
const latestQR = new Map();

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
    console.log(`[WhatsApp] Connect request from user ${userId}`);

    const onQR = (qr) => {
      console.log(`[WhatsApp] QR callback fired for user ${userId}`);
      latestQR.set(userId, qr);
      const listeners = qrListeners.get(userId);
      if (listeners) {
        console.log(`[WhatsApp] Sending QR to ${listeners.size} listeners`);
        listeners.forEach(cb => cb({ type: 'qr', data: qr }));
      } else {
        console.log(`[WhatsApp] No listeners for user ${userId}, QR cached`);
      }
    };

    const onStatus = (status) => {
      console.log(`[WhatsApp] Status callback fired for user ${userId}: ${status}`);
      latestQR.delete(userId);
      const listeners = qrListeners.get(userId);
      if (listeners) {
        listeners.forEach(cb => cb({ type: 'status', data: { status } }));
      }
    };

    const result = await startSession(userId, onQR, onStatus);
    console.log(`[WhatsApp] startSession result for user ${userId}:`, result.status);
    res.json(result);
  } catch (error) {
    console.error(`[WhatsApp] Connect error for user ${req.user._id}:`, error.message);
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
  console.log(`[WhatsApp] SSE stream opened for user ${userId}`);

  if (!qrListeners.has(userId)) {
    qrListeners.set(userId, new Set());
  }
  const listener = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };
  qrListeners.get(userId).add(listener);
  console.log(`[WhatsApp] Listener added for user ${userId}, total: ${qrListeners.get(userId).size}`);

  const cached = latestQR.get(userId);
  if (cached) {
    console.log(`[WhatsApp] Sending cached QR to user ${userId}`);
    res.write(`data: ${JSON.stringify({ type: 'qr', data: cached })}\n\n`);
  }

  const status = await getConnectionStatus(userId);
  console.log(`[WhatsApp] Sending initial status to user ${userId}: ${status.status}`);
  res.write(`data: ${JSON.stringify({ type: 'status', data: status })}\n\n`);

  req.on('close', () => {
    const listeners = qrListeners.get(userId);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        qrListeners.delete(userId);
      }
    }
    console.log(`[WhatsApp] SSE stream closed for user ${userId}`);
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
    const filter = getBaseFilter(req);
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
    const baseFilter = getBaseFilter(req);
    const total = await WhatsAppMessage.countDocuments(baseFilter);
    const sent = await WhatsAppMessage.countDocuments({ ...baseFilter, status: 'sent' });
    const failed = await WhatsAppMessage.countDocuments({ ...baseFilter, status: 'failed' });
    const pending = await WhatsAppMessage.countDocuments({ ...baseFilter, status: 'pending' });
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
