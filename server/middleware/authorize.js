const ROLE_PERMISSIONS = {
  admin: ['*'],
  Admin: ['*'],
  Manager: [
    'sales:view', 'sales:create', 'sales:manage',
    'purchases:view', 'purchases:create', 'purchases:manage',
    'products:view', 'products:manage',
    'customers:view', 'customers:manage',
    'suppliers:view', 'suppliers:manage',
    'reports:view', 'reports:export',
    'accounting:view', 'accounting:manage',
    'cashbank:view', 'cashbank:manage',
    'expenses:view', 'expenses:create', 'expenses:manage',
    'settings:view', 'settings:manage',
    'staff:view', 'staff:create', 'staff:manage',
  ],
  Accountant: [
    'sales:view', 'purchases:view',
    'products:view', 'customers:view', 'suppliers:view',
    'reports:view', 'reports:export',
    'accounting:view', 'accounting:manage',
    'cashbank:view',
    'expenses:view',
  ],
  Staff: [
    'sales:view', 'sales:create',
    'products:view', 'customers:view',
    'staff:view',
  ],
};

const authorize = (...requiredPermissions) => {
  return (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      if (user.isOwner) return next();

      const userPerms = user.permissions || [];
      if (userPerms.includes('*')) return next();

      const rolePerms = ROLE_PERMISSIONS[user.role] || ROLE_PERMISSIONS['Staff'];
      if (rolePerms.includes('*')) return next();

      for (const perm of requiredPermissions) {
        if (userPerms.includes(perm) || rolePerms.includes(perm)) {
          return next();
        }
      }

      return res.status(403).json({ message: 'Insufficient permissions' });
    } catch (error) {
      return res.status(500).json({ message: 'Authorization error' });
    }
  };
};

const authorizeAdmin = (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    if (user.isOwner || user.role === 'admin' || user.role === 'Admin') {
      return next();
    }
    return res.status(403).json({ message: 'Admin access required' });
  } catch (error) {
    return res.status(500).json({ message: 'Authorization error' });
  }
};

module.exports = { authorize, authorizeAdmin, ROLE_PERMISSIONS };
