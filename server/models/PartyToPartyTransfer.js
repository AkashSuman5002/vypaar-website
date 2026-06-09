const mongoose = require('mongoose');

const partyToPartyTransferSchema = mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  transferNumber: { type: String },
  fromPartyType: { type: String, enum: ['customer', 'supplier'], required: true },
  fromParty: { type: mongoose.Schema.Types.ObjectId, required: true },
  fromPartyName: { type: String, required: true },
  toPartyType: { type: String, enum: ['customer', 'supplier'], required: true },
  toParty: { type: mongoose.Schema.Types.ObjectId, required: true },
  toPartyName: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  notes: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('PartyToPartyTransfer', partyToPartyTransferSchema);
