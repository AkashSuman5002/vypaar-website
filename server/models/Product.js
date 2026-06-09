const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  name: { type: String, required: true, trim: true },
  category: { type: String, trim: true },
  price: { type: Number, required: true, min: 0 },
  costPrice: { type: Number, default: 0, min: 0 },
  stock: { type: Number, default: 0, min: 0 },
  unit: { type: String, default: 'pcs', trim: true },
  gstRate: { type: Number, default: 0, min: 0, max: 100 },
  minStock: { type: Number, default: 5, min: 0 },
  hsn: { type: String, trim: true },
  image: { type: String },
  isActive: { type: Boolean, default: true },
  barcode: { type: String, trim: true, sparse: true },
  sku: { type: String, trim: true },
  brand: { type: String, trim: true },
  mrp: { type: Number, default: 0, min: 0 },
  description: { type: String, trim: true },
}, { timestamps: true });

productSchema.index({ user: 1, name: 1 });
productSchema.index({ user: 1, barcode: 1 });
productSchema.index({ barcode: 1 });
productSchema.index({ user: 1, category: 1 });
productSchema.index({ user: 1, stock: 1 });
productSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Product', productSchema);
