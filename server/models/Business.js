const mongoose = require('mongoose');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

const businessSchema = mongoose.Schema({
  name: { type: String, required: true },
  email: {
    type: String,
    validate: { validator: v => !v || EMAIL_REGEX.test(v), message: 'Invalid email format' },
  },
  phone: { type: String },
  address: { type: String },
  gstNumber: {
    type: String,
    validate: { validator: v => !v || GSTIN_REGEX.test(v), message: 'Invalid GST number format' },
  },
  panNumber: {
    type: String,
    validate: { validator: v => !v || PAN_REGEX.test(v), message: 'Invalid PAN number format' },
  },
  businessType: { type: String, enum: ['retail', 'wholesale', 'manufacturing', 'service', 'other'], default: 'retail' },
  businessCategory: { type: String, default: '' },
  state: { type: String, default: '' },
  pincode: {
    type: String,
    default: '',
    validate: { validator: v => !v || PINCODE_REGEX.test(v), message: 'Invalid pincode format' },
  },
  logo: { type: String, default: '' },
  signature: { type: String, default: '' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

businessSchema.index({ owner: 1 });

module.exports = mongoose.model('Business', businessSchema);
