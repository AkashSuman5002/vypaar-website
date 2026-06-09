const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Role = require('../models/Role');
const { authorize, authorizeAdmin } = require('../middleware/authorize');
const { getBaseFilter } = require('../utils/queryHelper');

// GET /api/users - List all users for the business
router.get('/', authorizeAdmin, async (req, res) => {
  try {
    const businessId = req.businessId || req.user?.business;
    const filter = {};
    if (businessId) {
      filter.$or = [
        { business: businessId },
        { _id: req.user._id },
        { isOwner: true },
      ];
    } else {
      filter.$or = [{ _id: req.user._id }, { isOwner: true }];
    }
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/users/roles - Get roles for the business
router.get('/roles', authorizeAdmin, async (req, res) => {
  try {
    const businessId = req.businessId || req.user?.business;
    const filter = {};
    if (businessId) filter.business = businessId;
    const roles = await Role.find(filter).sort({ createdAt: -1 });
    res.json(roles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/users/:id - Get user by ID
router.get('/:id', authorizeAdmin, async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const user = await User.findOne({ _id: req.params.id, ...baseFilter }).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/users - Create a new user
router.post('/', authorizeAdmin, async (req, res) => {
  try {
    const { name, email, password, phone, role, isActive, permissions } = req.body;
    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }
    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    const businessId = req.businessId || req.user?.business;
    const user = new User({
      name,
      email,
      password,
      phone: phone || '',
      role: role || 'Staff',
      permissions: permissions || [],
      business: businessId,
      isActive: isActive !== false,
    });
    await user.save();
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', authorizeAdmin, async (req, res) => {
  try {
    const { name, email, password, phone, role, isActive, permissions } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email.toLowerCase();
    if (phone !== undefined) user.phone = phone;
    if (role !== undefined) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    if (permissions !== undefined) user.permissions = permissions;
    if (password && password.trim()) {
      user.password = password;
    }
    await user.save();
    res.json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', authorizeAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.isOwner) {
      return res.status(400).json({ message: 'Cannot delete the owner account' });
    }
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/users/roles - Create a role
router.post('/roles', authorizeAdmin, async (req, res) => {
  try {
    const { name, permissions } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Role name is required' });
    }
    const businessId = req.businessId || req.user?.business;
    if (!businessId) {
      return res.status(400).json({ message: 'Business context required' });
    }
    const existing = await Role.findOne({ name, business: businessId });
    if (existing) {
      return res.status(400).json({ message: 'Role already exists' });
    }
    const role = new Role({
      name,
      permissions: permissions || [],
      business: businessId,
    });
    await role.save();
    res.status(201).json(role);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE /api/users/roles/:id - Delete a role
router.delete('/roles/:id', authorizeAdmin, async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }
    if (role.isDefault) {
      return res.status(400).json({ message: 'Cannot delete the default role' });
    }
    await Role.findByIdAndDelete(req.params.id);
    res.json({ message: 'Role deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
