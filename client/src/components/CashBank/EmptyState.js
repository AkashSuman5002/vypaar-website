import React from 'react';

const EmptyState = ({ icon, title, subtitle, children }) => (
  <div className="flex flex-col items-center justify-center py-16 px-4">
    <div className="mb-6">{icon}</div>
    {title && <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>}
    {subtitle && <p className="text-sm text-gray-500 text-center max-w-md mb-6">{subtitle}</p>}
    {children}
  </div>
);

export default EmptyState;
