const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const mongoose = require('mongoose');
const multer = require('multer');
const AdmZip = require('adm-zip');

const {
  createBusinessBackup,
  getBusinessBackupHistory,
  getLastBusinessBackup,
  resolveBusinessBackupPath,
  buildBusinessBackupData,
  TENANT_MODELS,
} = require('../services/backupService');
const driveService = require('../services/driveService');
const { authorize } = require('../middleware/authorize');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');
const { withTransaction } = require('../utils/withTransaction');
const Setting = require('../models/Setting');
const DriveBackup = require('../models/DriveBackup');

const router = express.Router();

// In-memory multer for restore uploads only (these two routes). 20MB cap.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// Temp dir for parsed restore payloads referenced by id between preview/execute.
const RESTORE_TMP_DIR = path.join(os.tmpdir(), 'vyapar-restore');
const ensureRestoreTmp = () => {
  if (!fs.existsSync(RESTORE_TMP_DIR)) fs.mkdirSync(RESTORE_TMP_DIR, { recursive: true });
};

// =====================================================================
// A) PER-BUSINESS BACKUP
// =====================================================================

router.post('/create', authorize('settings:manage'), async (req, res) => {
  try {
    const filename = await createBusinessBackup(req);
    res.json({ message: 'Backup created', filename });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.get('/history', authorize('settings:view'), (req, res) => {
  try {
    const history = getBusinessBackupHistory(req.businessId);
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/download/:filename', authorize('settings:view'), (req, res) => {
  try {
    const filepath = resolveBusinessBackupPath(req.businessId, req.params.filename);
    if (!filepath) return res.status(404).json({ message: 'Backup not found' });
    res.download(filepath);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// =====================================================================
// B) BACKUP CONFIG
// =====================================================================

router.get('/config', authorize('settings:view'), async (req, res) => {
  try {
    const setting = await Setting.findOne({ user: req.user._id })
      .select('preferences.general.autoBackup preferences.general.backupFrequency preferences.general.backupRetention')
      .lean();
    const general = (setting && setting.preferences && setting.preferences.general) || {};
    res.json({
      autoBackup: general.autoBackup !== undefined ? general.autoBackup : true,
      frequency: general.backupFrequency || 'daily',
      retention: general.backupRetention !== undefined ? general.backupRetention : 7,
      lastBackup: getLastBusinessBackup(req.businessId),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/config', authorize('settings:manage'), async (req, res) => {
  try {
    const { autoBackup, frequency, retention } = req.body || {};
    const set = {};
    if (autoBackup !== undefined) set['preferences.general.autoBackup'] = !!autoBackup;
    if (frequency !== undefined) set['preferences.general.backupFrequency'] = String(frequency);
    if (retention !== undefined) {
      const r = parseInt(retention, 10);
      if (Number.isFinite(r) && r > 0) set['preferences.general.backupRetention'] = r;
    }
    const setting = await Setting.findOneAndUpdate(
      { user: req.user._id },
      { $set: set },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).select('preferences.general.autoBackup preferences.general.backupFrequency preferences.general.backupRetention').lean();
    const general = (setting && setting.preferences && setting.preferences.general) || {};
    res.json({
      message: 'Backup config updated',
      autoBackup: general.autoBackup !== undefined ? general.autoBackup : true,
      frequency: general.backupFrequency || 'daily',
      retention: general.backupRetention !== undefined ? general.backupRetention : 7,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// =====================================================================
// C) RESTORE
// =====================================================================

// Ownership/bookkeeping fields stripped from each restored doc before it is
// re-stamped for THIS tenant. NOTE: `_id` is intentionally KEPT (handled separately
// as the upsert key) so that (a) restoring the same backup twice updates in place
// instead of creating duplicates, and (b) inter-document references (e.g. a sale's
// customer id) stay valid after a restore.
const STRIP_FIELDS = ['business', 'user', 'createdAt', 'updatedAt', '__v'];

// Detect a ZIP archive by its magic bytes (PK\x03\x04). The download produced by
// exportController.backupExport is a ZIP of per-collection JSON files, while the
// backupService backup is a single JSON document — restore must accept both.
const isZipBuffer = (buffer) =>
  Buffer.isBuffer(buffer) && buffer.length >= 4 &&
  buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;

// Maps the file names produced by exportController.backupExport to the collection
// keys understood by restore (TENANT_MODELS). Entries with no matching model
// (settings, payments, gst, stock) are intentionally omitted — restore only
// rehydrates tenant-scoped business documents it has a model for.
const ZIP_FILE_TO_COLLECTION = {
  'customers.json': 'customers',
  'suppliers.json': 'suppliers',
  'products.json': 'products',
  'sales.json': 'sales',
  'purchases.json': 'purchases',
  'expenses.json': 'expenses',
};

// Build the canonical { collections: {...} } shape from a backupExport ZIP.
const parseBackupZip = (buffer) => {
  let zip;
  try {
    zip = new AdmZip(buffer);
  } catch (_) {
    const err = new Error('Uploaded ZIP backup could not be read');
    err.statusCode = 422;
    throw err;
  }

  const collections = {};
  let meta = null;
  let matched = 0;

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const name = path.basename(entry.entryName).toLowerCase();

    if (name === 'backup-info.json') {
      try { meta = JSON.parse(entry.getData().toString('utf8')); } catch (_) { /* ignore */ }
      continue;
    }

    const key = ZIP_FILE_TO_COLLECTION[name];
    if (!key) continue;
    try {
      const parsed = JSON.parse(entry.getData().toString('utf8'));
      if (Array.isArray(parsed)) { collections[key] = parsed; matched++; }
    } catch (_) { /* skip unparsable entry */ }
  }

  if (matched === 0) {
    const err = new Error('Not a valid Vyapar business backup archive (no recognized collection files found)');
    err.statusCode = 422;
    throw err;
  }
  return { _meta: meta, collections };
};

const parseBackupBuffer = (buffer) => {
  // ZIP backup (from exportController.backupExport): unpack into the canonical shape.
  if (isZipBuffer(buffer)) {
    return parseBackupZip(buffer);
  }

  // Raw JSON backup (from backupService): a single { _meta, collections } document.
  let json;
  try {
    json = JSON.parse(buffer.toString('utf8'));
  } catch (_) {
    const err = new Error('Uploaded file is not valid JSON or ZIP');
    err.statusCode = 422;
    throw err;
  }
  if (!json || typeof json !== 'object' || !json.collections || typeof json.collections !== 'object') {
    const err = new Error('Not a valid Vyapar business backup file');
    err.statusCode = 422;
    throw err;
  }
  return json;
};

router.post('/restore/preview', authorize('settings:manage'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(422).json({ message: 'No backup file uploaded (field "file")' });
    }
    const json = parseBackupBuffer(req.file.buffer);

    const counts = {};
    for (const key of Object.keys(TENANT_MODELS)) {
      counts[key] = Array.isArray(json.collections[key]) ? json.collections[key].length : 0;
    }

    ensureRestoreTmp();
    const id = crypto.randomBytes(16).toString('hex');
    // Scope the temp file to this business so an id from one tenant can't be
    // replayed by another.
    const tmpName = `${req.businessId}-${id}.json`;
    fs.writeFileSync(path.join(RESTORE_TMP_DIR, tmpName), JSON.stringify(json), 'utf8');

    res.json({
      id,
      meta: json._meta || null,
      counts,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

// Normalize the client-supplied mode to the two restore semantics. The client
// (RestoreBackup.js) sends 'overwrite' for a destructive replace and 'merge'
// otherwise. Honor 'overwrite' (and legacy 'replace') as a wipe; anything else
// is a safe merge/upsert. Previously only 'replace' was treated as a wipe, so
// selecting "Overwrite" silently fell through to merge (#56).
const normalizeRestoreMode = (mode) =>
  (mode === 'overwrite' || mode === 'replace') ? 'replace' : 'merge';

// Shared restore execution: given a parsed backup ({ collections }) and the
// request (for tenant scoping), wipe-and-insert ('replace') or merge-insert
// ('merge') each tenant collection inside a transaction. Tenant-scoped via
// getBaseFilter (delete) and getCreateData (insert). Reused by both the local
// /restore/execute route and the Drive /drive/restore route so the two share
// one code path.
const applyRestore = async (req, json, restoreMode) => {
  const baseFilter = getBaseFilter(req);
  const restored = {};

  await withTransaction(async (session) => {
    for (const [key, modelName] of Object.entries(TENANT_MODELS)) {
      // A collection is "present" only if the backup explicitly includes it as an
      // array. This matters because a partial backup (e.g. the 6-collection export
      // ZIP) must NOT cause the other collections to be wiped on a 'replace' restore
      // — only collections the backup actually carries are touched.
      const present = Array.isArray(json.collections[key]);
      const docs = present ? json.collections[key] : [];
      let Model;
      try {
        Model = mongoose.model(modelName);
      } catch (_) {
        continue;
      }

      // Skip collections the backup doesn't include — never wipe data the backup
      // had no intention of replacing.
      if (!present) {
        restored[key] = 0;
        continue;
      }

      if (restoreMode === 'replace') {
        // Wipe THIS tenant's existing docs for the collection, then insert.
        await Model.deleteMany(baseFilter, { session });
      }

      if (docs.length === 0) {
        restored[key] = 0;
        continue;
      }

      // Idempotent restore: upsert each doc by its original _id, re-stamping it for
      // the current tenant. Re-running the same restore therefore UPDATES the existing
      // rows instead of inserting duplicates (the old insertMany duplicated on every
      // run). Docs without an _id (shouldn't happen for our backups) fall back to a
      // plain insert. In 'replace' mode the collection was already wiped above, so
      // these upserts simply re-insert with the original ids preserved.
      const ops = docs.map((doc) => {
        const clean = { ...doc };
        for (const f of STRIP_FIELDS) delete clean[f];
        const id = clean._id;
        delete clean._id;
        const setDoc = { ...clean, ...getCreateData(req) };
        if (id) {
          // On upsert-insert Mongo uses the filter's _id as the new doc's _id.
          return { updateOne: { filter: { _id: id }, update: { $set: setDoc }, upsert: true } };
        }
        return { insertOne: { document: setDoc } };
      });

      const result = await Model.bulkWrite(ops, { session, ordered: false });
      restored[key] = (result.upsertedCount || 0) + (result.modifiedCount || 0) +
        (result.matchedCount || 0) + (result.insertedCount || 0);
    }
  });

  return restored;
};

router.post('/restore/execute', authorize('settings:manage'), async (req, res) => {
  try {
    const { id, mode } = req.body || {};
    if (!id || !/^[a-f0-9]{32}$/.test(String(id))) {
      return res.status(400).json({ message: 'Invalid or missing preview id' });
    }
    const restoreMode = normalizeRestoreMode(mode);

    const tmpName = `${req.businessId}-${id}.json`;
    const tmpPath = path.join(RESTORE_TMP_DIR, tmpName);
    if (!fs.existsSync(tmpPath)) {
      return res.status(404).json({ message: 'Preview not found or expired. Upload again.' });
    }
    const json = parseBackupBuffer(fs.readFileSync(tmpPath));

    const restored = await applyRestore(req, json, restoreMode);

    // Best-effort cleanup of the temp payload (outside the txn).
    fs.unlink(tmpPath, () => {});

    res.json({ message: 'Restore completed', mode: restoreMode, restored });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

// =====================================================================
// D) GOOGLE DRIVE
// =====================================================================

router.get('/drive/status', authorize('settings:view'), async (req, res) => {
  try {
    const record = await DriveBackup.findOne({ business: req.businessId }).lean();
    res.json({
      configured: driveService.isConfigured(),
      connected: !!record,
      email: record ? record.email : null,
      lastBackup: record ? record.lastBackupAt : null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/drive/auth-url', authorize('settings:manage'), (req, res) => {
  try {
    if (!driveService.isConfigured()) {
      return res.status(400).json({ message: 'Google Drive is not configured on the server' });
    }
    res.json({ url: driveService.getAuthUrl() });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/drive/connect', authorize('settings:manage'), async (req, res) => {
  try {
    if (!driveService.isConfigured()) {
      return res.status(400).json({ message: 'Google Drive is not configured on the server' });
    }
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ message: 'Authorization code is required' });

    const { refreshToken, email } = await driveService.exchangeCode(code);

    await DriveBackup.findOneAndUpdate(
      { business: req.businessId },
      {
        $set: {
          user: req.user._id,
          email: email || '',
          refreshToken: DriveBackup.encrypt(refreshToken),
        },
        $setOnInsert: { business: req.businessId, createdAt: new Date() },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ connected: true, email: email || null });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

router.post('/drive/disconnect', authorize('settings:manage'), async (req, res) => {
  try {
    await DriveBackup.deleteOne({ business: req.businessId });
    res.json({ message: 'Google Drive disconnected', connected: false });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/drive/backup', authorize('settings:manage'), async (req, res) => {
  try {
    if (!driveService.isConfigured()) {
      return res.status(400).json({ message: 'Google Drive is not configured on the server' });
    }
    const record = await DriveBackup.findOne({ business: req.businessId });
    if (!record) return res.status(400).json({ message: 'Google Drive is not connected' });

    const refreshToken = record.getRefreshToken();
    const accessToken = await driveService.refreshAccessToken(refreshToken);

    const data = await buildBusinessBackupData(req);
    const jsonString = JSON.stringify(data, null, 2);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${req.businessId}-${timestamp}.json`;

    const fileId = await driveService.uploadBackup(accessToken, filename, jsonString);

    record.lastBackupAt = new Date();
    record.lastFileId = fileId || '';
    await record.save();

    res.json({ message: 'Backup uploaded to Google Drive', lastBackup: record.lastBackupAt });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

// List the backup files available in the connected Drive account.
router.get('/drive/backups', authorize('settings:view'), async (req, res) => {
  try {
    if (!driveService.isConfigured()) {
      return res.status(400).json({ message: 'Google Drive is not configured on the server' });
    }
    const record = await DriveBackup.findOne({ business: req.businessId });
    if (!record) return res.status(400).json({ message: 'Google Drive is not connected' });

    const refreshToken = record.getRefreshToken();
    const accessToken = await driveService.refreshAccessToken(refreshToken);

    const backups = await driveService.listBackups(accessToken);
    res.json({ backups });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

// Download a chosen backup from Drive and restore it through the SAME tenant-scoped
// restore code path used by the local restore (applyRestore). Honors the same
// overwrite/merge mode semantics.
router.post('/drive/restore', authorize('settings:manage'), async (req, res) => {
  try {
    if (!driveService.isConfigured()) {
      return res.status(400).json({ message: 'Google Drive is not configured on the server' });
    }
    const { fileId, mode } = req.body || {};
    if (!fileId) return res.status(400).json({ message: 'fileId is required' });

    const record = await DriveBackup.findOne({ business: req.businessId });
    if (!record) return res.status(400).json({ message: 'Google Drive is not connected' });

    const refreshToken = record.getRefreshToken();
    const accessToken = await driveService.refreshAccessToken(refreshToken);

    const buffer = await driveService.downloadBackup(accessToken, fileId);
    const json = parseBackupBuffer(buffer);

    const restoreMode = normalizeRestoreMode(mode);
    const restored = await applyRestore(req, json, restoreMode);

    res.json({ message: 'Restore completed from Google Drive', mode: restoreMode, restored });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
});

module.exports = router;
