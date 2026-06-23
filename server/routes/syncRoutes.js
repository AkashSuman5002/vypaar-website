const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { runSync, getStatus, isEnabled } = require('../services/syncService');
const { TENANT_MODELS } = require('../services/backupService');
const { getBaseFilter } = require('../utils/queryHelper');
const { authorizeAdmin } = require('../middleware/authorize');

// ---------------------------------------------------------------------------
// Local sync engine controls (used on the DESKTOP only; no-op on the cloud).
// ---------------------------------------------------------------------------

// Current sync status (enabled? connected? last pass summary).
router.get('/status', (req, res) => {
  res.json(getStatus());
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
        const r = await Model.bulkWrite(ops, { ordered: false });
        applied[key] = (r.upsertedCount || 0) + (r.modifiedCount || 0) + (r.matchedCount || 0) + (r.insertedCount || 0);
      } catch (bulkErr) {
        // ordered:false means valid ops still applied; report partial + the reason.
        applied[key] = bulkErr.result ? (bulkErr.result.nUpserted + bulkErr.result.nModified) : 0;
      }
    }

    res.json({ applied });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
