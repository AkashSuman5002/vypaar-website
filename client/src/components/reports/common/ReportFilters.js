import React from 'react';
import { Search, ChevronDown } from 'lucide-react';

const ReportFilters = ({ search, onSearchChange, children, period, onPeriodChange, dateStart, dateEnd, onDateChange }) => (
  <div className="px-6 py-3 space-y-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="relative">
          <select
            value={period || 'this-month'}
            onChange={(e) => onPeriodChange?.(e.target.value)}
            className="appearance-none bg-[#1E293B] border border-[#334155] rounded-lg px-3 py-1.5 pr-7 text-xs text-[#F8FAFC] cursor-pointer min-w-[120px]"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="this-week">This Week</option>
            <option value="this-month">This Month</option>
            <option value="this-quarter">This Quarter</option>
            <option value="this-year">This Year</option>
            <option value="custom">Custom</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#64748B] pointer-events-none" />
        </div>
        <span className="text-xs text-[#64748B]">Between</span>
        <input type="date" value={dateStart} onChange={(e) => onDateChange?.('start', e.target.value)} className="bg-[#1E293B] border border-[#334155] rounded-lg px-2 py-1.5 w-[120px] text-xs text-[#F8FAFC] outline-none" />
        <span className="text-xs text-[#64748B]">To</span>
        <input type="date" value={dateEnd} onChange={(e) => onDateChange?.('end', e.target.value)} className="bg-[#1E293B] border border-[#334155] rounded-lg px-2 py-1.5 w-[120px] text-xs text-[#F8FAFC] outline-none" />
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <select className="appearance-none bg-[#1E293B] border border-[#334155] rounded-lg px-3 py-1.5 pr-7 text-xs text-[#F8FAFC] cursor-pointer min-w-[110px]">
            <option>ALL FIRMS</option>
            <option>My Company</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#64748B] pointer-events-none" />
        </div>
        {children}
      </div>
    </div>
    {search !== undefined && (
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#64748B]" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search..."
          className="w-full pl-8 pr-3 py-1.5 bg-[#1E293B] border border-[#334155] rounded-lg text-xs text-[#F8FAFC] placeholder-[#64748B] outline-none focus:border-[#3B82F6] transition-colors"
        />
      </div>
    )}
  </div>
);

export default ReportFilters;
