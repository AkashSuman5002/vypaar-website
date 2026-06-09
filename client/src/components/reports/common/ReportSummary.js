import React from 'react';

const ReportSummary = ({ children, className = '' }) => (
  <div className={`px-6 py-3 border-t border-[#334155] flex items-center justify-end gap-6 text-xs ${className}`}>
    {children}
  </div>
);

export default ReportSummary;
