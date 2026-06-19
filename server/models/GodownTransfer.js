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
godownTransferSchema.index({ business: 1, createdAt: -1 });
godownTransferSchema.index({ user: 1, fromGodown: 1 });
godownTransferSchema.index({ user: 1, toGodown: 1 });
// Per-tenant unique transfer number. partialFilterExpression constrains only non-empty
// string transferNumbers (a compound `sparse` would not exclude nulls). Existing
// duplicates must be cleaned before this index can build; failures are non-fatal.
godownTransferSchema.index({ user: 1, business: 1, transferNumber: 1 }, { unique: true, partialFilterExpression: { transferNumber: { $type: 'string', $gt: '' } } });

module.exports = mongoose.model('GodownTransfer', godownTransferSchema);
