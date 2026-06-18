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
  });
  return _transporter;
};

// Deliver the code to email (if a global SMTP is configured) and phone (dev stub — no SMS
// gateway). Always logs to the server console so it can be used while testing.
const deliverOtp = async (code, { email, phone, name, purpose }) => {
  const subject = purpose === 'register' ? 'Verify your Vyapar account' : 'Your Vyapar login code';
  const text = `Hi${name ? ' ' + name : ''},\n\nYour OTP is ${code}. It expires in 10 minutes.\n\nIf you did not request this, you can ignore this message.`;
  let emailSent = false;
  const smsSent = false;

  if (email) {
    const t = getTransporter();
    if (t) {
      try {
        await t.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@vyapar.local', to: email, subject, text });
        emailSent = true;
      } catch (e) { console.error('[OTP] email send failed:', e.message); }
    }
    if (!emailSent) console.log(`[OTP][email dev] to ${email}: ${code}`);
  }
  if (phone) {
    // No SMS gateway wired in dev mode — surface in the server log.
    console.log(`[OTP][sms dev] to ${phone}: ${code}`);
  }
  return { emailSent, smsSent };
};

module.exports = { createOtp, verifyOtp, deliverOtp, isDev };
