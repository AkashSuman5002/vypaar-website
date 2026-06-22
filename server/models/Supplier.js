const mongoose = require('mongoose');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

const supplierSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  name: { type: String, required: true, trim: true },
  phone: { type: String, trim: true },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    validate: { validator: v => !v || EMAIL_REGEX.test(v), message: 'Invalid email format' },
  },
  address: { type: String, trim: true },
  shippingAddress: { type: String, trim: true, default: '' },
  state: { type: String, trim: true, default: '' },
  pincode: {
    type: String,
    trim: true,
    default: '',
    validate: { validator: v => !v || PINCODE_REGEX.test(v), message: 'Invalid pincode format' },
  },
  gstNumber: {
    type: String,
    trim: true,
    validate: { validator: v => !v || GSTIN_REGEX.test(v), message: 'Invalid GST number format' },
  },
  openingBalance: { type: Number, default: 0 },
  creditLimit: { type: Number, default: 0 },
  dueDays: { type: Number, default: 30 },
  notes: { type: String, trim: true, default: '' },
  customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'PartyGroup', default: null },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

supplierSchema.index({ user: 1, name: 1 });
supplierSchema.index({ business: 1, name: 1 });
supplierSchema.index({ user: 1, createdAt: -1 });
supplierSchema.index({ business: 1, createdAt: -1 });

module.exports = mongoose.model('Supplier', supplierSchema);
