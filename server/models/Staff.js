const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  name: { type: String, required: true, trim: true },
  phone: { type: String, trim: true },
  email: { type: String, trim: true },
  role: { type: String, enum: ['salesman', 'manager', 'accountant', 'admin'], default: 'salesman' },
  isActive: { type: Boolean, default: true },
  commissionRate: { type: Number, default: 0 },
  notes: { type: String, trim: true },
}, { timestamps: true });

staffSchema.index({ user: 1, name: 1 });

module.exports = mongoose.model('Staff', staffSchema);
