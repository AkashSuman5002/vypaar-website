const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  productName: { type: String, required: true },
  type: {
    type: String,
    enum: ['purchase', 'sale', 'return', 'adjustment', 'transfer'],
    required: true,
    index: true,
  },
  quantity: { type: Number, required: true },
  balanceBefore: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  rate: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  referenceType: { type: String, trim: true },
  referenceId: { type: mongoose.Schema.Types.ObjectId },
  referenceNumber: { type: String, trim: true },
  description: { type: String, trim: true },
  date: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

stockMovementSchema.index({ user: 1, product: 1, date: -1 });
stockMovementSchema.index({ user: 1, type: 1, date: -1 });
stockMovementSchema.index({ user: 1, referenceType: 1, referenceId: 1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
