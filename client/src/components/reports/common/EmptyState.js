import React from 'react';

const EmptyState = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 px-4">
    <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-6 mb-5">
      {icon || (
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <rect x="12" y="10" width="40" height="44" rx="6" fill="#1E293B" stroke="#334155" strokeWidth="1.5"/>
          <rect x="20" y="18" width="24" height="3" rx="1.5" fill="#334155"/>
          <rect x="20" y="24" width="16" height="2" rx="1" fill="#334155"/>
          <rect x="20" y="29" width="20" height="2" rx="1" fill="#334155"/>
          <rect x="20" y="34" width="12" height="2" rx="1" fill="#334155"/>
          <rect x="20" y="40" width="24" height="2" rx="1" fill="#334155"/>
        </svg>
      )}
    </div>
    {title && <h3 className="text-sm font-semibold text-[#F8FAFC] mb-1">{title}</h3>}
    {description && <p className="text-xs text-[#64748B] text-center max-w-xs mb-5 leading-relaxed">{description}</p>}
    {action}
  </div>
);

export default EmptyState;
