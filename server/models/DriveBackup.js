const mongoose = require('mongoose');
const crypto = require('crypto');

// Symmetric encryption for the Google refresh token at rest. The key is derived
// from JWT_SECRET via scrypt so we don't introduce a new secret to manage. Format
// stored: "<ivHex>:<authTagHex>:<cipherHex>".
const ALGO = 'aes-256-gcm';

const getKey = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required to encrypt/decrypt Drive tokens');
  // Static salt is acceptable here: confidentiality derives from JWT_SECRET, and a
  // random per-record IV (below) guarantees unique ciphertext for identical input.
  return crypto.scryptSync(secret, 'vyapar-drive-backup', 32);
};

const encrypt = (plain) => {
  if (plain == null) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
};

const decrypt = (payload) => {
  if (!payload) return '';
  const parts = String(payload).split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted token format');
  const [ivHex, tagHex, dataHex] = parts;
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return dec.toString('utf8');
};

const driveBackupSchema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, unique: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  email: { type: String, default: '' },
  // Stored encrypted (see encrypt/decrypt). Use getRefreshToken()/setRefreshToken().
  refreshToken: { type: String, default: '' },
  lastBackupAt: { type: Date, default: null },
  lastFileId: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: false });

driveBackupSchema.methods.setRefreshToken = function (token) {
  this.refreshToken = encrypt(token);
};

driveBackupSchema.methods.getRefreshToken = function () {
  return decrypt(this.refreshToken);
};

const DriveBackup = mongoose.model('DriveBackup', driveBackupSchema);

// Expose helpers for callers that store via findOneAndUpdate (which bypasses
// instance methods).
DriveBackup.encrypt = encrypt;
DriveBackup.decrypt = decrypt;

module.exports = DriveBackup;
