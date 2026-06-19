const Support = require('../models/Support');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');
const path = require('path');
const multer = require('multer');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `support-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|pdf|doc|docx|txt|csv|xlsx/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype.split('/')[1]) || file.mimetype.startsWith('text/');
    if (extOk || mimeOk) cb(null, true);
    else cb(new Error('File type not allowed. Supported: images, PDF, DOC, TXT, CSV, XLSX'));
  },
});

const createTicket = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    const attachment = req.file ? `/uploads/${req.file.filename}` : '';
    const ticket = await Support.create({
      ...getCreateData(req, {
        name,
        email,
        phone: phone || '',
        subject: subject || 'General Inquiry',
        message,
        attachment,
      }),
    });
    res.status(201).json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getMyTickets = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const tickets = await Support.find({ ...baseFilter }).sort({ createdAt: -1 });
    res.json({ success: true, tickets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getTicketById = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const ticket = await Support.findOne({ _id: req.params.id, ...baseFilter });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    res.json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const replyToTicket = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Reply message is required' });
    }
    const baseFilter = getBaseFilter(req);
    const ticket = await Support.findOne({ _id: req.params.id, ...baseFilter });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const attachment = req.file ? `/uploads/${req.file.filename}` : '';
    ticket.replies.push({
      sender: 'admin',
      senderName: req.user?.name || 'Support Team',
      message: message.trim(),
      attachment,
    });
    if (ticket.status === 'open') ticket.status = 'in_progress';
    await ticket.save();

    res.json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const userReplyToTicket = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Reply message is required' });
    }
    const baseFilter = getBaseFilter(req);
    const ticket = await Support.findOne({ _id: req.params.id, ...baseFilter });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const attachment = req.file ? `/uploads/${req.file.filename}` : '';
    ticket.replies.push({
      sender: 'user',
      senderName: ticket.name || 'You',
      message: message.trim(),
      attachment,
    });
    await ticket.save();

    res.json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createTicket, getMyTickets, getTicketById, replyToTicket, userReplyToTicket, upload };
