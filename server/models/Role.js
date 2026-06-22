const mongoose = require('mongoose');

const roleSchema = mongoose.Schema({
  name: { type: String, required: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  permissions: [{ type: String }],
  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

roleSchema.index({ business: 1, name: 1 });

module.exports = mongoose.model('Role', roleSchema);