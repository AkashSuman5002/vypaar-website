import React from 'react';

const FeatureCard = ({ icon: Icon, title, description }) => (
  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex items-start gap-4 transition-all duration-200 hover:shadow-sm" style={{ minHeight: '120px' }}>
    <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-50 dark:bg-blue-500/10">
      {Icon && <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
    </div>
    <div className="flex-1 min-w-0 text-left">
      <h3 className="text-[15px] font-semibold leading-tight mb-1 text-gray-800 dark:text-gray-100">
        {title}
      </h3>
      <p className="text-[13px] leading-snug text-gray-500 dark:text-gray-400">
        {description}
      </p>
    </div>
  </div>
);

export default FeatureCard;
