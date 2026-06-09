const mongoose = require('mongoose');

const whatsappSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  status: { type: String, enum: ['disconnected', 'qr_pending', 'connected', 'failed'], default: 'disconnected' },
  qrCode: { type: String, default: '' },
  phoneNumber: { type: String, default: '' },
  name: { type: String, default: '' },
  lastConnected: { type: Date },
  lastDisconnected: { type: Date },
  sessionData: { type: mongoose.Schema.Types.Mixed, default: null },
  failReason: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('WhatsAppSession', whatsappSessionSchema);
