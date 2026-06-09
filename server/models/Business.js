const mongoose = require('mongoose');

const businessSchema = mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  address: { type: String },
  gstNumber: { type: String },
  panNumber: { type: String },
  businessType: { type: String, enum: ['retail', 'wholesale', 'manufacturing', 'service', 'other'], default: 'retail' },
  businessCategory: { type: String, default: '' },
  state: { type: String, default: '' },
  pincode: { type: String, default: '' },
  logo: { type: String, default: '' },
  signature: { type: String, default: '' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Business', businessSchema);
