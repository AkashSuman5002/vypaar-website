import React from 'react';
import { Package, Plus } from 'lucide-react';

const icons = {
  customers: Package,
  products: Package,
  sales: Package,
  purchases: Package,
  suppliers: Package,
  default: Package,
};

const EmptyState = ({ type = 'default', title, description, actionLabel, onAction }) => {
  const Icon = icons[type] || icons.default;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-12">
      <div className="flex flex-col items-center text-center max-w-sm mx-auto">
        <div className="p-4 bg-slate-50 dark:bg-gray-700/50 rounded-2xl mb-5">
          <Icon className="w-10 h-10 text-slate-300 dark:text-slate-600" />
        </div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1.5">{title || `No ${type} yet`}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{description || `Get started by creating your first ${type}.`}</p>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
