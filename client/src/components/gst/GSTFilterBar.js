import React from 'react';
import { ChevronDown, Download, Printer } from 'lucide-react';

const currentYear = new Date().getFullYear();
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const getMonthOptions = () => {
  const options = [];
  for (let y = currentYear - 2; y <= currentYear + 1; y++) {
    months.forEach((m, i) => {
      options.push({ value: `${y}-${String(i + 1).padStart(2, '0')}`, label: `${m} ${y}` });
    });
  }
  return options;
};

const GSTFilterBar = ({ title, showNonTax = true, onExcel, onPrint, period, onPeriodChange, startDate, endDate, onDateChange }) => {
  const monthOptions = getMonthOptions();

  return (
    <div className="flex items-center justify-between p-6 pb-0 flex-wrap gap-2">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-[#F8FAFC]">{title}</h2>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <select
            className="appearance-none bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#334155] rounded px-3 py-1.5 pr-7 text-xs text-gray-600 dark:text-[#94A3B8]"
            value={period || (startDate ? `${startDate.slice(0, 7)}` : '')}
            onChange={(e) => { if (onPeriodChange) onPeriodChange(e.target.value); if (onDateChange) onDateChange('start', e.target.value + '-01'); }}
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 dark:text-[#64748B] pointer-events-none" />
        </div>
        <span className="text-xs text-gray-400 dark:text-[#64748B]">to</span>
        <div className="relative">
          <select
            className="appearance-none bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#334155] rounded px-3 py-1.5 pr-7 text-xs text-gray-600 dark:text-[#94A3B8]"
            value={endDate ? `${endDate.slice(0, 7)}` : ''}
            onChange={(e) => { if (onDateChange) onDateChange('end', e.target.value + '-28'); }}
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 dark:text-[#64748B] pointer-events-none" />
        </div>
        {showNonTax && (
          <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-[#94A3B8] cursor-pointer ml-2">
            <input type="checkbox" className="rounded border-gray-300 dark:border-[#334155] bg-white dark:bg-[#1E293B]" />
            Consider Non-Tax As Exempted
          </label>
        )}
        <button onClick={onExcel} className="p-1.5 border border-gray-300 dark:border-[#334155] rounded hover:bg-gray-50 dark:hover:bg-[#1E293B]"><Download className="w-4 h-4 text-gray-500 dark:text-[#64748B]" /></button>
        <button onClick={onPrint} className="p-1.5 border border-gray-300 dark:border-[#334155] rounded hover:bg-gray-50 dark:hover:bg-[#1E293B]"><Printer className="w-4 h-4 text-gray-500 dark:text-[#64748B]" /></button>
      </div>
    </div>
  );
};

export default GSTFilterBar;
