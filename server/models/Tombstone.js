const mongoose = require('mongoose');

// A record that a document was DELETED, so the deletion can propagate to other
// devices (the data sync only moves creates/updates; without this, a delete on one
// PC would silently leave the doc alive on every other PC). One tombstone per
// (model, docId); `deletedAt` drives last-write-wins on apply, `updatedAt` (from
// timestamps) is the sync cursor field.
const tombstoneSchema = new mongoose.Schema({
  model: { type: String, required: true },   // Mongoose model name, e.g. 'Supplier'
  docId: { type: mongoose.Schema.Types.ObjectId, required: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', index: true },
  deletedAt: { type: Date, default: Date.now },
}, { timestamps: true });

tombstoneSchema.index({ model: 1, docId: 1 }, { unique: true });

module.exports = mongoose.model('Tombstone', tombstoneSchema);
