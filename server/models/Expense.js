const mongoose = require('mongoose');

const expenseItemSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  quantity: { type: Number, default: 1 },
  price: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
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
  notes: { type: String },
  items: [expenseItemSchema],
  isRecurring: { type: Boolean, default: false },
  recurringInterval: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'] },
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);
