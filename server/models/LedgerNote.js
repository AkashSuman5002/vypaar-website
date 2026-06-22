const mongoose = require('mongoose');

const ledgerNoteSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  partyId: { type: mongoose.Schema.Types.ObjectId, required: true },
  partyType: { type: String, enum: ['customer', 'supplier'], required: true },
  note: { type: String, trim: true, default: '' },
}, { timestamps: true });

ledgerNoteSchema.index({ user: 1, partyId: 1, partyType: 1 }, { unique: true });

module.exports = mongoose.model('LedgerNote', ledgerNoteSchema);
