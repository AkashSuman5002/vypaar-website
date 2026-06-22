const mongoose = require('mongoose');

const gstFilingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  period: { type: String, required: true },
  returnType: { type: String, enum: ['GSTR1', 'GSTR2', 'GSTR3B', 'GSTR9'], required: true },
  status: { type: String, enum: ['pending', 'prepared', 'filed', 'cancelled'], default: 'pending' },
  totalInvoices: { type: Number, default: 0 },
  totalTaxable: { type: Number, default: 0 },
  totalTax: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  filingDate: { type: Date },
  dueDate: { type: Date },
  referenceNumber: { type: String },
  notes: { type: String },
}, { timestamps: true });

gstFilingSchema.index({ user: 1, period: 1, returnType: 1 });

module.exports = mongoose.model('GstFiling', gstFilingSchema);
