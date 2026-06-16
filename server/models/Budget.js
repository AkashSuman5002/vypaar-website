const mongoose = require('mongoose');

const budgetSchema = mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  period: { type: String, enum: ['monthly', 'quarterly', 'yearly'], default: 'monthly' },
  month: { type: Number, min: 1, max: 12 },
  year: { type: Number, required: true },
  spent: { type: Number, default: 0 },
  alertThreshold: { type: Number, default: 80 },
  isActive: { type: Boolean, default: true },
  notes: { type: String },
}, { timestamps: true });

budgetSchema.index({ user: 1, business: 1, category: 1, period: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Budget', budgetSchema);
