const cron = require('node-cron');
const Setting = require('../models/Setting');
const path = require('path');
const fs = require('fs');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');

const ensureBackupDir = () => {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
};

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

    // Clean old backups (keep last 7) — use async to avoid blocking
    const fsPromises = require('fs').promises;
    const files = (await fsPromises.readdir(BACKUP_DIR))
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
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

const startAutoBackup = () => {
  cron.schedule('0 2 * * *', async () => {
    console.log('[AutoBackup] Running daily backup...');
    const users = await Setting.find({ 'preferences.general.autoBackup': true }).select('user');
    if (users.length === 0) {
      console.log('[AutoBackup] No users with auto-backup enabled');
      return;
    }
    await createBackup();
    console.log('[AutoBackup] Backup completed');
  }, { timezone: 'Asia/Kolkata' });
  console.log('[AutoBackup] Scheduled daily at 2:00 AM IST');
};

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

module.exports = { createBackup, startAutoBackup, getBackupHistory, downloadBackup };
