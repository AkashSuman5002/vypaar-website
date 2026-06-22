const mongoose = require('mongoose');

const receivedItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: { type: String },
  orderedQuantity: { type: Number, required: true },
  receivedQuantity: { type: Number, default: 0 },
  pendingQuantity: { type: Number, default: 0 },
}, { _id: false });

const purchaseOrderSchema = mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  orderNumber: { type: String },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  supplierName: { type: String },
  orderDate: { type: Date, default: Date.now },
  expectedDate: { type: Date },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: { type: String },
    quantity: { type: Number, required: true },
    rate: { type: Number, required: true },
    amount: { type: Number },
    gstRate: { type: Number, default: 0 },
    receivedQuantity: { type: Number, default: 0 },
    pendingQuantity: { type: Number, default: 0 },
  }],
  taxableAmount: { type: Number, default: 0 },
  cgstTotal: { type: Number, default: 0 },
  sgstTotal: { type: Number, default: 0 },
  igstTotal: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'pending', 'approved', 'ordered', 'partially_received', 'received', 'cancelled'], default: 'draft' },
  approvalDate: { type: Date },
  approvedBy: { type: String },
  notes: { type: String },
  isInterState: { type: Boolean, default: false },
  receivedItems: [receivedItemSchema],
  receivedDate: { type: Date },
  receiveNotes: { type: String },
  cancellationReason: { type: String },
  cancelledDate: { type: Date },
}, { timestamps: true });

purchaseOrderSchema.index({ business: 1, createdAt: -1 });
purchaseOrderSchema.index({ user: 1, createdAt: -1 });
purchaseOrderSchema.index({ orderNumber: 1 });
purchaseOrderSchema.index({ supplier: 1 });
purchaseOrderSchema.index({ status: 1 });
// Per-tenant unique order number. partialFilterExpression constrains only non-empty
// string orderNumbers (a compound `sparse` would not exclude nulls). Existing
// duplicates must be cleaned before this index can build; failures are non-fatal.
purchaseOrderSchema.index({ user: 1, business: 1, orderNumber: 1 }, { unique: true, partialFilterExpression: { orderNumber: { $type: 'string', $gt: '' } } });

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
