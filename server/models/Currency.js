const mongoose = require('mongoose');

const currencySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  code: { type: String, required: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  symbol: { type: String, required: true, trim: true },
  exchangeRate: { type: Number, default: 1, min: 0 },
  isActive: { type: Boolean, default: true },
  isBase: { type: Boolean, default: false },
}, { timestamps: true });

currencySchema.index({ user: 1, code: 1 }, { unique: true });
currencySchema.index({ user: 1, business: 1, code: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Currency', currencySchema);
