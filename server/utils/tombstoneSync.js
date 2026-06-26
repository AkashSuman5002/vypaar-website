// Sync helpers for deletions (tombstones). Used by BOTH the cloud (syncRoutes) and
// the desktop (cloudSyncClient), since they share this server codebase.

const mongoose = require('mongoose');
require('../models/Tombstone'); // ensure the model is compiled

// This business's tombstones changed after `since` (for a pull / local collect).
async function collectTombstones(businessId, since) {
  if (!businessId) return [];
  const Tombstone = mongoose.model('Tombstone');
  // Always send the full tombstone set (it's small) rather than an incremental `since`
  // window — otherwise a deletion recorded before the cursor advanced would never
  // propagate. `since` is intentionally ignored. (Deletes are applied idempotently.)
  return Tombstone.find({ business: businessId }).lean();
}

// Apply incoming tombstones: persist each tombstone (so it re-propagates) and delete
// the referenced doc locally — but ONLY if it wasn't modified after the deletion
// (else it was legitimately re-created and must survive). The delete uses the raw
// driver so it never re-triggers the tombstone plugin. `forceBusinessId` is set on
// the cloud (server-authoritative tenant); null on a device (use the tombstone's own).
async function applyTombstones(tombstones, forceBusinessId) {
  let applied = 0;
  if (!Array.isArray(tombstones) || !tombstones.length) return 0;
  const Tombstone = mongoose.model('Tombstone');
  for (const t of tombstones) {
    if (!t || !t.model || !t.docId) continue;
    const business = forceBusinessId || t.business || null;
    const deletedAt = t.deletedAt ? new Date(t.deletedAt) : new Date();
    try {
      await Tombstone.updateOne(
        { model: t.model, docId: t.docId },
        { $set: { model: t.model, docId: t.docId, business, deletedAt } },
        { upsert: true },
      );
    } catch (_) { /* keep going */ }

    let M;
    try { M = mongoose.model(t.model); } catch (_) { continue; }
    const existing = await M.findById(t.docId).select('updatedAt').lean();
    if (!existing) continue;
    const docTs = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
    if (docTs <= deletedAt.getTime()) {
      try {
        await M.collection.deleteOne({ _id: existing._id }); // raw → bypasses tombstone plugin
        applied++;
      } catch (_) { /* ignore */ }
    }
  }
  return applied;
}

// Largest updatedAt across a tombstone array — to advance the sync cursor.
function maxTombstoneTs(tombstones = []) {
  let m = 0;
  for (const t of tombstones) {
    const ts = t && t.updatedAt ? new Date(t.updatedAt).getTime() : 0;
    if (ts > m) m = ts;
  }
  return m;
}

module.exports = { collectTombstones, applyTombstones, maxTombstoneTs };
