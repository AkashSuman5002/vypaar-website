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
    enum: ['sale', 'purchase', 'payment', 'receipt', 'expense', 'journal', 'credit_note', 'debit_note', 'gst', 'opening'],
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
journalEntrySchema.index({ user: 1, entryDate: -1 });
journalEntrySchema.index({ 'lines.account': 1 });

module.exports = mongoose.model('JournalEntry', journalEntrySchema);
