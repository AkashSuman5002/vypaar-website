import React from 'react';

const SettingsSection = ({ title, children, className = '' }) => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
    {title && (
      <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-[#1F2937] dark:text-slate-200">{title}</h3>
      </div>
    )}
    <div className="px-5 py-2">{children}</div>
  </div>
);

export default SettingsSection;

export const SettingsCard = ({ children, className = '' }) => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>{children}</div>
);
