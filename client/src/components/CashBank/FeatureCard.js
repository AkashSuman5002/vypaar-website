import React from 'react';

const FeatureCard = ({ icon: Icon, title, description }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-start gap-4 transition-all duration-200 hover:shadow-sm" style={{ height: '128px' }}>
    <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#EAF4FF' }}>
      {Icon && <Icon className="w-6 h-6" style={{ color: '#1A73E8' }} />}
    </div>
    <div className="flex-1 min-w-0 pt-1">
      <h3 className="font-semibold leading-tight mb-1.5" style={{ fontSize: '16px', color: '#1F2937' }}>
        {title}
      </h3>
      <p className="leading-snug" style={{ fontSize: '13px', fontWeight: 400, color: '#6B7280', lineHeight: 1.5 }}>
        {description}
      </p>
    </div>
  </div>
);

export default FeatureCard;
