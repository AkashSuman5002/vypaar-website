const cron = require('node-cron');
const Setting = require('../models/Setting');
const path = require('path');
const fs = require('fs');
const { getBaseFilter } = require('../utils/queryHelper');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const APP_VERSION = (() => {
  try {
    return require('../package.json').version || '1.0.0';
  } catch (_) {
    return '1.0.0';
  }
})();

// Tenant-scoped models that belong to a single business/user. Each entry maps a
// collection key (used in the backup JSON) to its Mongoose model name. These are
// loaded lazily (by name) so this module stays cheap to require.
const TENANT_MODELS = {
  sales: 'Sale',
  purchases: 'Purchase',
  customers: 'Customer',
  suppliers: 'Supplier',
  products: 'Product',
  expenses: 'Expense',
  transactions: 'Transaction',
  journalEntries: 'JournalEntry',
  accounts: 'Account',
};

const ensureBackupDir = () => {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
};

// Prefix used for this business's backup files so listing/cleanup/download can be
// scoped to the tenant without touching other businesses' files.
const businessPrefix = (businessId) => `backup-${businessId}-`;

// ---------------------------------------------------------------------------
// Whole-DB backup (legacy) — kept intact so server.js's startup call and the
// existing cron keep working.
// ---------------------------------------------------------------------------
const createBackup = async () => {
  try {
    ensureBackupDir();
    const mongoose = require('mongoose');
    const collections = await mongoose.connection.db.listCollections().toArray();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupData = {};

    for (const col of collections) {
      const data = await mongoose.connection.db.collection(col.name).find({}).toArray();
      backupData[col.name] = data;
    }

    const filename = `backup-${timestamp}.json`;
    const filepath = path.join(BACKUP_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2), 'utf8');

    // Clean old whole-DB backups (keep last 7) — use async to avoid blocking.
    // Only target the legacy `backup-<timestamp>` naming, NOT `backup-<businessId>-...`.
    const fsPromises = require('fs').promises;
    const files = (await fsPromises.readdir(BACKUP_DIR))
      .filter(f => f.startsWith('backup-') && f.endsWith('.json') && !/^backup-[a-f0-9]{24}-/i.test(f))
      .sort()
      .reverse();
    for (const f of files.slice(7)) {
      await fsPromises.unlink(path.join(BACKUP_DIR, f)).catch(() => {});
    }

    console.log(`[Backup] Created: ${filename}`);
    return filename;
  } catch (error) {
    console.error('[Backup] Failed:', error.message);
    return null;
  }
};

// ---------------------------------------------------------------------------
// Per-business backup
// ---------------------------------------------------------------------------

// Build the per-business backup JSON object WITHOUT writing a file. Reusable by
// the API, the file writer, and the Drive uploader.
const buildBusinessBackupData = async (req) => {
  const mongoose = require('mongoose');
  const filter = getBaseFilter(req);
  const collections = {};

  for (const [key, modelName] of Object.entries(TENANT_MODELS)) {
    let Model;
    try {
      Model = mongoose.model(modelName);
    } catch (_) {
      // Model not registered (shouldn't happen at runtime) — skip gracefully.
      continue;
    }
    collections[key] = await Model.find(filter).lean();
  }

  return {
    _meta: {
      type: 'vyapar-business-backup',
      version: 1,
      appVersion: APP_VERSION,
      business: req.businessId || null,
      user: req.user && req.user._id ? req.user._id.toString() : null,
      createdAt: new Date().toISOString(),
    },
    collections,
  };
};

// Retention cleanup scoped to a single business's backup files.
const cleanupBusinessBackups = async (businessId, retention) => {
  const fsPromises = require('fs').promises;
  const keep = Number.isFinite(retention) && retention > 0 ? retention : 7;
  const prefix = businessPrefix(businessId);
  const files = (await fsPromises.readdir(BACKUP_DIR))
    .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
    .sort()
    .reverse();
  for (const f of files.slice(keep)) {
    await fsPromises.unlink(path.join(BACKUP_DIR, f)).catch(() => {});
  }
};

// Read the configured retention for the current user (falls back to 7).
const getRetentionForReq = async (req) => {
  try {
    const setting = await Setting.findOne({ user: req.user._id }).select('preferences.general.backupRetention').lean();
    const r = setting && setting.preferences && setting.preferences.general
      ? setting.preferences.general.backupRetention
      : undefined;
    return Number.isFinite(r) && r > 0 ? r : 7;
  } catch (_) {
    return 7;
  }
};

// Create a per-business backup file and return its filename.
const createBusinessBackup = async (req) => {
  ensureBackupDir();
  if (!req.businessId) {
    const err = new Error('No business context available for backup');
    err.statusCode = 400;
    throw err;
  }
  const data = await buildBusinessBackupData(req);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${businessPrefix(req.businessId)}${timestamp}.json`;
  const filepath = path.join(BACKUP_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');

  const retention = await getRetentionForReq(req);
  await cleanupBusinessBackups(req.businessId, retention);

  console.log(`[Backup] Created business backup: ${filename}`);
  return filename;
};

// List backups for THIS business only.
const getBusinessBackupHistory = (businessId) => {
  ensureBackupDir();
  if (!businessId) return [];
  const prefix = businessPrefix(businessId);
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
    .sort()
    .reverse();
  return files.map(f => {
    const stats = fs.statSync(path.join(BACKUP_DIR, f));
    return { filename: f, size: stats.size, createdAt: stats.mtime };
  });
};

// Most-recent backup timestamp for a business (or null).
const getLastBusinessBackup = (businessId) => {
  const history = getBusinessBackupHistory(businessId);
  return history.length ? history[0].createdAt : null;
};

// Validate a filename belongs to this business and resolve to an absolute path.
// Guards against path traversal AND cross-tenant download.
const resolveBusinessBackupPath = (businessId, filename) => {
  if (!businessId || !filename) return null;
  if (path.basename(filename) !== filename) return null;
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) return null;
  if (!filename.startsWith(businessPrefix(businessId))) return null;
  const filepath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filepath)) return null;
  return filepath;
};

// ---------------------------------------------------------------------------
// Auto-backup cron
// ---------------------------------------------------------------------------
let scheduledTask = null;

const Business = require('../models/Business');
const User = require('../models/User');

// Decide whether a backup is due for the configured frequency given the most recent
// backup timestamp. The cron ticks daily, so this gates Daily/Weekly/Monthly:
//   - no previous backup        -> always due
//   - daily                     -> due once >= ~20h since last (tolerates a slightly
//                                   early/late tick so a daily run never silently skips)
//   - weekly                    -> due once >= 7 days since last
//   - monthly                   -> due once >= 28 days since last
const isBackupDue = (frequency, lastBackup) => {
  if (!lastBackup) return true;
  const ageMs = Date.now() - new Date(lastBackup).getTime();
  const hours = ageMs / (1000 * 60 * 60);
  switch (String(frequency || 'daily').toLowerCase()) {
    case 'weekly': return hours >= 7 * 24;
    case 'monthly': return hours >= 28 * 24;
    case 'daily':
    default: return hours >= 20;
  }
};

// Run a per-business backup for every user who has autoBackup enabled AND is due per
// their configured frequency. Each user's default business is resolved the same way
// businessContext does (owned business, or the business they are a member of). Falls
// back gracefully on any per-user error.
const runAutoBackupForAllUsers = async () => {
  const settings = await Setting.find({ 'preferences.general.autoBackup': true })
    .select('user preferences.general.backupFrequency preferences.general.backupRetention')
    .lean();
  if (settings.length === 0) {
    console.log('[AutoBackup] No users with auto-backup enabled');
    return;
  }
  let created = 0;
  let skipped = 0;
  for (const setting of settings) {
    try {
      const user = await User.findById(setting.user).lean();
      if (!user) continue;
      let businessId = user.business ? user.business.toString() : null;
      if (!businessId) {
        const business = await Business.findOne({ owner: user._id, isActive: true })
          .sort({ updatedAt: -1, createdAt: -1 }).lean()
          || await Business.findOne({ owner: user._id }).sort({ createdAt: -1 }).lean();
        if (business) businessId = business._id.toString();
      }
      if (!businessId) continue;

      // Honor the user's chosen frequency: only back up when one is actually due.
      const frequency = (setting.preferences && setting.preferences.general && setting.preferences.general.backupFrequency) || 'daily';
      if (!isBackupDue(frequency, getLastBusinessBackup(businessId))) {
        skipped++;
        continue;
      }

      const req = { user, businessId };
      await createBusinessBackup(req);
      created++;
    } catch (err) {
      console.error(`[AutoBackup] Failed for user ${setting.user}:`, err.message);
    }
  }
  console.log(`[AutoBackup] Per-business backups completed (created: ${created}, skipped/not-due: ${skipped})`);
};

const startAutoBackup = () => {
  stopAutoBackup();
  // Tick daily at 2 AM IST; each user is backed up only when due per their
  // configured frequency (daily/weekly/monthly) — see isBackupDue/runAutoBackupForAllUsers.
  scheduledTask = cron.schedule('0 2 * * *', async () => {
    console.log('[AutoBackup] Running auto-backup tick (frequency-gated)...');
    try {
      await runAutoBackupForAllUsers();
    } catch (err) {
      console.error('[AutoBackup] Run failed:', err.message);
    }
  }, { timezone: 'Asia/Kolkata' });
  console.log('[AutoBackup] Scheduled daily at 2:00 AM IST');
};

const stopAutoBackup = () => {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('[AutoBackup] Scheduler stopped');
  }
};

// ---------------------------------------------------------------------------
// Legacy whole-DB history/download (kept for backward compatibility)
// ---------------------------------------------------------------------------
const getBackupHistory = () => {
  ensureBackupDir();
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
    .sort()
    .reverse();
  return files.map(f => {
    const stats = fs.statSync(path.join(BACKUP_DIR, f));
    return { filename: f, size: stats.size, created: stats.mtime };
  });
};

const downloadBackup = (filename) => {
  if (path.basename(filename) !== filename) return null;
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) return null;
  const filepath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filepath)) return null;
  return filepath;
};

module.exports = {
  // legacy
  createBackup,
  startAutoBackup,
  stopAutoBackup,
  getBackupHistory,
  downloadBackup,
  // per-business
  TENANT_MODELS,
  buildBusinessBackupData,
  createBusinessBackup,
  getBusinessBackupHistory,
  getLastBusinessBackup,
  resolveBusinessBackupPath,
};
