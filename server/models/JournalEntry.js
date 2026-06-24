const mongoose = require('mongoose');

const journalLineSchema = new mongoose.Schema({
  account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
  accountName: { type: String, required: true },
  accountType: { type: String, required: true },
  particular: { type: String, trim: true },
  debit: { type: Number, default: 0, min: 0 },
  credit: { type: Number, default: 0, min: 0 },
}, { _id: false });

const journalEntrySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  entryNumber: { type: String, required: true, trim: true },
  entryDate: { type: Date, default: Date.now, index: true },
  referenceType: {
    type: String,
    // Includes the capitalized reference types the controllers actually use for
    // journal entries (PaymentOut, PurchaseReturn, etc.). These were missing, so
    // those JE inserts silently failed enum validation and no ledger entry was
    // ever written — only surfaced once JE errors stopped being swallowed.
    enum: ['sale', 'Sale', 'purchase', 'payment', 'PaymentOut', 'receipt', 'expense',
           'journal', 'credit_note', 'debit_note', 'gst', 'opening',
           'PurchaseReturn', 'PurchaseOrder', 'GodownTransfer', 'Manufacturing', 'StockReconciliation'],
    required: true,
    index: true,
  },
  referenceId: { type: mongoose.Schema.Types.ObjectId },
  referenceNumber: { type: String, trim: true },
  narration: { type: String, trim: true },
  description: { type: String, trim: true },
  lines: [journalLineSchema],
  totalDebit: { type: Number, default: 0, min: 0 },
  totalCredit: { type: Number, default: 0, min: 0 },
  isPosted: { type: Boolean, default: true },
  postedAt: { type: Date, default: Date.now },
}, { timestamps: true });

journalEntrySchema.index({ user: 1, entryNumber: 1 }, { unique: true });
journalEntrySchema.index({ user: 1, referenceType: 1, referenceId: 1 });
journalEntrySchema.index({ business: 1, referenceType: 1, referenceId: 1 });
journalEntrySchema.index({ user: 1, entryDate: -1 });
journalEntrySchema.index({ business: 1, entryDate: -1 });
// Trial Balance / P&L / Balance Sheet all query { user, isPosted, entryDate } — index it.
journalEntrySchema.index({ user: 1, isPosted: 1, entryDate: -1 });
journalEntrySchema.index({ 'lines.account': 1 });

// Enforce double-entry balance: total debit must equal total credit (within rounding
// tolerance). Always enforced for posted entries; only skipped for explicit drafts
// (isPosted === false).
journalEntrySchema.pre('validate', function balanceCheck(next) {
  if (this.isPosted === false) {
    return next();
  }
  const debit = this.totalDebit || 0;
  const credit = this.totalCredit || 0;
  if (Math.abs(debit - credit) > 0.01) {
    const err = new mongoose.Error.ValidationError(this);
    err.addError('totalDebit', new mongoose.Error.ValidatorError({
      message: `Journal entry is unbalanced: totalDebit (${debit}) must equal totalCredit (${credit})`,
      path: 'totalDebit',
      value: debit,
    }));
    return next(err);
  }
  return next();
});

module.exports = mongoose.model('JournalEntry', journalEntrySchema);
