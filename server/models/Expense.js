const mongoose = require('mongoose');

const expenseItemSchema = new mongoose.Schema({
  // `name`/`price` kept for backward compatibility; the form sends `item`/`rate`.
  name: { type: String, trim: true },
  item: { type: String, trim: true },
  quantity: { type: Number, default: 1 },
  unit: { type: String, trim: true },
  price: { type: Number, default: 0 },
  rate: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
  gstRate: { type: Number, default: 0 },
  gstAmount: { type: Number, default: 0 },
}, { _id: false });

const expenseSchema = mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  expenseNumber: { type: String },
  category: { type: String, required: true, default: 'Other' },
  description: { type: String },
  amount: { type: Number, required: true },
  tax: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  paymentMethod: { type: String, default: 'cash' },
  reference: { type: String },
  paidTo: { type: String, trim: true },
  notes: { type: String },
  items: [expenseItemSchema],
  isRecurring: { type: Boolean, default: false },
  recurringInterval: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'] },
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
  approvedBy: { type: String, trim: true },
  approvedAt: { type: Date },
  receiptImage: { type: String },
  rejectionReason: { type: String, trim: true },
}, { timestamps: true });

expenseSchema.index({ user: 1, date: -1 });
expenseSchema.index({ business: 1, date: -1 });
expenseSchema.index({ business: 1, category: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
