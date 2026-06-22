const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Role = require('../models/Role');
const { authorize, authorizeAdmin, ROLE_PERMISSIONS } = require('../middleware/authorize');
const { getBaseFilter } = require('../utils/queryHelper');
const { apiLimiter } = require('../middleware/rateLimit');

// Built-in role names that map to a fixed permission set (see authorize.js).
// 'admin'/'Admin' grant '*' (full access) and so are owner-only privileges.
const BUILTIN_ROLES = ['user', 'Manager', 'Accountant', 'Staff'];
const ADMIN_ROLES = ['admin', 'Admin'];

// The complete set of known permission keys: every permission referenced by any
// built-in role definition. Any permission outside this set (including the
// full-access wildcard '*') is rejected for non-owners.
const KNOWN_PERMISSIONS = new Set(
  Object.values(ROLE_PERMISSIONS).flat().filter((p) => p !== '*')
);

// Validate a requested role/permissions assignment against an allow-list, blocking
// privilege escalation. Returns { error } on rejection, or { role, permissions } on
// success. `isOwner` is the ACTING user's ownership flag — only the business owner
// may mint admin/'*'/full-access accounts.
const validateRoleAndPermissions = async (req, { role, permissions }) => {
  const isOwner = !!req.user?.isOwner;
  const businessId = req.businessId || req.user?.business;

  let resolvedRole;
  if (role !== undefined && role !== null && role !== '') {
    if (ADMIN_ROLES.includes(role)) {
      // Granting admin (=> '*') is reserved for the business owner.
      if (!isOwner) return { error: 'Only the business owner may assign the admin role' };
      resolvedRole = role;
    } else if (BUILTIN_ROLES.includes(role)) {
      resolvedRole = role;
    } else {
      // Not a built-in role — must be one of the business's own defined roles.
      if (!businessId) return { error: `Unknown role: ${role}` };
      const exists = await Role.findOne({ name: role, business: businessId });
      if (!exists) return { error: `Unknown role: ${role}` };
      resolvedRole = role;
    }
  }

  let resolvedPermissions;
  if (permissions !== undefined) {
    if (!Array.isArray(permissions)) {
      return { error: 'permissions must be an array' };
    }
    for (const perm of permissions) {
      if (typeof perm !== 'string') {
        return { error: 'Invalid permission entry' };
      }
      if (perm === '*') {
        // Wildcard/full-access can only be granted by the owner.
        if (!isOwner) return { error: 'Only the business owner may grant full access (*)' };
        continue;
      }
      if (!KNOWN_PERMISSIONS.has(perm)) {
        return { error: `Unknown permission: ${perm}` };
      }
    }
    resolvedPermissions = permissions;
  }

  return { role: resolvedRole, permissions: resolvedPermissions };
};

// GET /api/users - List all users for the business
router.get('/', authorizeAdmin, async (req, res) => {
  try {
    const businessId = req.businessId || req.user?.business;
    const filter = {};
    if (businessId) {
      filter.$or = [
        { business: businessId },
        { _id: req.user._id },
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
router.post('/', authorizeAdmin, apiLimiter, async (req, res) => {
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
    // Block privilege escalation: validate role/permissions against the allow-list.
    const checked = await validateRoleAndPermissions(req, { role, permissions });
    if (checked.error) {
      return res.status(403).json({ message: checked.error });
    }
    const businessId = req.businessId || req.user?.business;
    const user = new User({
      name,
      email,
      password,
      phone: phone || '',
      role: checked.role || 'Staff',
      permissions: checked.permissions || [],
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
    // Scope to the admin's own business so one business cannot edit another's users.
    const baseFilter = getBaseFilter(req);
    const user = await User.findOne({ _id: req.params.id, ...baseFilter });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    // Block privilege escalation: validate any role/permissions change before applying.
    const checked = await validateRoleAndPermissions(req, { role, permissions });
    if (checked.error) {
      return res.status(403).json({ message: checked.error });
    }
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email.toLowerCase();
    if (phone !== undefined) user.phone = phone;
    if (role !== undefined) user.role = checked.role;
    if (isActive !== undefined) user.isActive = isActive;
    if (permissions !== undefined) user.permissions = checked.permissions;
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
    // Scope to the admin's own business so one business cannot delete another's users.
    const baseFilter = getBaseFilter(req);
    const user = await User.findOne({ _id: req.params.id, ...baseFilter });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.isOwner) {
      return res.status(400).json({ message: 'Cannot delete the owner account' });
    }
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }
    await User.findByIdAndDelete(user._id);
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
    // Scope to the admin's own business so one business cannot delete another's roles.
    const businessId = req.businessId || req.user?.business;
    const role = await Role.findOne({ _id: req.params.id, ...(businessId ? { business: businessId } : {}) });
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }
    if (role.isDefault) {
      return res.status(400).json({ message: 'Cannot delete the default role' });
    }
    await Role.findByIdAndDelete(role._id);
    res.json({ message: 'Role deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
