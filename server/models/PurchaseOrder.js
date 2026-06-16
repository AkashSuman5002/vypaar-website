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

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
