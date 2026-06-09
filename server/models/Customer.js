const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
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
  type: { type: String, enum: ['customer', 'supplier', 'both'], default: 'customer' },
  salesman: { type: String, trim: true, default: '' },
  openingBalance: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  totalSales: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  creditLimit: { type: Number, default: 0 },
  dueDays: { type: Number, default: 30 },
  notes: { type: String, trim: true, default: '' },
  customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

customerSchema.index({ user: 1, name: 1 });
customerSchema.index({ user: 1, phone: 1 });
customerSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Customer', customerSchema);
