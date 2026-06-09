const mongoose = require('mongoose');

const branchSchema = mongoose.Schema({
  name: { type: String, required: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  address: { type: String },
  city: { type: String },
  state: { type: String },
  phone: { type: String },
  email: { type: String },
  gstNumber: { type: String },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

branchSchema.index({ business: 1, name: 1 });

module.exports = mongoose.model('Branch', branchSchema);
