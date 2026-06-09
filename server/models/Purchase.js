const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: { type: String, trim: true },
  quantity: { type: Number, required: true, min: 1 },
  rate: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true, min: 0 },
  gstRate: { type: Number, default: 0, min: 0, max: 100 },
  taxableAmount: { type: Number, default: 0, min: 0 },
  cgst: { type: Number, default: 0, min: 0 },
  sgst: { type: Number, default: 0, min: 0 },
  igst: { type: Number, default: 0, min: 0 },
}, { _id: false });

const purchaseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  supplierName: { type: String, required: true, trim: true },
  billNumber: { type: String, trim: true },
  date: { type: Date, default: Date.now, index: true },
  dueDate: { type: Date },
  items: [purchaseItemSchema],
  taxableAmount: { type: Number, default: 0, min: 0 },
  cgstTotal: { type: Number, default: 0, min: 0 },
  sgstTotal: { type: Number, default: 0, min: 0 },
  igstTotal: { type: Number, default: 0, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  paidAmount: { type: Number, default: 0, min: 0 },
  remainingBalance: { type: Number, default: 0, min: 0 },
  paymentStatus: { type: String, enum: ['paid', 'partial', 'unpaid'], default: 'unpaid', index: true },
  paymentMethod: { type: String, enum: ['cash', 'bank', 'upi', 'cheque'], default: 'cash' },
  paymentDate: { type: Date },
  notes: { type: String, trim: true },
  isInterState: { type: Boolean, default: false },
}, { timestamps: true });

purchaseSchema.index({ user: 1, date: -1 });
purchaseSchema.index({ user: 1, supplier: 1 });
purchaseSchema.index({ user: 1, paymentStatus: 1 });

module.exports = mongoose.model('Purchase', purchaseSchema);
