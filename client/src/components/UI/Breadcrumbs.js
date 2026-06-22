import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const routeLabels = {
  '/': 'Home',
  '/customers': 'Customers',
  '/suppliers': 'Suppliers',
  '/products': 'Items',
  '/sales': 'Sales',
  '/sales/new': 'Create Invoice',
  '/purchases': 'Purchases',
  '/purchases/bills': 'Purchase Bills',
  '/purchases/expenses': 'Expenses',
  '/budgets': 'Budgets',
  '/cash-bank': 'Cash & Bank',
  '/cash-bank/accounts': 'Bank Accounts',
  '/cash-bank/cash-in-hand': 'Cash In Hand',
  '/cash-bank/cheques': 'Cheques',
  '/cash-bank/loans': 'Loan Accounts',
  '/party-groups': 'Party Groups',
  '/party-transfer': 'Party Transfer',
  '/godown-transfer': 'Godown Transfer',
  '/stock-reconciliation': 'Stock Reconciliation',
  '/journal-entry': 'Journal Entry',
  '/chart-of-accounts': 'Chart of Accounts',
  '/account-statements': 'Account Statements',
  '/user-management': 'User Management',
  '/staff': 'Staff',
  '/manufacturing': 'Manufacturing',
  '/gst-filing': 'GST Filing',
  '/calendar': 'Calendar',
  '/support': 'Support',
  '/settings': 'Settings',
  '/reports': 'Reports',
  '/company': 'Company',
};

const Breadcrumbs = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter(x => x);

  if (pathnames.length <= 1 && !location.pathname.includes('/reports/')) return null;

  const breadcrumbs = pathnames.map((segment, index) => {
    const path = '/' + pathnames.slice(0, index + 1).join('/');
    const label = routeLabels[path] || segment.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const isLast = index === pathnames.length - 1;
    return { path, label, isLast };
  });

  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mb-4">
      <Link to="/" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
        <Home size={14} />
      </Link>
      {breadcrumbs.map(({ path, label, isLast }) => (
        <span key={path} className="flex items-center gap-1">
          <ChevronRight size={12} />
          {isLast ? (
            <span className="text-gray-900 dark:text-white font-medium">{label}</span>
          ) : (
            <Link to={path} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{label}</Link>
          )}
        </span>
      ))}
    </nav>
  );
};

export default Breadcrumbs;
