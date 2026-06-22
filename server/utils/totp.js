// RFC-6238 TOTP (Time-based One-Time Password) implemented with Node's built-in `crypto`.
// Deliberately NO external dependency (no otplib/speakeasy). HMAC-SHA1, 6 digits, 30s step —
// the defaults that Google Authenticator / Authy / Microsoft Authenticator all expect.
const crypto = require('crypto');

const DIGITS = 6;
const STEP_SECONDS = 30;

// RFC 4648 base32 alphabet (no padding). Authenticator apps consume the secret as base32.
const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// Generate a random base32 secret (default 20 bytes => 32 base32 chars), the standard size.
const generateBase32Secret = (bytes = 20) => {
  const buf = crypto.randomBytes(bytes);
  let bits = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += B32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  return out;
};

// Decode a base32 string back to a Buffer for the HMAC key.
const base32Decode = (input) => {
  const clean = String(input || '').toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = '';
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch);
    if (idx === -1) continue; // skip any stray non-alphabet char
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
};

// HOTP for a given counter (RFC 4226), used by TOTP per time-step.
const hotp = (secretBuf, counter) => {
  const buf = Buffer.alloc(8);
  // Write the 64-bit counter big-endian (high 32 bits are 0 for any realistic timestamp).
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter % 0x100000000, 4);
  const hmac = crypto.createHmac('sha1', secretBuf).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (bin % 10 ** DIGITS).toString().padStart(DIGITS, '0');
};

// Generate the current TOTP code (mainly useful for tests / debugging).
const generateTotp = (base32Secret, atMs = Date.now()) => {
  const counter = Math.floor(atMs / 1000 / STEP_SECONDS);
  return hotp(base32Decode(base32Secret), counter);
};

// Verify a user-supplied token against the secret, allowing ±`window` time steps to
// tolerate clock skew (default ±1 step = ±30s). Uses a constant-time compare per candidate.
const verifyTotp = (token, base32Secret, window = 1, atMs = Date.now()) => {
  const normalized = String(token || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(normalized) || !base32Secret) return false;
  const secretBuf = base32Decode(base32Secret);
  const counter = Math.floor(atMs / 1000 / STEP_SECONDS);
  const expectedBuf = Buffer.from(normalized);
  for (let errorWindow = -window; errorWindow <= window; errorWindow++) {
    const candidate = hotp(secretBuf, counter + errorWindow);
    const candidateBuf = Buffer.from(candidate);
    if (candidateBuf.length === expectedBuf.length &&
        crypto.timingSafeEqual(candidateBuf, expectedBuf)) {
      return true;
    }
  }
  return false;
};

// Build the otpauth:// URI that authenticator apps import (usually via QR code).
const buildOtpauthUrl = ({ secret, label, issuer }) => {
  const enc = encodeURIComponent;
  const acct = enc(label || 'user');
  const iss = enc(issuer || 'Vyapar');
  return `otpauth://totp/${iss}:${acct}?secret=${secret}&issuer=${iss}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
};

module.exports = { generateBase32Secret, generateTotp, verifyTotp, buildOtpauthUrl };
