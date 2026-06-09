const mongoose = require('mongoose');

const godownSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true },
  code: { type: String, trim: true, default: '' },
  address: { type: String, trim: true, default: '' },
  city: { type: String, trim: true, default: '' },
  state: { type: String, trim: true, default: '' },
  phone: { type: String, trim: true, default: '' },
  email: { type: String, trim: true, default: '' },
  managerName: { type: String, trim: true, default: '' },
  isActive: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false },
  capacity: { type: Number, default: 0 },
  notes: { type: String, trim: true, default: '' },
}, { timestamps: true });

godownSchema.index({ user: 1, name: 1 });
godownSchema.index({ user: 1, isActive: 1 });

module.exports = mongoose.model('Godown', godownSchema);
