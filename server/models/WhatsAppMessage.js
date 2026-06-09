const mongoose = require('mongoose');

const whatsappMessageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business' },
  direction: { type: String, enum: ['outgoing', 'incoming'], required: true },
  to: { type: String, required: true },
  from: { type: String, default: '' },
  message: { type: String, required: true },
  type: { type: String, enum: ['text', 'image', 'document', 'template'], default: 'text' },
  status: { type: String, enum: ['pending', 'sent', 'delivered', 'read', 'failed'], default: 'pending' },
  referenceType: { type: String, enum: ['Sale', 'Purchase', 'Receipt', 'PaymentOut', 'manual'] },
  referenceId: { type: mongoose.Schema.Types.ObjectId },
  referenceNumber: { type: String, trim: true },
  transactionType: { type: String },
  failReason: { type: String, default: '' },
  sentAt: { type: Date },
  deliveredAt: { type: Date },
  readAt: { type: Date },
}, { timestamps: true });

whatsappMessageSchema.index({ user: 1, createdAt: -1 });
whatsappMessageSchema.index({ user: 1, status: 1 });
whatsappMessageSchema.index({ user: 1, referenceType: 1, referenceId: 1 });

module.exports = mongoose.model('WhatsAppMessage', whatsappMessageSchema);
