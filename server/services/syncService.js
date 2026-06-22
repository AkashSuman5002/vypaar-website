// ---------------------------------------------------------------------------
// Cloud sync engine (MVP) — offline-first + multi-device.
//
// HOW IT WORKS
//   The app ALWAYS reads/writes the local MongoDB (fast, works offline). This
//   service runs in the background and, when a cloud database is configured and
//   reachable, keeps the local DB and a shared cloud DB in sync both directions:
//     PUSH  local docs changed since last sync  ->  cloud   (upsert by _id)
//     PULL  cloud docs changed since last sync  ->  local   (upsert by _id)
//   Multiple devices that point at the SAME cloud DB therefore converge on the
//   same data, and each device keeps working while offline.
//
// CONFLICTS
//   Last-write-wins by `updatedAt`: when both sides changed the same _id, the
//   document with the newer updatedAt is kept. Simple and predictable; it does
//   not merge field-level concurrent edits (documented MVP limitation).
//
// IDENTITY / AUTH
//   Auth collections (users/businesses/settings/roles/branches) are synced too,
//   so logging in on a second device works once its local DB has pulled them.
//
// OPT-IN / NON-BREAKING
//   Disabled unless CLOUD_MONGODB_URI is set. With it unset the app behaves
//   exactly as the current offline single-PC product.
//
// KNOWN MVP LIMITATIONS (follow-ups, intentionally deferred)
//   - Deletes are hard deletes in this app (no tombstones), so a delete on one
//     device is NOT yet propagated to others. Creates/updates sync reliably.
//   - Last-write-wins only (no field-level merge).
//   - Assumes one account's devices share one cloud DB (no per-tenant routing).
// ---------------------------------------------------------------------------

const mongoose = require('mongoose');

// Collections kept in sync. Auth/identity models are included so multi-device
// login works; the rest is core business data. (Ephemeral/device-specific
// collections like Otp, PushSubscription, WhatsAppSession are intentionally left
// out — they should stay local to each device.)
const SYNC_MODELS = [
  // identity / auth (needed so accounts exist on every device)
  'User', 'Business', 'Setting', 'Role', 'Branch',
  // core ledger & parties
  'Customer', 'Supplier', 'Product', 'Sale', 'Purchase', 'Expense',
  'Transaction', 'JournalEntry', 'Account',
  // inventory & numbering
  'StockMovement', 'StockReconciliation', 'Godown', 'GodownTransfer',
  'PurchaseOrder', 'PurchaseReturn', 'Receipt', 'Counter',
  // party extras & config
  'PartyGroup', 'PartyRate', 'PartyToPartyTransfer', 'LedgerNote',
  'LoyaltyPoint', 'Budget', 'Currency', 'ServiceReminder',
  'GstFiling', 'GstRecord', 'Staff',
];

const SYNC_INTERVAL_MS = Number(process.env.SYNC_INTERVAL_MS) || 30000;
const SYNC_STATE_COLLECTION = 'syncstate';

let cloudConn = null;        // mongoose Connection to the cloud DB
let cloudModels = {};        // name -> Model bound to cloudConn
let timer = null;
let running = false;         // a sync pass is in progress
let lastResult = null;       // summary of the last pass (for status endpoint)

const isEnabled = () => Boolean(process.env.CLOUD_MONGODB_URI);

// --- cursor persistence (local) -------------------------------------------
// One document { _id: 'cursors', push: {Model: ISO}, pull: {Model: ISO} } in
// the local DB tracks the high-water mark of the last successful sync so each
// pass only moves documents changed since then.
const stateColl = () => mongoose.connection.db.collection(SYNC_STATE_COLLECTION);

const loadCursors = async () => {
  const doc = await stateColl().findOne({ _id: 'cursors' });
  return doc || { _id: 'cursors', push: {}, pull: {} };
};
const saveCursors = async (cursors) => {
  await stateColl().updateOne({ _id: 'cursors' }, { $set: cursors }, { upsert: true });
};

// --- cloud connection ------------------------------------------------------
const buildCloudModels = () => {
  cloudModels = {};
  for (const name of SYNC_MODELS) {
    let local;
    try { local = mongoose.model(name); } catch (_) { continue; } // not registered — skip
    // Reuse the exact same schema for the cloud side so validation/shape match.
    cloudModels[name] = cloudConn.model(name, local.schema);
  }
};

const connectCloud = async () => {
  if (cloudConn) return cloudConn;
  cloudConn = await mongoose.createConnection(process.env.CLOUD_MONGODB_URI, {
    serverSelectionTimeoutMS: 8000,
  }).asPromise();
  cloudConn.on('error', (e) => console.warn('[sync] cloud connection error:', e.message));
  buildCloudModels();
  console.log('[sync] connected to cloud DB');
  return cloudConn;
};

// --- one-directional copy with last-write-wins ----------------------------
// Copy docs from `srcModel` into `dstModel` that changed strictly after `since`.
// Upserts by _id; only overwrites the destination when the source copy is newer
// (LWW). Returns { copied, newCursor }.
const copyChanged = async (srcModel, dstModel, since) => {
  const filter = since ? { updatedAt: { $gt: new Date(since) } } : {};
  const docs = await srcModel.find(filter).lean();
  let copied = 0;
  let maxTs = since ? new Date(since).getTime() : 0;

  for (const doc of docs) {
    const ts = doc.updatedAt ? new Date(doc.updatedAt).getTime() : 0;
    if (ts > maxTs) maxTs = ts;

    // Last-write-wins: skip if the destination already has a newer/equal copy.
    const existing = await dstModel.findById(doc._id).select('updatedAt').lean();
    if (existing && existing.updatedAt && new Date(existing.updatedAt).getTime() >= ts) continue;

    await dstModel.replaceOne({ _id: doc._id }, doc, { upsert: true });
    copied++;
  }
  return { copied, newCursor: maxTs ? new Date(maxTs).toISOString() : since };
};

// --- a full sync pass ------------------------------------------------------
const runSync = async () => {
  if (!isEnabled() || running) return lastResult;
  running = true;
  const summary = { at: new Date().toISOString(), pushed: 0, pulled: 0, errors: [] };
  try {
    await connectCloud();
    const cursors = await loadCursors();
    cursors.push = cursors.push || {};
    cursors.pull = cursors.pull || {};

    for (const name of SYNC_MODELS) {
      const localModel = (() => { try { return mongoose.model(name); } catch (_) { return null; } })();
      const cloudModel = cloudModels[name];
      if (!localModel || !cloudModel) continue;
      try {
        // PUSH local -> cloud
        const pushRes = await copyChanged(localModel, cloudModel, cursors.push[name]);
        cursors.push[name] = pushRes.newCursor;
        summary.pushed += pushRes.copied;

        // PULL cloud -> local
        const pullRes = await copyChanged(cloudModel, localModel, cursors.pull[name]);
        cursors.pull[name] = pullRes.newCursor;
        summary.pulled += pullRes.copied;
      } catch (e) {
        summary.errors.push(`${name}: ${e.message}`);
      }
    }
    await saveCursors(cursors);
  } catch (e) {
    summary.errors.push(`pass: ${e.message}`);
    // Drop the cloud connection so the next pass reconnects cleanly (e.g. after
    // the network comes back).
    try { if (cloudConn) await cloudConn.close(); } catch (_) {}
    cloudConn = null;
  } finally {
    running = false;
    lastResult = summary;
    if (summary.errors.length) console.warn('[sync] pass completed with errors:', summary.errors.join('; '));
    else console.log(`[sync] pass ok (pushed ${summary.pushed}, pulled ${summary.pulled})`);
  }
  return summary;
};

const startSync = () => {
  if (!isEnabled()) {
    console.log('[sync] cloud sync DISABLED (set CLOUD_MONGODB_URI to enable multi-device sync)');
    return;
  }
  console.log(`[sync] cloud sync ENABLED — interval ${SYNC_INTERVAL_MS}ms`);
  stopSync();
  // First pass shortly after boot, then on an interval.
  setTimeout(() => { runSync(); }, 5000);
  timer = setInterval(() => { runSync(); }, SYNC_INTERVAL_MS);
};

const stopSync = () => {
  if (timer) { clearInterval(timer); timer = null; }
};

const getStatus = () => ({
  enabled: isEnabled(),
  connected: Boolean(cloudConn),
  running,
  intervalMs: SYNC_INTERVAL_MS,
  collections: SYNC_MODELS.length,
  last: lastResult,
});

module.exports = { startSync, stopSync, runSync, getStatus, SYNC_MODELS, isEnabled };
