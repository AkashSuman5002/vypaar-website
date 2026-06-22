const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
  sender: { type: String, enum: ['user', 'admin'], required: true },
  senderName: { type: String, default: '' },
  message: { type: String, required: true },
  attachment: { type: String, default: '' },
}, { timestamps: true });

const supportSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, default: '' },
  subject: { type: String, default: 'General Inquiry' },
  message: { type: String, required: true },
  attachment: { type: String, default: '' },
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
  replies: [replySchema],
}, { timestamps: true });

module.exports = mongoose.model('Support', supportSchema);
