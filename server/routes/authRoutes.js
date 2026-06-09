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

const router = express.Router();

const generateToken = (user) => {
  return jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
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
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    const user = await User.create({ name, email, password, role: 'admin', isOwner: true });

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
    const user = await User.findOne({ email: email.toLowerCase() });
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

    let business = await Business.findOne({ owner: user._id, isActive: true });
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

router.post('/logout', authMiddleware, (req, res) => {
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
