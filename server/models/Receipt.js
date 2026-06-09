const mongoose = require('mongoose');

const receiptSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  receiptNumber: { type: String, required: true, trim: true },
  sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
  invoiceNumber: { type: String, trim: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  customerName: { type: String, trim: true },
  date: { type: Date, default: Date.now, index: true },
  amount: { type: Number, required: true, min: 0 },
  mode: { type: String, enum: ['cash', 'upi', 'bank', 'card', 'cheque', 'credit'], default: 'cash' },
  transactionNo: { type: String, trim: true },
  bankName: { type: String, trim: true },
  chequeNo: { type: String, trim: true },
  referenceNo: { type: String, trim: true },
  notes: { type: String, trim: true },
  createdBy: { type: String, trim: true },
}, { timestamps: true });

receiptSchema.index({ user: 1, receiptNumber: 1 }, { unique: true });
receiptSchema.index({ user: 1, date: -1 });
receiptSchema.index({ user: 1, customer: 1 });

module.exports = mongoose.model('Receipt', receiptSchema);
