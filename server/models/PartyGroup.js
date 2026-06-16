const mongoose = require('mongoose');

const partyGroupSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['customer', 'supplier', 'both'], default: 'both' },
  description: { type: String, trim: true },
  color: { type: String, default: '#3B82F6' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

partyGroupSchema.index({ user: 1, business: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('PartyGroup', partyGroupSchema);
