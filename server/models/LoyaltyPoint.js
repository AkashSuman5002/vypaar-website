const mongoose = require('mongoose');

const loyaltyPointSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  customerName: { type: String, trim: true, default: '' },
  transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
  transactionType: { type: String, enum: ['earn', 'redeem', 'adjustment', 'expiry'], default: 'earn', index: true },
  points: { type: Number, required: true },
  balance: { type: Number, required: true },
  description: { type: String, trim: true, default: '' },
  expiryDate: { type: Date },
  isRedeemed: { type: Boolean, default: false },
  redeemedAt: { type: Date },
  referenceNumber: { type: String, trim: true, default: '' },
}, { timestamps: true });

loyaltyPointSchema.index({ user: 1, customer: 1, createdAt: -1 });
loyaltyPointSchema.index({ user: 1, customer: 1, isRedeemed: 1 });

module.exports = mongoose.model('LoyaltyPoint', loyaltyPointSchema);
