const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { runSync, getStatus, isEnabled } = require('../services/syncService');
const cloudSyncClient = require('../services/cloudSyncClient');
const { TENANT_MODELS } = require('../services/backupService');
const { collectIdentity, pushIdentity, maxIdentityTs } = require('../utils/identitySync');
const { collectTombstones, applyTombstones, maxTombstoneTs } = require('../utils/tombstoneSync');
const { getBaseFilter } = require('../utils/queryHelper');
const { authorizeAdmin } = require('../middleware/authorize');
const Business = require('../models/Business');
const Setting = require('../models/Setting');
const Branch = require('../models/Branch');
const Role = require('../models/Role');

// ---------------------------------------------------------------------------
// Local sync engine controls (used on the DESKTOP only; no-op on the cloud).
// ---------------------------------------------------------------------------

// Current sync status. Includes both the (mostly-unused) direct-Mongo engine and
// the active HTTP cloud-sync client so the desktop UI can show a live indicator
// (online/offline, last synced, last error / re-login needed).
router.get('/status', (req, res) => {
  res.json({ ...getStatus(), cloud: cloudSyncClient.getStatus() });
});

// Trigger an immediate local sync pass (admin only).
router.post('/now', authorizeAdmin, async (req, res) => {
  if (!isEnabled()) {
    return res.status(400).json({ message: 'Cloud sync is not enabled on this device' });
  }
  try {
    const result = await runSync();
    res.json({ message: 'Sync complete', result });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ---------------------------------------------------------------------------
// Multi-tenant cloud sync API (runs on the CLOUD server; called by each device).
//
// TENANT ISOLATION — enforced entirely server-side:
//   * The tenant (req.businessId) is resolved by businessContext from the AUTHENTICATED
//     token, NEVER from client-supplied data.
//   * pull  -> returns ONLY docs where business === req.businessId.
//   * push  -> FORCES business = req.businessId on every doc, and only matches the caller's
//     own _ids. A client therefore cannot read or overwrite another business's data.
// Only the 31 business-scoped data models (TENANT_MODELS) flow through here; identity
// models (users/business/settings/roles/branches) are handled by the auth flow.
// ---------------------------------------------------------------------------

// GET /api/sync/pull?since=<ISO> — this business's data changed strictly after `since`.
router.get('/pull', async (req, res) => {
  try {
    if (!req.businessId) return res.status(400).json({ message: 'No business context' });
    const since = req.query.since ? new Date(req.query.since) : null;
    const base = getBaseFilter(req); // { business: req.businessId }
    const collections = {};
    let maxTs = since ? since.getTime() : 0;

    for (const [key, modelName] of Object.entries(TENANT_MODELS)) {
      let Model;
      try { Model = mongoose.model(modelName); } catch (_) { continue; }
      const filter = { ...base };
      if (since) filter.updatedAt = { $gt: since };
      const docs = await Model.find(filter).lean();
      collections[key] = docs;
      for (const d of docs) {
        const t = d.updatedAt ? new Date(d.updatedAt).getTime() : 0;
        if (t > maxTs) maxTs = t;
      }
    }

    // Identity models (staff logins, roles, branches, settings, business profile)
    // so a user's devices share the same accounts/config — see utils/identitySync.js.
    const identity = await collectIdentity(req.businessId, since);
    Object.assign(collections, identity);
    const idTs = maxIdentityTs(identity);
    if (idTs > maxTs) maxTs = idTs;

    // Deletions (tombstones) so a delete on one device removes the doc everywhere.
    collections.tombstones = await collectTombstones(req.businessId, since);
    const tTs = maxTombstoneTs(collections.tombstones);
    if (tTs > maxTs) maxTs = tTs;

    res.json({
      serverTime: new Date().toISOString(),
      cursor: maxTs ? new Date(maxTs).toISOString() : (since ? since.toISOString() : null),
      collections,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/sync/push  body: { collections: { key: [docs] } }
// Upserts the caller's records into THIS business (server-authoritative tenant stamp).
router.post('/push', async (req, res) => {
  try {
    if (!req.businessId) return res.status(400).json({ message: 'No business context' });
    const incoming = (req.body && req.body.collections) || {};
    const base = getBaseFilter(req); // { business: req.businessId }
    const applied = {};

    for (const [key, modelName] of Object.entries(TENANT_MODELS)) {
      const docs = Array.isArray(incoming[key]) ? incoming[key] : [];
      if (docs.length === 0) { applied[key] = 0; continue; }
      let Model;
      try { Model = mongoose.model(modelName); } catch (_) { continue; }

      const ops = docs.map((doc) => {
        const clean = { ...doc };
        const id = clean._id;
        delete clean._id;
        delete clean.__v;
        // SERVER-AUTHORITATIVE: force this tenant; preserve authorship if present.
        const setDoc = { ...clean, business: req.businessId };
        if (!setDoc.user && req.user) setDoc.user = req.user._id;
        if (!id) return { insertOne: { document: setDoc } };
        // Match only docs that ALREADY belong to this business — a foreign _id won't match
        // (and can't be hijacked: a global _id collision would fail the insert, not leak).
        return { updateOne: { filter: { _id: id, ...base }, update: { $set: setDoc }, upsert: true } };
      });

      try {
        // timestamps:false PRESERVES the incoming `updatedAt` instead of re-stamping
        // it to "now". Re-stamping on every push made each synced doc look freshly
        // changed, so every device re-pulled and re-pushed it forever (the
        // {pulled:N,pushed:N} echo loop) and broke last-write-wins. Preserving it lets
        // an unchanged doc keep its original timestamp so sync converges to 0/0.
        const r = await Model.bulkWrite(ops, { ordered: false, timestamps: false });
        applied[key] = (r.upsertedCount || 0) + (r.modifiedCount || 0) + (r.matchedCount || 0) + (r.insertedCount || 0);
      } catch (bulkErr) {
        // ordered:false means valid ops still applied; report partial + the reason.
        applied[key] = bulkErr.result ? (bulkErr.result.nUpserted + bulkErr.result.nModified) : 0;
      }
    }

    // Identity models — scoped upsert into this tenant only (own business/users).
    const identityApplied = await pushIdentity(req.businessId, incoming);
    Object.assign(applied, identityApplied);

    // Deletions — apply incoming tombstones (delete the referenced docs on the cloud,
    // scoped to this tenant) so other devices then pull the deletion too.
    applied.tombstones = await applyTombstones(incoming.tombstones, req.businessId);

    res.json({ applied });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// GET /api/sync/bootstrap — the authenticated account's IDENTITY bundle, so a fresh
// device can mirror it locally (with the SAME _ids) before pulling data. Returns ONLY
// this caller's own identity (scoped by req.user / req.businessId) — no cross-tenant data.
router.get('/bootstrap', async (req, res) => {
  try {
    if (!req.businessId) return res.status(400).json({ message: 'No business context' });
    const [business, setting, branches, roles] = await Promise.all([
      Business.findById(req.businessId).lean(),
      Setting.findOne({ user: req.user._id }).lean(),
      Branch.find({ business: req.businessId }).lean(),
      Role.find({ business: req.businessId }).lean(),
    ]);
    res.json({
      user: req.user, // password already stripped by authMiddleware (.select('-password'))
      business: business || null,
      setting: setting || null,
      branches: branches || [],
      roles: roles || [],
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
