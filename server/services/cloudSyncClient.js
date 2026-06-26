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
const { IDENTITY_MODELS, collectIdentity } = require('../utils/identitySync');
const { collectTombstones, applyTombstones } = require('../utils/tombstoneSync');
const { shouldApplyRemote, advanceCursor } = require('../utils/syncHelpers');

const api = () => (process.env.CLOUD_API_URL || '').replace(/\/+$/, '');
const isConfigured = () => Boolean(api());

const STATE_COLLECTION = 'syncstate';
const stateColl = () => mongoose.connection.db.collection(STATE_COLLECTION);

let token = null; // cloud JWT used as a Bearer token
const TOKEN_DOC_ID = 'cloudtoken';

// Persist the cloud JWT in the local DB so background sync survives app restarts.
// Without this the token lived only in memory: after a relaunch the local session
// was still valid (so the user was never re-prompted to log in), but the cloud token
// was gone, so the sync loop silently did nothing and data stopped syncing until a
// manual logout/login. The JWT carries its own expiry; on expiry the cloud returns
// 401 and we clear it, prompting a re-login.
const persistToken = (t) => {
  try {
    stateColl().updateOne({ _id: TOKEN_DOC_ID }, { $set: { token: t || null, savedAt: new Date() } }, { upsert: true }).catch(() => {});
  } catch (_) { /* DB not ready yet — ignore */ }
};
const loadPersistedToken = async () => {
  try {
    const doc = await stateColl().findOne({ _id: TOKEN_DOC_ID });
    if (doc && doc.token) token = doc.token;
  } catch (_) { /* ignore */ }
  return token;
};

const setToken = (t) => { token = t || null; persistToken(t); };
const hasToken = () => Boolean(token);
const clearToken = () => { token = null; persistToken(null); };

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
// Docs per request when chunking. Small enough that the free cloud tier never times
// out processing/serving a batch, big enough to stay fast.
const CHUNK = 50;

// A "payload too big" failure (free server gave up): 502/503/504, a timeout or a reset.
// When we see one we fall back from a single all-at-once request to small chunks.
const isPayloadError = (e) => /\b(502|503|504)\b|timeout|aborted|ECONNRESET|fetch failed/i.test((e && e.message) || '');

const pullRequest = async (params) => {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(api() + '/api/sync/pull' + (qs ? '?' + qs : ''), { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(60000) });
  if (res.status === 401) { clearToken(); throw new Error('unauthorized (token expired) — re-login required'); }
  if (!res.ok) throw new Error(`pull failed (${res.status})`);
  return res.json(); // { collections, cursor, serverTime }
};

// Pull ONE tenant collection fully, paginated (applied as we go). Returns {applied, cursor}.
const pullCollectionPaged = async (key, since) => {
  let applied = 0, skip = 0, cursor = since;
  for (;;) {
    const params = { only: key, limit: String(CHUNK), skip: String(skip) };
    if (since) params.since = since;
    const data = await pullRequest(params);
    applied += await applyToLocal(data.collections || {});
    if (data.cursor && (!cursor || new Date(data.cursor) > new Date(cursor))) cursor = data.cursor;
    const got = (data.collections && Array.isArray(data.collections[key])) ? data.collections[key].length : 0;
    if (got < CHUNK) break; // last page
    skip += CHUNK;
  }
  return { applied, cursor };
};

// Resolve the business this device is logged in as (from the cloud token's user id),
// so identity collection only ever touches the CURRENT business's accounts/config —
// never any other business that happens to sit in the same local DB.
const currentBusinessId = async () => {
  if (!token) return null;
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
    const u = await mongoose.model('User').findById(payload.id).select('business').lean();
    return u && u.business ? u.business : null;
  } catch (_) { return null; }
};

const applyToLocal = async (collections) => {
  let applied = 0;
  // Apply business DATA and IDENTITY (staff/roles/branches/settings/business) the
  // same way — last-write-wins, preserving the remote updatedAt so sync converges.
  const ALL_MODELS = { ...TENANT_MODELS, ...IDENTITY_MODELS };
  for (const [key, modelName] of Object.entries(ALL_MODELS)) {
    const docs = Array.isArray(collections[key]) ? collections[key] : [];
    if (!docs.length) continue;
    let Model;
    try { Model = mongoose.model(modelName); } catch (_) { continue; }
    for (const doc of docs) {
      const id = doc._id;
      // Last-write-wins: skip if the local copy is newer/equal.
      const existing = id ? await Model.findById(id).select('updatedAt').lean() : null;
      if (!shouldApplyRemote(existing && existing.updatedAt, doc.updatedAt)) continue;
      const clean = { ...doc };
      delete clean.__v;
      // CRITICAL: preserve the remote `updatedAt` instead of letting Mongoose
      // re-stamp it to "now". Re-stamping made every pulled doc look locally
      // modified, so it was pushed back, re-stamped on the cloud, pulled again…
      // an endless echo loop ({pulled:N,pushed:N} every cycle). With timestamps
      // off here, an unchanged doc has remote === local on the next pass and is
      // skipped, so sync converges to {pulled:0,pushed:0}.
      await Model.replaceOne({ _id: id }, clean, { upsert: true, timestamps: false });
      applied++;
    }
  }
  // Apply deletions AFTER all upserts (so a freshly-pulled doc isn't deleted then
  // re-created in the wrong order). Conservative: only deletes docs not modified
  // after the deletion time. See utils/tombstoneSync.js.
  applied += await applyTombstones(collections.tombstones, null);
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

  // Identity (staff logins, roles, branches, settings, business profile), scoped to
  // THIS business only so other businesses in the local DB never leak to the cloud.
  const businessId = await currentBusinessId();
  if (businessId) {
    const identity = await collectIdentity(businessId, since);
    for (const [key, docs] of Object.entries(identity)) {
      if (Array.isArray(docs) && docs.length) {
        collections[key] = docs;
        count += docs.length;
        for (const d of docs) { const t = d.updatedAt ? new Date(d.updatedAt).getTime() : 0; if (t > maxTs) maxTs = t; }
      }
    }

    // Deletions made on this device, to push up so other devices delete too.
    const tombstones = await collectTombstones(businessId, since);
    if (tombstones.length) {
      collections.tombstones = tombstones;
      count += tombstones.length;
      for (const t of tombstones) { const ts = t.updatedAt ? new Date(t.updatedAt).getTime() : 0; if (ts > maxTs) maxTs = ts; }
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
// Strategy: try ONE fast request each way (instant when little has changed). If the
// free cloud tier chokes on a big transfer (502/timeout), fall back to small CHUNKed
// requests so even a large catch-up always completes. So normal use is fast and big
// catch-ups are reliable — like a real app.
const runCloudSync = async () => {
  if (!isConfigured()) return { skipped: 'CLOUD_API_URL not set' };
  if (!token) return { skipped: 'not authenticated to cloud' };

  const cursors = await loadCursors();

  // ---- PULL ----
  let pulledCount = 0;
  try {
    const pulled = await pullRequest(cursors.pull ? { since: cursors.pull } : {});
    pulledCount = await applyToLocal(pulled.collections || {});
    cursors.pull = pulled.cursor || cursors.pull;
  } catch (e) {
    if (!isPayloadError(e)) throw e;
    // chunked fallback: each tenant collection paginated, then identity + tombstones
    let newPull = cursors.pull;
    const advance = (cur) => { if (cur && (!newPull || new Date(cur) > new Date(newPull))) newPull = cur; };
    for (const key of Object.keys(TENANT_MODELS)) {
      const r = await pullCollectionPaged(key, cursors.pull);
      pulledCount += r.applied; advance(r.cursor);
    }
    const idd = await pullRequest(cursors.pull ? { only: 'identity', since: cursors.pull } : { only: 'identity' });
    pulledCount += await applyToLocal(idd.collections || {}); advance(idd.cursor);
    const tsd = await pullRequest(cursors.pull ? { only: 'tombstones', since: cursors.pull } : { only: 'tombstones' });
    pulledCount += await applyToLocal(tsd.collections || {}); advance(tsd.cursor);
    cursors.pull = newPull;
  }

  // ---- PUSH ----
  const { collections, count, newCursor } = await collectLocalChanges(cursors.push);
  let pushedCount = 0;
  if (count > 0) {
    try {
      await pushToCloud(collections);
      pushedCount = count;
    } catch (e) {
      if (!isPayloadError(e)) throw e;
      // chunked fallback: push each collection in CHUNK-sized batches
      pushedCount = 0;
      for (const [key, docs] of Object.entries(collections)) {
        if (!Array.isArray(docs) || !docs.length) continue;
        for (let i = 0; i < docs.length; i += CHUNK) {
          await pushToCloud({ [key]: docs.slice(i, i + CHUNK) });
          pushedCount += Math.min(CHUNK, docs.length - i);
        }
      }
    }
    cursors.push = newCursor;
  }

  await saveCursors(cursors);
  return { pulled: pulledCount, pushed: pushedCount };
};

// Live sync health, surfaced via getStatus() for an in-app indicator/endpoint.
const status = {
  configured: false,
  authenticated: false,
  online: null,        // true/false after the first attempt
  syncing: false,
  lastSyncAt: null,    // ISO time of the last successful pass
  lastResult: null,    // { pulled, pushed }
  lastError: null,     // message of the last failed pass
};
const getStatus = () => ({
  ...status,
  configured: isConfigured(),
  authenticated: hasToken(),
});

// Fire-and-forget a single sync pass (used right after login, and by the loop).
let syncing = false;
const triggerSync = () => {
  if (!isConfigured() || !token || syncing) return;
  syncing = true;
  status.syncing = true;
  runCloudSync()
    .then((r) => {
      if (r && (r.pulled || r.pushed)) console.log('[cloudsync]', JSON.stringify(r));
      if (!r || !r.skipped) {
        status.online = true;
        status.lastError = null;
        status.lastSyncAt = new Date().toISOString();
        if (r && (r.pulled != null || r.pushed != null)) status.lastResult = { pulled: r.pulled || 0, pushed: r.pushed || 0 };
      }
    })
    .catch((e) => {
      // Network/cold-start failures mean offline; a 401 means re-login needed.
      status.online = !/fetch failed|ENOTFOUND|ECONN|timeout|network/i.test(e.message || '');
      status.lastError = e.message;
      console.warn('[cloudsync] error:', e.message);
    })
    .finally(() => { syncing = false; status.syncing = false; });
};

// Background loop: sync every `intervalMs`. On startup it restores the cloud token
// saved on a previous login (so sync resumes after an app restart without forcing a
// re-login) and immediately attempts one sync.
let loopTimer = null;
const startSyncLoop = (intervalMs = Number(process.env.SYNC_INTERVAL_MS) || 30000) => {
  if (!isConfigured()) { console.log('[cloudsync] HTTP cloud sync DISABLED (no CLOUD_API_URL)'); return; }
  if (loopTimer) clearInterval(loopTimer);
  console.log(`[cloudsync] HTTP cloud sync ENABLED — interval ${intervalMs}ms`);
  loopTimer = setInterval(triggerSync, intervalMs);
  // Restore a persisted token, then sync right away so data flows without re-login.
  loadPersistedToken().then((t) => {
    if (t) { console.log('[cloudsync] restored saved cloud session — syncing'); triggerSync(); }
  });
};

module.exports = { cloudLogin, setToken, hasToken, clearToken, runCloudSync, triggerSync, startSyncLoop, isConfigured, api, getStatus };
