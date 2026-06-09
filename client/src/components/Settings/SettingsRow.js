import React from 'react';

export const SettingsInputRow = ({ label, value, onChange, placeholder, type = 'text', suffix }) => (
  <div className="flex items-center justify-between py-2.5">
    <span className="text-sm text-[#1F2937]">{label}</span>
    <div className="flex items-center gap-2">
      {suffix && <span className="text-xs text-gray-400">{suffix}</span>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-48 px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-[#1F2937]" />
    </div>
  </div>
);

export const SettingsSelectRow = ({ label, value, onChange, options }) => (
  <div className="flex items-center justify-between py-2.5">
    <span className="text-sm text-[#1F2937]">{label}</span>
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-48 px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-[#1F2937]">
      {options.map(opt => (
        <option key={typeof opt === 'string' ? opt : opt.value} value={typeof opt === 'string' ? opt : opt.value}>
          {typeof opt === 'string' ? opt : opt.label}
        </option>
      ))}
    </select>
  </div>
);

export const SettingsButtonRow = ({ label, buttonLabel, onClick, buttonColor = 'bg-blue-600' }) => (
  <div className="flex items-center justify-between py-2.5">
    <span className="text-sm text-[#1F2937]">{label}</span>
    <button type="button" onClick={onClick}
      className={`px-4 py-1.5 text-sm font-medium text-white ${buttonColor} rounded-md hover:opacity-90 transition-opacity`}>
      {buttonLabel}
    </button>
  </div>
);
