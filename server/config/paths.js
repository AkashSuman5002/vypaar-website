const path = require('path');
const fs = require('fs');

// Single source of truth for all WRITABLE runtime data directories.
//
// In the packaged desktop app, Electron passes DATA_DIR=<app userData> when it
// spawns the backend, so backups / uploads / exports / WhatsApp sessions live in
// the per-user data folder and SURVIVE uninstall, reinstall and app updates.
//
// In development (DATA_DIR unset) this falls back to the server folder, preserving
// the previous behaviour so nothing changes for local dev.
//
// NOTE: the public URL prefix for served files stays "/uploads/..." regardless of
// where UPLOADS_DIR physically points — only the filesystem location moves, so any
// "/uploads/logo-123.png" value already stored in the DB keeps resolving.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..');

const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const IMPORTS_DIR = path.join(UPLOADS_DIR, 'imports');
const BARCODES_DIR = path.join(UPLOADS_DIR, 'barcodes');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const EXPORTS_DIR = path.join(DATA_DIR, 'exports');
const WHATSAPP_SESSIONS_DIR = path.join(DATA_DIR, 'whatsapp-sessions');

const ensureDir = (dir) => {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (_) {
    /* best-effort: a failure here surfaces later at the actual write site */
  }
};

[UPLOADS_DIR, IMPORTS_DIR, BARCODES_DIR, BACKUPS_DIR, EXPORTS_DIR, WHATSAPP_SESSIONS_DIR].forEach(ensureDir);

module.exports = {
  DATA_DIR,
  UPLOADS_DIR,
  IMPORTS_DIR,
  BARCODES_DIR,
  BACKUPS_DIR,
  EXPORTS_DIR,
  WHATSAPP_SESSIONS_DIR,
};
