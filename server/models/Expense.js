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
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
}, { _id: false });

const expenseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  expenseNumber: { type: String },
  category: { type: String, required: true, default: 'Other' },
  description: { type: String },
  amount: { type: Number, required: true, min: 0 },
  tax: { type: Number, default: 0 },
  // GST split of `tax` (intra-state expenses fill cgst/sgst; inter-state fills igst).
  cgstTotal: { type: Number, default: 0 },
  sgstTotal: { type: Number, default: 0 },
  igstTotal: { type: Number, default: 0 },
  isInterState: { type: Boolean, default: false },
  totalAmount: { type: Number, required: true, min: 0 },
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
expenseSchema.index({ user: 1, category: 1 });
// Per-tenant unique expense number. partialFilterExpression constrains only non-empty
// string expenseNumbers — a compound `sparse` does NOT exclude null expenseNumber here
// (user/business are always present), which caused null-on-null collisions. Existing
// duplicates must be cleaned before this index can build; failures are non-fatal.
expenseSchema.index({ user: 1, business: 1, expenseNumber: 1 }, { unique: true, partialFilterExpression: { expenseNumber: { $type: 'string', $gt: '' } } });

module.exports = mongoose.model('Expense', expenseSchema);
