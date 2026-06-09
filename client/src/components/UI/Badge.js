import React from 'react';

const variants = {
  paid: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  partial: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  unpaid: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
  active: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  inactive: 'bg-slate-50 dark:bg-gray-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-gray-700',
  low: 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
  inStock: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  default: 'bg-slate-50 dark:bg-gray-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-gray-700',
};

const Badge = ({ children, variant = 'default', className = '' }) => {
  const base = 'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border';
  return (
    <span className={`${base} ${variants[variant] || variants.default} ${className}`}>
      {children}
    </span>
  );
};

export default Badge;
