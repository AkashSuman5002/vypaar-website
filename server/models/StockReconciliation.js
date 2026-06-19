const mongoose = require('mongoose');

const stockReconciliationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  reconciliationNumber: { type: String, required: true },
  date: { type: Date, default: Date.now },
  godown: { type: mongoose.Schema.Types.ObjectId, ref: 'Godown' },
  godownName: { type: String, default: 'All Godowns' },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    systemStock: { type: Number, required: true },
    countedStock: { type: Number, required: true },
    difference: { type: Number, required: true },
    unit: { type: String, default: 'pcs' },
    reason: { type: String, trim: true, default: '' },
  }],
  totalItems: { type: Number, default: 0 },
  totalDiscrepancies: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'applied', 'cancelled'], default: 'draft' },
  notes: { type: String, trim: true, default: '' },
}, { timestamps: true });

stockReconciliationSchema.index({ user: 1, createdAt: -1 });
stockReconciliationSchema.index({ business: 1, createdAt: -1 });
// Per-tenant unique reconciliation number. partialFilterExpression constrains only
// non-empty string reconciliationNumbers (a compound `sparse` would not exclude nulls).
// Existing duplicates must be cleaned before this index can build; failures non-fatal.
stockReconciliationSchema.index({ user: 1, business: 1, reconciliationNumber: 1 }, { unique: true, partialFilterExpression: { reconciliationNumber: { $type: 'string', $gt: '' } } });

module.exports = mongoose.model('StockReconciliation', stockReconciliationSchema);
