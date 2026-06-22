const mongoose = require('mongoose');

// Atomic per-tenant document-number counter. One row per (user, business, key).
// `key` identifies the document series, e.g. 'sale_invoice', 'purchase_bill'.
// `seq` is incremented atomically via findOneAndUpdate($inc) so concurrent
// requests never read-the-same-max-then-collide.
const counterSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, required: true },
  business: { type: mongoose.Schema.Types.ObjectId, default: null },
  key: { type: String, required: true },
  seq: { type: Number, default: 0 },
}, { timestamps: true });

counterSchema.index({ user: 1, business: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('Counter', counterSchema);
