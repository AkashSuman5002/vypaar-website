const crypto = require('crypto');

// Symmetric encryption for notification secrets (SMTP password, SMS API keys)
// at rest. The key is derived from JWT_SECRET via scrypt so we don't introduce a
// new secret to manage. Stored format: "<ivHex>:<authTagHex>:<cipherHex>".
// This mirrors the approach in models/DriveBackup.js for consistency.
const ALGO = 'aes-256-gcm';

const getKey = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required to encrypt/decrypt notification secrets');
  // Static salt is acceptable: confidentiality derives from JWT_SECRET, and a
  // random per-record IV (below) guarantees unique ciphertext for identical input.
  return crypto.scryptSync(secret, 'vyapar-notification-secret', 32);
};

// Returns true if the value already looks like our encrypted format, so we can
// avoid double-encrypting and can treat legacy plaintext as passthrough.
const isEncrypted = (value) => {
  if (!value || typeof value !== 'string') return false;
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  return parts.every((p) => p.length > 0 && /^[0-9a-f]+$/i.test(p));
};

const encryptSecret = (plain) => {
  // Don't encrypt empty values; keep them empty.
  if (plain == null || plain === '') return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
};

const decryptSecret = (stored) => {
  if (!stored) return '';
  // Legacy plaintext (or anything not in our format) passes through unchanged so
  // existing un-encrypted values still read correctly.
  if (!isEncrypted(stored)) return String(stored);
  try {
    const [ivHex, tagHex, dataHex] = String(stored).split(':');
    const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    return dec.toString('utf8');
  } catch {
    // If decryption fails (e.g. value coincidentally matched the format), return
    // the raw input rather than throwing, to stay robust.
    return String(stored);
  }
};

module.exports = { encryptSecret, decryptSecret, isEncrypted };
