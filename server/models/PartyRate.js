const mongoose = require('mongoose');

const partyRateSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  party: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  partyType: { type: String, enum: ['customer', 'supplier'], default: 'customer', index: true },
  partyName: { type: String, trim: true, default: '' },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  productName: { type: String, trim: true, default: '' },
  rate: { type: Number, required: true, min: 0 },
  discountPercent: { type: Number, default: 0, min: 0, max: 100 },
  minQuantity: { type: Number, default: 1, min: 1 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

partyRateSchema.index({ user: 1, party: 1, product: 1 });
partyRateSchema.index({ user: 1, partyType: 1, party: 1 });

module.exports = mongoose.model('PartyRate', partyRateSchema);
