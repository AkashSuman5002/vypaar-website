// ---------------------------------------------------------------------------
// Global Mongoose plugin that records a Tombstone whenever a SYNCED document is
// deleted, so the sync can replay the deletion on other devices.
//
// IMPORTANT: this file calls mongoose.plugin() on require, so it MUST be required
// at the very top of server.js — BEFORE any model is compiled — otherwise models
// loaded earlier won't get the delete hooks.
//
// Tombstones are applied conservatively on the receiving side (see tombstoneSync):
// a doc is only actually deleted if it wasn't modified after the deletion time, and
// the apply uses the raw driver so it never triggers this plugin (no recursion).
// ---------------------------------------------------------------------------

const mongoose = require('mongoose');

// Which models' deletions propagate. Computed lazily (at first delete, long after
// startup) so we can require backupService WITHOUT compiling models before the
// mongoose.plugin() call below — keeping the plugin applied to every model.
// Business is deliberately excluded: deleting a whole business must never auto-sync.
let _synced = null;
function syncedSet() {
  if (_synced) return _synced;
  try {
    const { TENANT_MODELS } = require('../services/backupService');
    _synced = new Set([...Object.values(TENANT_MODELS), 'User', 'Role', 'Branch', 'Setting']);
  } catch (_) {
    _synced = new Set();
  }
  return _synced;
}

async function record(modelName, docId, business) {
  if (!docId || !syncedSet().has(modelName)) return;
  try {
    const Tombstone = mongoose.model('Tombstone');
    await Tombstone.updateOne(
      { model: modelName, docId },
      { $set: { model: modelName, docId, business: business || null, deletedAt: new Date() } },
      { upsert: true },
    );
  } catch (_) { /* never let tombstone bookkeeping break the actual delete */ }
}

function tombstonePlugin(schema) {
  // Document-level deletes: doc.deleteOne()
  schema.post('deleteOne', { document: true, query: false }, function () {
    const name = this.constructor && this.constructor.modelName;
    if (name) record(name, this._id, this.business);
  });

  // Query-level deletes: Model.deleteOne / deleteMany / findOneAndDelete / findByIdAndDelete.
  // Capture the matching ids BEFORE the delete, then write tombstones AFTER it succeeds.
  const capture = async function () {
    try {
      const name = this.model && this.model.modelName;
      if (!name || !syncedSet().has(name)) { this._tombDocs = []; return; }
      this._tombDocs = await this.model.find(this.getFilter()).select('_id business').lean();
    } catch (_) { this._tombDocs = []; }
  };
  const write = async function () {
    const name = this.model && this.model.modelName;
    if (!name) return;
    for (const d of this._tombDocs || []) await record(name, d._id, d.business);
  };

  schema.pre('deleteOne', { query: true, document: false }, capture);
  schema.post('deleteOne', { query: true, document: false }, write);
  schema.pre('deleteMany', capture);
  schema.post('deleteMany', write);
  schema.pre('findOneAndDelete', capture);
  schema.post('findOneAndDelete', write);
}

// Register globally for every schema compiled AFTER this point.
mongoose.plugin(tombstonePlugin);

module.exports = { tombstonePlugin, record, syncedSet };
