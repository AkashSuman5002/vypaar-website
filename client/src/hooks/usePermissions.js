import { useAuth } from '../context/AuthContext';

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
  ],
};

const usePermissions = () => {
  const { user } = useAuth();

  const userRole = user?.role || 'admin';
  const isOwner = user?.isOwner === true;
  const userPermissions = user?.permissions || [];

  const hasPermission = (permission) => {
    if (isOwner) return true;
    if (userPermissions.includes('*')) return true;
    if (userPermissions.includes(permission)) return true;
    const rolePerms = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS['Staff'];
    if (rolePerms.includes('*')) return true;
    if (rolePerms.includes(permission)) return true;
    return false;
  };

  const hasAnyPermission = (permissions) => {
    return permissions.some(p => hasPermission(p));
  };

  const canAccess = {
    sales: hasAnyPermission(['sales:view', 'sales:create', 'sales:manage']),
    salesCreate: hasAnyPermission(['sales:create', 'sales:manage']),
    salesManage: hasPermission('sales:manage'),
    purchases: hasAnyPermission(['purchases:view', 'purchases:create', 'purchases:manage']),
    purchasesCreate: hasAnyPermission(['purchases:create', 'purchases:manage']),
    purchasesManage: hasPermission('purchases:manage'),
    products: hasAnyPermission(['products:view', 'products:manage']),
    productsManage: hasPermission('products:manage'),
    customers: hasAnyPermission(['customers:view', 'customers:manage']),
    customersManage: hasPermission('customers:manage'),
    suppliers: hasAnyPermission(['suppliers:view', 'suppliers:manage']),
    suppliersManage: hasPermission('suppliers:manage'),
    reports: hasAnyPermission(['reports:view', 'reports:export']),
    accounting: hasAnyPermission(['accounting:view', 'accounting:manage']),
    accountingManage: hasPermission('accounting:manage'),
    cashbank: hasAnyPermission(['cashbank:view', 'cashbank:manage']),
    cashbankManage: hasPermission('cashbank:manage'),
    expenses: hasAnyPermission(['expenses:view', 'expenses:create', 'expenses:manage']),
    expensesCreate: hasAnyPermission(['expenses:create', 'expenses:manage']),
    expensesManage: hasPermission('expenses:manage'),
    settings: hasAnyPermission(['settings:view', 'settings:manage']),
    settingsManage: hasPermission('settings:manage'),
    users: hasAnyPermission(['users:view', 'users:manage']) || isOwner,
    usersManage: hasPermission('users:manage') || isOwner,
    roles: hasPermission('roles:manage') || isOwner,
  };

  const canSeeFinancials = isOwner || hasAnyPermission(['reports:view', 'accounting:view', 'accounting:manage']);
  const canSeeCostPrice = isOwner || userRole === 'admin' || userRole === 'Admin';

  const getDefaultRoute = () => {
    if (isOwner || userRole === 'admin' || userRole === 'Admin') return '/';
    if (canAccess.users) return '/user-management';
    if (canAccess.accounting) return '/journal-entry';
    if (canAccess.sales) return '/sales';
    if (canAccess.purchases) return '/purchases';
    if (canAccess.products) return '/products';
    if (canAccess.customers) return '/customers';
    if (canAccess.reports) return '/reports';
    return '/';
  };

  return {
    user,
    userRole,
    isOwner,
    userPermissions,
    hasPermission,
    hasAnyPermission,
    canAccess,
    canSeeFinancials,
    canSeeCostPrice,
    getDefaultRoute,
    isAdmin: isOwner || userRole === 'admin' || userRole === 'Admin',
    isManager: userRole === 'Manager',
    isAccountant: userRole === 'Accountant',
    isStaff: userRole === 'Staff',
  };
};

export default usePermissions;
