import React from 'react';
import { Calendar, Download, FileText, Search, ChevronDown } from 'lucide-react';

const ReportHeader = ({ title, description, onDateChange, startDate, endDate, search, onSearchChange, onDownload, onPrint, children }) => (
  <div className="sticky top-0 z-10 bg-[#0F172A] pt-6 pb-4 px-6 border-b border-[#1E293B] space-y-4">
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-lg font-bold text-[#F8FAFC]">{title}</h1>
        {description && <p className="text-xs text-[#64748B] mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-[#1E293B] border border-[#334155] rounded-lg px-3 py-1.5">
          <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
          <input type="date" value={startDate} onChange={(e) => onDateChange?.('start', e.target.value)} className="w-[110px] bg-transparent text-xs text-[#F8FAFC] border-none outline-none" />
          <span className="text-xs text-[#64748B]">to</span>
          <input type="date" value={endDate} onChange={(e) => onDateChange?.('end', e.target.value)} className="w-[110px] bg-transparent text-xs text-[#F8FAFC] border-none outline-none" />
        </div>
        <div className="relative">
          <select className="appearance-none bg-[#1E293B] border border-[#334155] rounded-lg px-3 py-1.5 pr-7 text-xs text-[#F8FAFC] cursor-pointer min-w-[110px]">
            <option>ALL FIRMS</option>
            <option>My Company</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#64748B] pointer-events-none" />
        </div>
        <button onClick={onDownload} className="p-2 bg-[#1E293B] border border-[#334155] rounded-lg hover:bg-[#334155] transition-colors"><Download className="w-3.5 h-3.5 text-[#94A3B8]" /></button>
        <button onClick={onPrint} className="p-2 bg-[#1E293B] border border-[#334155] rounded-lg hover:bg-[#334155] transition-colors"><FileText className="w-3.5 h-3.5 text-[#94A3B8]" /></button>
      </div>
    </div>
    {(search !== undefined || children) && (
      <div className="flex items-center gap-3">
        {search !== undefined && (
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#64748B]" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search..."
              className="w-full pl-8 pr-3 py-1.5 bg-[#1E293B] border border-[#334155] rounded-lg text-xs text-[#F8FAFC] placeholder-[#64748B] outline-none focus:border-[#3B82F6] transition-colors"
            />
          </div>
        )}
        {children}
      </div>
    )}
  </div>
);

export default ReportHeader;
