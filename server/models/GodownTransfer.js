const mongoose = require('mongoose');

const godownTransferSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  transferNumber: { type: String, required: true },
  fromGodown: { type: mongoose.Schema.Types.ObjectId, ref: 'Godown', required: true },
  fromGodownName: { type: String, required: true },
  toGodown: { type: mongoose.Schema.Types.ObjectId, ref: 'Godown', required: true },
  toGodownName: { type: String, required: true },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unit: { type: String, default: 'pcs' },
  }],
  totalItems: { type: Number, default: 0 },
  date: { type: Date, default: Date.now },
  notes: { type: String, trim: true, default: '' },
  status: { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'completed' },
}, { timestamps: true });

godownTransferSchema.index({ user: 1, createdAt: -1 });
godownTransferSchema.index({ user: 1, fromGodown: 1 });
godownTransferSchema.index({ user: 1, toGodown: 1 });

module.exports = mongoose.model('GodownTransfer', godownTransferSchema);
