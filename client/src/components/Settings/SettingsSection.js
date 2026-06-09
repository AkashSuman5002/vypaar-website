import React from 'react';

const SettingsSection = ({ title, children, className = '' }) => (
  <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}>
    {title && (
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-[#1F2937]">{title}</h3>
      </div>
    )}
    <div className="px-5 py-2">{children}</div>
  </div>
);

export default SettingsSection;

export const SettingsCard = ({ children, className = '' }) => (
  <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>{children}</div>
);
