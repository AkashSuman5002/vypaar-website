const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const Otp = require('../models/Otp');

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

const isDev = () => process.env.NODE_ENV !== 'production';
const generateCode = () => String(crypto.randomInt(100000, 1000000)); // 6 digits

// Create (and persist) an OTP for an identifier+purpose, replacing any previous one.
// Returns the plain code (the caller delivers it; only the hash is stored).
const createOtp = async (identifier, purpose, payload = null) => {
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  await Otp.deleteMany({ identifier, purpose });
  await Otp.create({
    identifier, purpose, codeHash, payload,
    expiresAt: new Date(Date.now() + OTP_TTL_MS), attempts: 0,
  });
  return code;
};

// Verify a submitted code. On success the OTP is consumed (deleted) and its payload returned.
const verifyOtp = async (identifier, purpose, code) => {
  const otp = await Otp.findOne({ identifier, purpose }).sort({ createdAt: -1 });
  if (!otp) return { ok: false, reason: 'No code found. Please request a new one.' };
  if (otp.expiresAt < new Date()) {
    await Otp.deleteOne({ _id: otp._id });
    return { ok: false, reason: 'Code expired. Please request a new one.' };
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    await Otp.deleteOne({ _id: otp._id });
    return { ok: false, reason: 'Too many attempts. Please request a new code.' };
  }
  const match = await bcrypt.compare(String(code), otp.codeHash);
  if (!match) {
    otp.attempts += 1;
    await otp.save();
    return { ok: false, reason: 'Incorrect code.' };
  }
  const payload = otp.payload;
  await Otp.deleteOne({ _id: otp._id });
  return { ok: true, payload };
};

// Optional global SMTP (env) used to actually email OTPs. Without it, dev mode surfaces
// the code in the API response / server log instead.
let _transporter = null;
const getTransporter = () => {
  if (_transporter !== null) return _transporter;
  const host = process.env.SMTP_HOST || process.env.OTP_SMTP_HOST;
  if (!host) { _transporter = false; return false; }
  _transporter = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    // Fail fast instead of hanging when offline / network is slow — the app must stay
    // responsive without internet, so we never wait long on the mail server.
    connectionTimeout: 7000,
    greetingTimeout: 7000,
    socketTimeout: 10000,
  });
  return _transporter;
};

// Deliver the code. OFFLINE-FIRST: the code is always logged locally and returned to the
// UI (via EXPOSE_DEV_OTP), so registration/login works with NO internet. The email is sent
// in the BACKGROUND (fire-and-forget) and never blocks the request — if there's no internet
// or the mail server is slow, registration still completes instantly.
const deliverOtp = async (code, { email, phone, name, purpose }) => {
  const subject = purpose === 'register' ? 'Verify your Vyapar account' : 'Your Vyapar login code';
  const text = `Hi${name ? ' ' + name : ''},\n\nYour OTP is ${code}. It expires in 10 minutes.\n\nIf you did not request this, you can ignore this message.`;

  // Always surface the code locally first (works offline).
  if (email) console.log(`[OTP][email] to ${email}: ${code}`);
  if (phone) console.log(`[OTP][sms dev] to ${phone}: ${code}`);

  // Attempt email delivery in the background only; do not await (no network blocking).
  if (email) {
    const t = getTransporter();
    if (t) {
      t.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@vyapar.local', to: email, subject, text })
        .then(() => console.log(`[OTP] email delivered to ${email}`))
        .catch((e) => console.error('[OTP] background email failed (offline?):', e.message));
    }
  }

  // Return immediately; emailSent is reported false because delivery is async/best-effort.
  return { emailSent: false, smsSent: false };
};

module.exports = { createOtp, verifyOtp, deliverOtp, isDev };
