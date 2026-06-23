// ---------------------------------------------------------------------------
// Cloud HTTP sync client (DESKTOP side) — Option B / real-Vyapar architecture.
//
// The desktop NEVER holds database credentials. It talks to the cloud API
// (CLOUD_API_URL) over HTTPS with a login token and syncs the LOCAL MongoDB:
//     PULL  GET  /api/sync/pull?since=<cursor>   -> apply to local (LWW)
//     PUSH  POST /api/sync/push  { collections } -> local changes to cloud
// Tenant isolation is enforced entirely server-side (see routes/syncRoutes.js):
// the cloud scopes everything to the authenticated account, so this client can
// only ever touch its own business's data.
//
// Auth: a JWT obtained from the cloud login is sent as `Authorization: Bearer`
// (which the cloud exempts from CSRF — see middleware/csrf.js). Only the 31
// business-scoped data models flow through here (identity is handled by login).
// ---------------------------------------------------------------------------

const mongoose = require('mongoose');
const { TENANT_MODELS } = require('./backupService');

const api = () => (process.env.CLOUD_API_URL || '').replace(/\/+$/, '');
const isConfigured = () => Boolean(api());

const STATE_COLLECTION = 'syncstate';
const stateColl = () => mongoose.connection.db.collection(STATE_COLLECTION);

let token = null; // cloud JWT used as a Bearer token

const setToken = (t) => { token = t || null; };
const hasToken = () => Boolean(token);
const clearToken = () => { token = null; };

// Log in to the CLOUD and capture the JWT (returned by the cloud as an httpOnly
// `token` cookie). A Node HTTP client can read Set-Cookie, so we lift the JWT out
// and use it as a Bearer token for subsequent sync calls.
const cloudLogin = async (email, password) => {
  const res = await fetch(api() + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(60000), // tolerate free-tier cold start (~50s)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || `cloud login failed (${res.status})`);
  const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of cookies) {
    if (c.startsWith('token=')) { token = c.split(';')[0].slice('token='.length); break; }
  }
  if (!token) throw new Error('cloud login succeeded but no token cookie was returned');
  return { token, user: body };
};

const loadCursors = async () => (await stateColl().findOne({ _id: 'cloudcursors' })) || { _id: 'cloudcursors', pull: null, push: null };
const saveCursors = async (c) => { await stateColl().updateOne({ _id: 'cloudcursors' }, { $set: c }, { upsert: true }); };

// --- PULL: cloud -> local --------------------------------------------------
const pullFromCloud = async (since) => {
  const url = api() + '/api/sync/pull' + (since ? ('?since=' + encodeURIComponent(since)) : '');
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(60000) });
  if (res.status === 401) { clearToken(); throw new Error('unauthorized (token expired) — re-login required'); }
  if (!res.ok) throw new Error(`pull failed (${res.status})`);
  return res.json(); // { collections, cursor, serverTime }
};

const applyToLocal = async (collections) => {
  let applied = 0;
  for (const [key, modelName] of Object.entries(TENANT_MODELS)) {
    const docs = Array.isArray(collections[key]) ? collections[key] : [];
    if (!docs.length) continue;
    let Model;
    try { Model = mongoose.model(modelName); } catch (_) { continue; }
    for (const doc of docs) {
      const id = doc._id;
      const ts = doc.updatedAt ? new Date(doc.updatedAt).getTime() : 0;
      // Last-write-wins: skip if local copy is newer/equal.
      const existing = id ? await Model.findById(id).select('updatedAt').lean() : null;
      if (existing && existing.updatedAt && new Date(existing.updatedAt).getTime() >= ts) continue;
      const clean = { ...doc };
      delete clean.__v;
      await Model.replaceOne({ _id: id }, clean, { upsert: true });
      applied++;
    }
  }
  return applied;
};

// --- PUSH: local -> cloud --------------------------------------------------
const collectLocalChanges = async (since) => {
  const collections = {};
  let count = 0;
  let maxTs = since ? new Date(since).getTime() : 0;
  for (const [key, modelName] of Object.entries(TENANT_MODELS)) {
    let Model;
    try { Model = mongoose.model(modelName); } catch (_) { continue; }
    const filter = since ? { updatedAt: { $gt: new Date(since) } } : {};
    const docs = await Model.find(filter).lean();
    if (docs.length) {
      collections[key] = docs;
      count += docs.length;
      for (const d of docs) { const t = d.updatedAt ? new Date(d.updatedAt).getTime() : 0; if (t > maxTs) maxTs = t; }
    }
  }
  return { collections, count, newCursor: maxTs ? new Date(maxTs).toISOString() : since };
};

const pushToCloud = async (collections) => {
  const res = await fetch(api() + '/api/sync/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ collections }),
    signal: AbortSignal.timeout(60000),
  });
  if (res.status === 401) { clearToken(); throw new Error('unauthorized (token expired) — re-login required'); }
  if (!res.ok) throw new Error(`push failed (${res.status})`);
  return res.json();
};

// One full sync pass: pull cloud -> local, then push local -> cloud.
const runCloudSync = async () => {
  if (!isConfigured()) return { skipped: 'CLOUD_API_URL not set' };
  if (!token) return { skipped: 'not authenticated to cloud' };

  const cursors = await loadCursors();

  const pulled = await pullFromCloud(cursors.pull);
  const appliedCount = await applyToLocal(pulled.collections || {});
  cursors.pull = pulled.cursor || cursors.pull;

  const { collections, count, newCursor } = await collectLocalChanges(cursors.push);
  let pushedCount = 0;
  if (count > 0) { await pushToCloud(collections); pushedCount = count; cursors.push = newCursor; }

  await saveCursors(cursors);
  return { pulled: appliedCount, pushed: pushedCount };
};

// Fire-and-forget a single sync pass (used right after login, and by the loop).
let syncing = false;
const triggerSync = () => {
  if (!isConfigured() || !token || syncing) return;
  syncing = true;
  runCloudSync()
    .then((r) => { if (r && (r.pulled || r.pushed)) console.log('[cloudsync]', JSON.stringify(r)); })
    .catch((e) => console.warn('[cloudsync] error:', e.message))
    .finally(() => { syncing = false; });
};

// Background loop: sync every `intervalMs` while logged in and online.
let loopTimer = null;
const startSyncLoop = (intervalMs = Number(process.env.SYNC_INTERVAL_MS) || 30000) => {
  if (!isConfigured()) { console.log('[cloudsync] HTTP cloud sync DISABLED (no CLOUD_API_URL)'); return; }
  if (loopTimer) clearInterval(loopTimer);
  console.log(`[cloudsync] HTTP cloud sync ENABLED — interval ${intervalMs}ms`);
  loopTimer = setInterval(triggerSync, intervalMs);
};

module.exports = { cloudLogin, setToken, hasToken, clearToken, runCloudSync, triggerSync, startSyncLoop, isConfigured, api };
