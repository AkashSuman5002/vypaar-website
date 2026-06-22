const mongoose = require('mongoose');

const branchSchema = mongoose.Schema({
  name: { type: String, required: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  code: { type: String },
  address: { type: String },
  city: { type: String },
  state: { type: String },
  phone: { type: String },
  email: { type: String },
  gstNumber: { type: String },
  isActive: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false },
}, { timestamps: true });

branchSchema.index({ business: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Branch', branchSchema);
