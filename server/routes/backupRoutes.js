const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const mongoose = require('mongoose');
const multer = require('multer');

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

// Fields stripped from restored docs so they re-belong to THIS tenant and don't
// collide with existing _ids.
const STRIP_FIELDS = ['_id', 'business', 'user', 'createdAt', 'updatedAt', '__v'];

const parseBackupBuffer = (buffer) => {
  let json;
  try {
    json = JSON.parse(buffer.toString('utf8'));
  } catch (_) {
    const err = new Error('Uploaded file is not valid JSON');
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

router.post('/restore/execute', authorize('settings:manage'), async (req, res) => {
  try {
    const { id, mode } = req.body || {};
    if (!id || !/^[a-f0-9]{32}$/.test(String(id))) {
      return res.status(400).json({ message: 'Invalid or missing preview id' });
    }
    const restoreMode = mode === 'replace' ? 'replace' : 'merge';

    const tmpName = `${req.businessId}-${id}.json`;
    const tmpPath = path.join(RESTORE_TMP_DIR, tmpName);
    if (!fs.existsSync(tmpPath)) {
      return res.status(404).json({ message: 'Preview not found or expired. Upload again.' });
    }
    const json = parseBackupBuffer(fs.readFileSync(tmpPath));

    const baseFilter = getBaseFilter(req);
    const restored = {};

    await withTransaction(async (session) => {
      for (const [key, modelName] of Object.entries(TENANT_MODELS)) {
        const docs = Array.isArray(json.collections[key]) ? json.collections[key] : [];
        let Model;
        try {
          Model = mongoose.model(modelName);
        } catch (_) {
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

        const toInsert = docs.map((doc) => {
          const clean = { ...doc };
          for (const f of STRIP_FIELDS) delete clean[f];
          // Re-stamp ownership for the current tenant.
          return { ...clean, ...getCreateData(req) };
        });

        const inserted = await Model.insertMany(toInsert, { session, ordered: false });
        restored[key] = inserted.length;
      }
    });

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

module.exports = router;
