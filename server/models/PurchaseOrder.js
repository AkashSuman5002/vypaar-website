const mongoose = require('mongoose');

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
  }],
  taxableAmount: { type: Number, default: 0 },
  cgstTotal: { type: Number, default: 0 },
  sgstTotal: { type: Number, default: 0 },
  igstTotal: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'pending', 'approved', 'ordered', 'received', 'cancelled'], default: 'draft' },
  notes: { type: String },
  isInterState: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
