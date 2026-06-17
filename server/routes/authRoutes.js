const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Business = require('../models/Business');
const Setting = require('../models/Setting');
const Branch = require('../models/Branch');
const Role = require('../models/Role');
const { JWT_SECRET } = require('../middleware/auth');
const { authMiddleware } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { csrfProtection } = require('../middleware/csrf');

const router = express.Router();

const generateToken = (user) => {
  return jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
};

const normalizeEmail = (email = '') => email.trim().toLowerCase();

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
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    const user = await User.create({ name, email: normalizedEmail, password, role: 'admin', isOwner: false });

    const business = await Business.create({
      name: name + "'s Business",
      email: user.email,
      owner: user._id,
      isActive: true,
    });

    await Branch.create({
      name: 'Main Branch',
      business: business._id,
      isActive: true,
    });

    await Role.create({
      name: 'Admin',
      business: business._id,
      permissions: ['*'],
      isDefault: true,
    });

    await Setting.create({
      user: user._id,
      businessName: business.name,
      email: user.email,
    });

    const token = generateToken(user);
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.status(201).json({ ...user.toJSON(), token });
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
    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    if (!user.isActive) {
      return res.status(401).json({ message: 'Account deactivated' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
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
    res.json({ ...user.toJSON(), token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
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
  res.json({ ...req.user.toJSON(), token });
});

router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user) {
      return res.json({ message: 'If that account exists, a reset link has been generated.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    res.json({ message: 'If that account exists, a reset link has been generated.' });
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
    await user.save();

    const authToken = generateToken(user);
    res.cookie('token', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.json({ ...user.toJSON(), token: authToken });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/logout', authMiddleware, csrfProtection, (req, res) => {
  res.clearCookie('token');
  res.clearCookie('vyapar-csrf');
  res.json({ message: 'Logged out successfully' });
});

// Public: a CSRF token is a random double-submit value (not tied to a user) and must be
// obtainable before login. Gating it behind authMiddleware caused the pre-login CSRF fetch
// to 401, which the client interceptor turned into an infinite redirect-to-/login loop.
router.get('/csrf-token', (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie('vyapar-csrf', token, {
    httpOnly: true,
    sameSite: 'lax',
    // Standard pattern: secure flag only in production (HTTPS). Set NODE_ENV=production in deploy.
    secure: process.env.NODE_ENV === 'production',
  });
  res.json({ csrfToken: token });
});

module.exports = router;
