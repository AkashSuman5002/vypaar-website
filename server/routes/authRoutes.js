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
  return jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
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
    const user = await User.create({ name, email: normalizedEmail, password, role: 'admin', isOwner: true });

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

    let business = await Business.findOne({ owner: user._id }).sort({ createdAt: -1 });
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

    let setting = await Setting.findOne({ user: user._id });
    if (!setting) {
      setting = await Setting.create({
        user: user._id,
        businessName: business.name,
        email: user.email,
      });
    } else if (!setting.businessName && business.name) {
      setting.businessName = business.name;
      await setting.save();
    }

    const token = generateToken(user);
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
    res.json({ ...user.toJSON(), token: authToken });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/logout', authMiddleware, csrfProtection, (req, res) => {
  res.clearCookie('vyapar-csrf');
  res.json({ message: 'Logged out successfully' });
});

router.get('/csrf-token', authMiddleware, (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie('vyapar-csrf', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  res.json({ csrfToken: token });
});

module.exports = router;
