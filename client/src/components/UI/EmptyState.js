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

const EmptyState = ({ type = 'default', title, description, subtitle, actionLabel, onAction, icon, children }) => {
  const Icon = icons[type] || icons.default;
  const displayTitle = title || `No ${type} yet`;
  const displayDescription = description || subtitle || `Get started by creating your first ${type}.`;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft p-12">
      <div className="flex flex-col items-center text-center">
        {/* Header (icon + title + subtitle) stays narrow & centered. Wide children
            such as feature-card grids must NOT be clamped to this width, so they
            render as siblings of the header rather than inside the max-w-sm box. */}
        <div className="flex flex-col items-center max-w-sm">
          {icon ? (
            // `icon` may be either a JSX element (e.g. <Package/>) or a component
            // reference (e.g. Banknote). Rendering a component reference directly as a
            // child throws "Objects are not valid as a React child", so normalize both.
            React.isValidElement(icon) ? (
              <div className="mb-5">{icon}</div>
            ) : (
              <div className="p-4 bg-slate-50 dark:bg-gray-700/50 rounded-2xl mb-5">
                {React.createElement(icon, { className: 'w-10 h-10 text-slate-300 dark:text-slate-600' })}
              </div>
            )
          ) : (
            <div className="p-4 bg-slate-50 dark:bg-gray-700/50 rounded-2xl mb-5">
              <Icon className="w-10 h-10 text-slate-300 dark:text-slate-600" />
            </div>
          )}
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1.5">{displayTitle}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{displayDescription}</p>
        </div>
        {children}
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
