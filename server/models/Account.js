const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  name: { type: String, required: true, trim: true },
  code: { type: String, trim: true },
  type: {
    type: String,
    enum: ['asset', 'liability', 'equity', 'income', 'expense'],
    required: true,
    index: true,
  },
  category: {
    type: String,
    enum: [
      'current_asset', 'fixed_asset', 'non_current_asset', 'other_asset', 'cash', 'bank', 'receivable', 'inventory',
      'current_liability', 'long_term_liability', 'loan', 'payable',
      'capital', 'drawings', 'retained_earnings',
      'sales', 'other_income', 'direct_income', 'indirect_income',
      'purchase', 'direct_expense', 'indirect_expense',
      'gst_collectible', 'gst_payable', 'tax_payable', 'input_duties', 'output_duties',
    ],
    required: true,
  },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
  isDefault: { type: Boolean, default: false },
  balance: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  description: { type: String, trim: true },
  metadata: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

accountSchema.index({ user: 1, business: 1, code: 1 }, { unique: true, sparse: true });
accountSchema.index({ user: 1, type: 1, category: 1 });

module.exports = mongoose.model('Account', accountSchema);
