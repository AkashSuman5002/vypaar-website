const Support = require('../models/support');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');

const createTicket = async (req, res) => {
  try {
    const { name, email, phone, subject, message, attachment } = req.body;
    const ticket = await Support.create({
      ...getCreateData(req, {
      name,
      email,
      phone: phone || '',
      subject: subject || 'General Inquiry',
      message,
      attachment: attachment || '',
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

module.exports = { createTicket, getMyTickets, getTicketById };
