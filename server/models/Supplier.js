const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  name: { type: String, required: true, trim: true },
  phone: { type: String, trim: true },
  email: { type: String, lowercase: true, trim: true },
  address: { type: String, trim: true },
  shippingAddress: { type: String, trim: true, default: '' },
  state: { type: String, trim: true, default: '' },
  pincode: { type: String, trim: true, default: '' },
  gstNumber: { type: String, trim: true },
  openingBalance: { type: Number, default: 0 },
  creditLimit: { type: Number, default: 0 },
  dueDays: { type: Number, default: 30 },
  notes: { type: String, trim: true, default: '' },
  customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

supplierSchema.index({ user: 1, name: 1 });
supplierSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Supplier', supplierSchema);
