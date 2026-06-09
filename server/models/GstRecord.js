const mongoose = require('mongoose');

const gstRecordSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  partyName: { type: String, trim: true },
  partyGstin: { type: String, trim: true },
  invoiceNumber: { type: String, trim: true },
  invoiceDate: { type: Date },
  invoiceType: { type: String, trim: true },
  taxableValue: { type: Number, default: 0 },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  cess: { type: Number, default: 0 },
  totalTax: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  placeOfSupply: { type: String, trim: true },
  isInterState: { type: Boolean, default: false },
  reverseCharge: { type: Boolean, default: false },
  eWayBillNo: { type: String, trim: true },
  importRef: { type: mongoose.Schema.Types.ObjectId, ref: 'ImportHistory' },
}, { timestamps: true });

gstRecordSchema.index({ user: 1, invoiceNumber: 1 });
gstRecordSchema.index({ user: 1, partyGstin: 1 });
gstRecordSchema.index({ user: 1, invoiceDate: -1 });
gstRecordSchema.index({ user: 1, importRef: 1 });

module.exports = mongoose.model('GstRecord', gstRecordSchema);
