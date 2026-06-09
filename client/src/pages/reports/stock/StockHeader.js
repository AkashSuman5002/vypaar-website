import React from 'react';
import { ChevronDown, Search, Download, Printer } from 'lucide-react';

const StockHeader = ({ title, search, onSearchChange }) => (
  <>
    <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-200 dark:border-[#334155]">
      <div className="flex items-center gap-3">
        <div className="relative">
          <select className="appearance-none bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#334155] rounded px-3 py-1.5 pr-7 text-sm text-gray-600 dark:text-[#94A3B8] min-w-[130px] cursor-pointer">
            <option>This Month</option>
            <option>Today</option>
            <option>Yesterday</option>
            <option>This Week</option>
            <option>This Quarter</option>
            <option>This Year</option>
            <option>Custom</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 dark:text-[#64748B] pointer-events-none" />
        </div>
        <span className="text-xs text-gray-500 dark:text-[#64748B]">Between</span>
        <input type="date" className="border border-gray-300 dark:border-[#334155] rounded px-2 py-1.5 w-[120px] text-xs text-gray-600 dark:text-[#94A3B8] bg-white dark:bg-[#1E293B]" />
        <span className="text-xs text-gray-500 dark:text-[#64748B]">To</span>
        <input type="date" className="border border-gray-300 dark:border-[#334155] rounded px-2 py-1.5 w-[120px] text-xs text-gray-600 dark:text-[#94A3B8] bg-white dark:bg-[#1E293B]" />
      </div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <select className="appearance-none bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-[#334155] rounded px-3 py-1.5 pr-7 text-xs text-gray-600 dark:text-[#94A3B8] min-w-[130px] cursor-pointer">
            <option>ALL FIRMS</option>
            <option>My Company</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 dark:text-[#64748B] pointer-events-none" />
        </div>
        <button className="p-1.5 border border-gray-200 dark:border-[#334155] rounded hover:bg-white dark:bg-[#1E293B]/70"><Download className="w-4 h-4 text-gray-500 dark:text-[#64748B]" /></button>
        <button className="p-1.5 border border-gray-200 dark:border-[#334155] rounded hover:bg-white dark:bg-[#1E293B]/70"><Printer className="w-4 h-4 text-gray-500 dark:text-[#64748B]" /></button>
      </div>
    </div>
    <div className="px-4 py-3">
      <div className="relative w-[250px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 dark:text-[#64748B]" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search..."
          className="w-full pl-8 pr-3 py-1.5 border border-gray-300 dark:border-[#334155] rounded text-xs text-gray-600 dark:text-[#94A3B8] placeholder-[#64748B] bg-white dark:bg-[#1E293B]"
        />
      </div>
    </div>
  </>
);

export default StockHeader;
