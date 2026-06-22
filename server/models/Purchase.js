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
  currency: { type: String, default: 'INR', trim: true },
  exchangeRate: { type: Number, default: 1 },
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
  tcsAmount: { type: Number, default: 0, min: 0 },
  tdsAmount: { type: Number, default: 0, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  paidAmount: { type: Number, default: 0, min: 0 },
  remainingBalance: { type: Number, default: 0, min: 0 },
  paymentStatus: { type: String, enum: ['paid', 'partial', 'unpaid'], default: 'unpaid', index: true },
  paymentMethod: { type: String, enum: ['cash', 'bank', 'upi', 'cheque'], default: 'cash' },
  paymentDate: { type: Date },
  notes: { type: String, trim: true },
  returnReason: { type: String, trim: true },
  isInterState: { type: Boolean, default: false },
}, { timestamps: true });

purchaseSchema.index({ user: 1, date: -1 });
purchaseSchema.index({ business: 1, date: -1 });
purchaseSchema.index({ user: 1, supplier: 1 });
purchaseSchema.index({ business: 1, supplier: 1 });
purchaseSchema.index({ user: 1, paymentStatus: 1 });
purchaseSchema.index({ business: 1, paymentStatus: 1 });
// Per-tenant unique bill number. partialFilterExpression constrains only non-empty
// string billNumbers (null/empty are excluded — a compound `sparse` would NOT skip
// them since user/business are always present). NOTE: existing duplicate billNumbers
// must be cleaned before this index can build; build failures are logged, non-fatal.
purchaseSchema.index({ user: 1, business: 1, billNumber: 1 }, { unique: true, partialFilterExpression: { billNumber: { $type: 'string', $gt: '' } } });

module.exports = mongoose.model('Purchase', purchaseSchema);
