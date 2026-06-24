const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Business = require('../models/Business');
const Setting = require('../models/Setting');
const Branch = require('../models/Branch');
const Role = require('../models/Role');
const { JWT_SECRET } = require('../middleware/auth');
const { authMiddleware } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { csrfProtection, generateCsrfToken, CSRF_COOKIE } = require('../middleware/csrf');
const { sendPasswordResetEmail } = require('../services/emailService');
const { createOtp, verifyOtp, deliverOtp, isDev } = require('../utils/otpAuth');
const { verifyTotp } = require('../utils/totp');
const { withTransaction } = require('../utils/withTransaction');
// Cloud-first auth (desktop in cloud mode). No-op on the cloud server itself and on a
// purely local install (both have CLOUD_API_URL unset => cloudAuth.isCloudMode() false).
const cloudAuth = require('../services/cloudAuth');
const cloudSyncClient = require('../services/cloudSyncClient');
const nodemailer = require('nodemailer');

// Global SMTP transporter built from env vars (SMTP_HOST/PORT/USER/PASS), used for
// SYSTEM emails like password-reset links. Configured on the cloud server only. Gmail
// app passwords are shown with spaces but must be sent without them, so we strip them.
let _envTransporter;
const getEnvTransporter = () => {
  if (_envTransporter !== undefined) return _envTransporter;
  const host = process.env.SMTP_HOST;
  if (!host) { _envTransporter = null; return null; }
  _envTransporter = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: (process.env.SMTP_PASS || '').replace(/\s+/g, '') } : undefined,
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 20000,
  });
  return _envTransporter;
};
// Returns true if the reset email was actually sent via env SMTP.
const sendResetEmailViaEnvSmtp = async (to, resetUrl) => {
  const t = getEnvTransporter();
  if (!t) return false;
  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: 'Reset your Vyapar password',
    text: `We received a request to reset your Vyapar password.\n\nReset it here (valid for 1 hour):\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: `<p>We received a request to reset your <b>Vyapar</b> password.</p><p><a href="${resetUrl}">Click here to reset your password</a> (valid for 1 hour).</p><p>Or paste this link:<br>${resetUrl}</p><p>If you didn't request this, you can safely ignore this email.</p>`,
  });
  return true;
};

const router = express.Router();

const generateToken = (user) => {
  // `tv` (token version) enables backward-compatible token revocation: auth middleware
  // rejects a token whose tv no longer matches the user's current tokenVersion.
  return jwt.sign({ id: user._id, email: user.email, tv: user.tokenVersion || 0 }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
};

const TOKEN_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// Ensure the user has a resolved business / settings, mirroring the password-login logic.
// Owners with no business get one provisioned; members keep their assigned business.
const ensureBusinessAndSettings = async (user) => {
  let business = null;
  if (user.business) {
    business = await Business.findById(user.business);
  } else {
    business = await Business.findOne({ owner: user._id }).sort({ createdAt: -1 });
    if (!business) {
      business = await Business.create({ name: user.name + "'s Business", email: user.email, owner: user._id, isActive: true });
      await Branch.create({ name: 'Main Branch', business: business._id, isActive: true });
      await Role.create({ name: 'Admin', business: business._id, permissions: ['*'], isDefault: true });
    }
  }
  const fallbackBusinessName = business ? business.name : (user.name + "'s Business");
  let setting = await Setting.findOne({ user: user._id });
  if (!setting) {
    setting = await Setting.create({ user: user._id, businessName: fallbackBusinessName, email: user.email });
  } else if (!setting.businessName && fallbackBusinessName) {
    setting.businessName = fallbackBusinessName;
    await setting.save();
  }
};

// Issue the JWT exactly as a normal successful login: set the httpOnly `token` cookie. The token
// is NOT returned in the body (cookie-only auth via the same-origin CRA proxy — see auth.js).
const issueLoginResponse = (res, user, status = 200) => {
  const token = generateToken(user);
  res.cookie('token', token, TOKEN_COOKIE_OPTS);
  return res.status(status).json({ ...user.toJSON() });
};

// The dev OTP is only ever returned in the HTTP response when explicitly opted-in via
// EXPOSE_DEV_OTP=true AND we're not in production. Otherwise the code is never put in the
// response body (it may still be console-logged elsewhere by the OTP delivery utility).
const exposeDevOtp = () =>
  process.env.NODE_ENV !== 'production' &&
  String(process.env.EXPOSE_DEV_OTP).toLowerCase() === 'true';

const normalizeEmail = (email = '') => email.trim().toLowerCase();
const normalizePhone = (p = '') => String(p).replace(/[\s-]/g, '').trim();

// A constant, valid bcrypt hash (cost 12, matching the User model) used to run a dummy
// compare when a login email doesn't exist. This keeps the response timing similar to the
// real path so attackers can't use timing to enumerate which emails have accounts.
const DUMMY_PASSWORD_HASH = '$2a$12$5WwsJp.osusMCBqdV9rA/uGHIObqqN7TlfWVGisC1TWHlCVlwmApi';

// Per-account login lockout. In-memory and PER-PROCESS only (not shared across cluster
// workers / multiple instances) — a deliberate simple defense-in-depth on top of the
// IP-based authLimiter. After LOCKOUT_MAX failed password attempts within LOCKOUT_WINDOW_MS
// the account is temporarily blocked. The entry is cleared on a successful login.
const LOCKOUT_MAX = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const loginFailures = new Map(); // email -> { count, firstAt }

const isLockedOut = (email) => {
  const rec = loginFailures.get(email);
  if (!rec) return false;
  if (Date.now() - rec.firstAt >= LOCKOUT_WINDOW_MS) {
    loginFailures.delete(email); // window expired — reset
    return false;
  }
  return rec.count >= LOCKOUT_MAX;
};

const recordLoginFailure = (email) => {
  const now = Date.now();
  const rec = loginFailures.get(email);
  if (!rec || now - rec.firstAt >= LOCKOUT_WINDOW_MS) {
    loginFailures.set(email, { count: 1, firstAt: now });
  } else {
    rec.count += 1;
  }
};

const clearLoginFailures = (email) => loginFailures.delete(email);

// Create the full account (user + business + branch + default role + settings) atomically.
// All creates run inside a single transaction so a failure rolls everything back — there is
// never an orphan User without its Business/Branch/Role/Setting.
//
// Used by BOTH the password-based /register and the verified passwordless /register/verify.
// `password` is optional: when omitted the account is passwordless (OTP) and `isVerified` is
// set true (the OTP already proved ownership); when present the User pre('save') hook still
// hashes it (Model.create runs the same save hooks), so password hashing is preserved.
const provisionAccount = async ({ name, email, phone, password, isVerified }) => {
  return withTransaction(async (session) => {
    const userDoc = { name, email, phone: phone || '', role: 'admin', isOwner: true };
    if (password) userDoc.password = password;
    if (isVerified) userDoc.isVerified = true;
    // Array form is required to pass a session; create() returns an array — destructure it.
    const [user] = await User.create([userDoc], { session });
    const [business] = await Business.create([
      { name: name + "'s Business", email: user.email, phone: phone || '', owner: user._id, isActive: true },
    ], { session });
    await Branch.create([{ name: 'Main Branch', business: business._id, isActive: true }], { session });
    await Role.create([{ name: 'Admin', business: business._id, permissions: ['*'], isDefault: true }], { session });
    await Setting.create([
      { user: user._id, businessName: business.name, email: user.email, phone: phone || '' },
    ], { session });
    return user;
  });
};

router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }
    const normalizedEmail = normalizeEmail(email);

    // CLOUD MODE (desktop): create the account on the cloud, then mirror it into the
    // local DB and issue a local session. Registration requires internet (the account
    // is created on the cloud — there is no offline registration in a multi-device product).
    if (cloudAuth.isCloudMode()) {
      try {
        const user = await cloudAuth.cloudRegisterAndMirror(name, normalizedEmail, password);
        const full = await User.findById(user._id);
        const token = generateToken(full);
        res.cookie('token', token, TOKEN_COOKIE_OPTS);
        cloudSyncClient.triggerSync(); // pull any existing cloud data immediately
        return res.status(201).json({ ...full.toJSON() });
      } catch (e) {
        if (e.network) return res.status(503).json({ message: 'No internet connection. Creating an account needs internet.' });
        return res.status(400).json({ message: e.message || 'Registration failed' });
      }
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    // Provision User + Business + Branch + Role + Setting atomically (see provisionAccount).
    // The password is passed through and hashed by the User pre('save') hook.
    const user = await provisionAccount({ name, email: normalizedEmail, password });

    const token = generateToken(user);
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.status(201).json({ ...user.toJSON() });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    const normEmail = normalizeEmail(email);

    // CLOUD MODE (desktop): authenticate against the cloud and mirror identity locally,
    // then issue a local session. If the cloud is unreachable (offline) we fall through to
    // local auth using the cached user + local password hash written on a previous login.
    if (cloudAuth.isCloudMode()) {
      try {
        const cu = await cloudAuth.cloudLoginAndMirror(normEmail, password);
        const full = await User.findById(cu._id);
        if (full && full.twoFactorEnabled) {
          return res.json({ twoFactorRequired: true, userId: full._id });
        }
        clearLoginFailures(normEmail);
        const token = generateToken(full);
        res.cookie('token', token, TOKEN_COOKIE_OPTS);
        cloudSyncClient.triggerSync(); // pull this account's data from the cloud immediately
        return res.json({ ...full.toJSON() });
      } catch (e) {
        // Whether the cloud REJECTED the credentials or was simply unreachable, fall
        // through to LOCAL auth below. A team member / sub-user added on THIS device
        // lives only in the local DB (it is never provisioned to the cloud), so the
        // cloud genuinely doesn't know it and returns 401 — that must NOT block a
        // valid local login. Local auth below still rejects a wrong email/password,
        // so this does not weaken security for real cloud accounts.
        if (!e.cloudAuthFail) {
          console.warn('[cloudAuth] cloud login unavailable, trying offline local login:', e.message);
        }
      }
    }

    // Per-account lockout: short-circuit BEFORE checking the password once too many recent
    // failures have accumulated for this email (see loginFailures map above).
    if (isLockedOut(normEmail)) {
      return res.status(429).json({ message: 'Too many failed attempts, try again later' });
    }

    const user = await User.findOne({ email: normEmail });
    if (!user) {
      // Perform a dummy bcrypt compare so the response timing matches the valid-user path,
      // preventing attackers from enumerating accounts via login timing. Same generic 401.
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      recordLoginFailure(normEmail);
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    if (!user.isActive) {
      return res.status(401).json({ message: 'Account deactivated' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      recordLoginFailure(normEmail);
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    // Successful login — clear any accumulated failure record for this account.
    clearLoginFailures(normEmail);

    // Two-Factor enforcement: if the user has 2FA enabled, password success is NOT enough —
    // do NOT issue a JWT yet. The client must call POST /login/2fa with a valid TOTP code.
    // Users WITHOUT 2FA fall straight through to the original token-issuing path (no change).
    if (user.twoFactorEnabled) {
      return res.json({ twoFactorRequired: true, userId: user._id });
    }

    // Resolve the user's business. A MEMBER (non-owner staff) is assigned to the owner's
    // business via user.business — never auto-create one for them (that produced an empty
    // "junk" business and broke their data access). Only an owner with no business gets one.
    let business = null;
    if (user.business) {
      business = await Business.findById(user.business);
    } else {
      business = await Business.findOne({ owner: user._id }).sort({ createdAt: -1 });
      if (!business) {
        business = await Business.create({
          name: user.name + "'s Business",
          email: user.email,
          owner: user._id,
          isActive: true,
        });
        await Branch.create({ name: 'Main Branch', business: business._id, isActive: true });
        await Role.create({ name: 'Admin', business: business._id, permissions: ['*'], isDefault: true });
      }
    }

    const fallbackBusinessName = business ? business.name : (user.name + "'s Business");
    let setting = await Setting.findOne({ user: user._id });
    if (!setting) {
      setting = await Setting.create({
        user: user._id,
        businessName: fallbackBusinessName,
        email: user.email,
      });
    } else if (!setting.businessName && fallbackBusinessName) {
      setting.businessName = fallbackBusinessName;
      await setting.save();
    }

    const token = generateToken(user);
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.json({ ...user.toJSON() });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Second factor for login. Called only after a primary login (password OR OTP) returned
// `{ twoFactorRequired: true, userId }`. Verifies the 6-digit TOTP and, on success, issues
// the JWT exactly like a normal login (reusing generateToken via issueLoginResponse).
router.post('/login/2fa', authLimiter, async (req, res) => {
  try {
    const { userId, token } = req.body;
    if (!userId || !token) {
      return res.status(400).json({ message: 'User and verification code are required' });
    }
    // twoFactorSecret is select:false, so explicitly include it for verification.
    const user = await User.findById(userId).select('+twoFactorSecret');
    if (!user || user.isActive === false) {
      return res.status(401).json({ message: 'Account not found or deactivated' });
    }
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      // 2FA not actually enabled for this user — nothing to verify here.
      return res.status(400).json({ message: 'Two-factor authentication is not enabled' });
    }
    if (!verifyTotp(token, user.twoFactorSecret)) {
      return res.status(401).json({ message: 'Invalid authentication code' });
    }
    await ensureBusinessAndSettings(user);
    return issueLoginResponse(res, user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ===== Passwordless OTP — Registration (collects email + phone, verifies via OTP) =====
router.post('/register/start', authLimiter, async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const email = normalizeEmail(req.body.email || '');
    const phone = normalizePhone(req.body.phone || '');
    if (!name || !email || !phone) return res.status(400).json({ message: 'Name, email and phone are all required' });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email address' });
    if (phone.replace(/\D/g, '').length < 7) return res.status(400).json({ message: 'Enter a valid phone number' });
    if (await User.findOne({ email })) return res.status(400).json({ message: 'Email already registered' });
    if (await User.findOne({ phone })) return res.status(400).json({ message: 'Phone number already registered' });

    const code = await createOtp(email, 'register', { name, email, phone });
    const delivery = await deliverOtp(code, { email, phone, name, purpose: 'register' });
    res.json({
      message: 'Verification code sent to your email and phone',
      identifier: email,
      ...(exposeDevOtp() ? { devOtp: code } : {}),
      ...delivery,
    });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.post('/register/verify', authLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email || req.body.identifier || '');
    const otp = req.body.otp;
    if (!email || !otp) return res.status(400).json({ message: 'Email and code are required' });
    const result = await verifyOtp(email, 'register', otp);
    if (!result.ok) return res.status(400).json({ message: result.reason });
    if (await User.findOne({ email })) return res.status(400).json({ message: 'Email already registered' });
    const data = result.payload || {};
    // Passwordless (OTP) signup: no password, and the verified OTP already proved ownership.
    const user = await provisionAccount({ name: data.name, email, phone: data.phone, isVerified: true });
    const token = generateToken(user);
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.status(201).json({ ...user.toJSON() });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

// ===== Passwordless OTP — Login (with email OR phone) =====
router.post('/login/otp', authLimiter, async (req, res) => {
  try {
    const raw = (req.body.identifier || '').trim();
    if (!raw) return res.status(400).json({ message: 'Enter your email or phone number' });
    const isEmail = raw.includes('@');
    const identifier = isEmail ? normalizeEmail(raw) : normalizePhone(raw);
    const user = await User.findOne(isEmail ? { email: identifier } : { phone: identifier });
    // Always respond the same way so the endpoint can't be used to probe for accounts.
    if (!user || user.isActive === false) {
      return res.json({ message: 'If an account exists, a code has been sent.', identifier });
    }
    const code = await createOtp(identifier, 'login', { userId: user._id.toString() });
    const delivery = await deliverOtp(code, { email: user.email, phone: user.phone, name: user.name, purpose: 'login' });
    res.json({ message: 'Code sent', identifier, ...(exposeDevOtp() ? { devOtp: code } : {}), ...delivery });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.post('/login/verify', authLimiter, async (req, res) => {
  try {
    const raw = (req.body.identifier || '').trim();
    const otp = req.body.otp;
    if (!raw || !otp) return res.status(400).json({ message: 'Identifier and code are required' });
    const isEmail = raw.includes('@');
    const identifier = isEmail ? normalizeEmail(raw) : normalizePhone(raw);
    const result = await verifyOtp(identifier, 'login', otp);
    if (!result.ok) return res.status(400).json({ message: result.reason });

    const userId = result.payload && result.payload.userId;
    const user = userId
      ? await User.findById(userId)
      : await User.findOne(isEmail ? { email: identifier } : { phone: identifier });
    if (!user || user.isActive === false) return res.status(401).json({ message: 'Account not found or deactivated' });
    if (!user.isVerified) { user.isVerified = true; await user.save(); }

    // Two-Factor enforcement (same as password login): OTP success alone is not enough when
    // 2FA is on — withhold the JWT and require a TOTP code via POST /login/2fa.
    if (user.twoFactorEnabled) {
      return res.json({ twoFactorRequired: true, userId: user._id });
    }

    // Resolve the user's business (same logic as password login).
    let business = null;
    if (user.business) {
      business = await Business.findById(user.business);
    } else {
      business = await Business.findOne({ owner: user._id }).sort({ createdAt: -1 });
      if (!business) {
        business = await Business.create({ name: user.name + "'s Business", email: user.email, owner: user._id, isActive: true });
        await Branch.create({ name: 'Main Branch', business: business._id, isActive: true });
        await Role.create({ name: 'Admin', business: business._id, permissions: ['*'], isDefault: true });
      }
    }
    const fallbackBusinessName = business ? business.name : (user.name + "'s Business");
    let setting = await Setting.findOne({ user: user._id });
    if (!setting) setting = await Setting.create({ user: user._id, businessName: fallbackBusinessName, email: user.email });

    const token = generateToken(user);
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ ...user.toJSON() });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.get('/profile', authMiddleware, async (req, res) => {
  res.json(req.user);
});

router.get('/refresh', authMiddleware, async (req, res) => {
  const token = generateToken(req.user);
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  res.json({ ...req.user.toJSON() });
});

// Authenticated password change for a logged-in user. Requires the current password
// (re-authentication) and issues a fresh token for THIS session while bumping tokenVersion
// so every OTHER existing session is invalidated.
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    // Load with the password field explicitly (defensive: middleware may strip it).
    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (!user.password) {
      // Passwordless (OTP-only) accounts have no password to verify against.
      return res.status(400).json({ message: 'No password is set for this account' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword; // pre('save') hook hashes it
    // Invalidate all other existing sessions/tokens issued before this change.
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    // Issue a fresh token for the current session so the caller stays logged in.
    const token = generateToken(user);
    res.cookie('token', token, TOKEN_COOKIE_OPTS);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    const normEmail = normalizeEmail(email);

    // CLOUD MODE (desktop): the accounts AND the email service live on the cloud, so
    // forward the request there. The cloud sends the reset email itself.
    if (cloudAuth.isCloudMode()) {
      try {
        const r = await cloudAuth.cloudForgotPassword(normEmail);
        return res.json(r);
      } catch (e) {
        if (e.network) return res.status(503).json({ message: 'No internet connection. Password reset needs internet.' });
        // fall through to local handling on other errors
      }
    }

    const user = await User.findOne({ email: normEmail });
    if (!user) {
      return res.json({ message: 'If that account exists, a reset link has been sent.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
    const resetUrl = `${clientUrl}/reset-password?token=${rawToken}`;
    try {
      // Prefer the global env SMTP (cloud server). Fall back to per-user SMTP settings.
      const sent = await sendResetEmailViaEnvSmtp(user.email, resetUrl);
      if (!sent) await sendPasswordResetEmail(user._id, { to: user.email, resetUrl });
    } catch (mailErr) {
      console.error('[Auth] Failed to send password reset email:', mailErr.message);
    }

    res.json({ message: 'If that account exists, a reset link has been sent.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Reset link is invalid or has expired' });
    }

    user.password = password;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    // Invalidate any existing sessions/tokens issued before this password reset.
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    const authToken = generateToken(user);
    res.cookie('token', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.json({ ...user.toJSON() });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/logout', authMiddleware, csrfProtection, (req, res) => {
  res.clearCookie('token');
  res.clearCookie(CSRF_COOKIE);
  res.json({ message: 'Logged out successfully' });
});

// Revoke ALL of the current user's existing tokens by bumping tokenVersion. Any JWT
// issued before this call (carrying the old `tv`) will be rejected by the auth middleware.
router.post('/logout-all', authMiddleware, csrfProtection, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    res.clearCookie('token');
    res.clearCookie(CSRF_COOKIE);
    res.json({ message: 'Logged out of all sessions' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Public: the CSRF token must be obtainable BEFORE login. Gating it behind authMiddleware
// caused the pre-login CSRF fetch to 401, which the client interceptor turned into an
// infinite redirect-to-/login loop. So we do an optional, non-fatal token decode here: if
// the caller is already authenticated we bind the signed CSRF token to their user id;
// otherwise we issue an anonymous (uid = '') bootstrap token. Both are accepted by
// csrfProtection. The returned `csrfToken` value is also set as the cookie (double-submit)
// — the client reads `csrfToken` and echoes it back in the `x-csrf-token` header.
router.get('/csrf-token', (req, res) => {
  let uid = '';
  try {
    const authHeader = req.headers.authorization;
    const bearer = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    const cookieToken = req.cookies?.token;
    const jwtToken = bearer || cookieToken;
    if (jwtToken) {
      const decoded = jwt.verify(jwtToken, JWT_SECRET);
      if (decoded && decoded.id) uid = String(decoded.id);
    }
  } catch {
    // Invalid/expired/absent token — fall back to an anonymous bootstrap token. Never fatal.
    uid = '';
  }

  const token = generateCsrfToken(uid);
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // Standard pattern: secure flag only in production (HTTPS). Set NODE_ENV=production in deploy.
    secure: process.env.NODE_ENV === 'production',
  });
  res.json({ csrfToken: token });
});

module.exports = router;
