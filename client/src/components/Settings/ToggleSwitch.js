import React from 'react';

const ToggleSwitch = ({ label, checked, onChange, description, disabled }) => (
  <div className="flex items-center justify-between py-2.5">
    <div>
      <span className="text-sm text-[#1F2937] dark:text-slate-200">{label}</span>
      {description && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{description}</p>}
    </div>
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${checked ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-gray-800 shadow-sm ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  </div>
);

export default ToggleSwitch;
