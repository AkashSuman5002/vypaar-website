const mongoose = require('mongoose');

const serviceReminderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  name: { type: String, trim: true, default: 'Service Reminder' },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, trim: true },
  }],
  servicePeriod: { type: Number, required: true, min: 1 },
  sendRemindersTo: { type: String, enum: ['only_me', 'party', 'both'], default: 'only_me' },
  isActive: { type: Boolean, default: true },
  lastSentAt: { type: Date },
  nextReminderAt: { type: Date },
}, { timestamps: true });

serviceReminderSchema.index({ user: 1, isActive: 1 });
serviceReminderSchema.index({ user: 1, nextReminderAt: 1 });

module.exports = mongoose.model('ServiceReminder', serviceReminderSchema);
