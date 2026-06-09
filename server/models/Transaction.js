const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  type: {
    type: String,
    enum: ['cash_in', 'cash_out', 'bank_in', 'bank_out'],
    required: true,
    index: true,
  },
  amount: { type: Number, required: true, min: 0 },
  description: { type: String, trim: true },
  date: { type: Date, default: Date.now, index: true },
  reference: { type: String, trim: true },
  referenceModel: { type: String, trim: true },
  referenceId: { type: mongoose.Schema.Types.ObjectId },
  partyName: { type: String, trim: true },
  partyType: { type: String, enum: ['customer', 'supplier', 'expense'], default: 'customer' },
}, { timestamps: true });

transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ user: 1, type: 1, date: -1 });
transactionSchema.index({ user: 1, reference: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
