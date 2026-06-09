import React from 'react';
import { Search, Settings, FileText, Printer, Percent, MessageSquare, Users, Package, Bell, BookOpen } from 'lucide-react';

const MENU_ITEMS = [
  { key: 'general', label: 'General', icon: Settings },
  { key: 'transaction', label: 'Transaction', icon: FileText },
  { key: 'print', label: 'Print', icon: Printer },
  { key: 'taxes', label: 'Taxes & GST', icon: Percent },
  { key: 'transactionMessage', label: 'Transaction Message', icon: MessageSquare },
  { key: 'party', label: 'Party', icon: Users },
  { key: 'item', label: 'Item', icon: Package },
  { key: 'serviceReminders', label: 'Service Reminders', icon: Bell },
  { key: 'accounting', label: 'Accounting', icon: BookOpen },
];

const SettingsSidebar = ({ activeTab, onTabChange, onSearch }) => (
  <div className="w-[280px] min-w-[280px] bg-[#121933] flex flex-col h-full overflow-hidden">
    <div className="px-5 py-4 flex items-center justify-between border-b border-white/10">
      <h1 className="text-2xl font-semibold text-white">Settings</h1>
      <button onClick={() => onSearch?.()} className="text-white/60 hover:text-white transition-colors">
        <Search className="w-5 h-5" />
      </button>
    </div>
    <nav className="flex-1 overflow-y-auto py-2">
      {MENU_ITEMS.map(item => {
        const Icon = item.icon;
        const isActive = activeTab === item.key;
        return (
          <button
            key={item.key}
            onClick={() => onTabChange(item.key)}
            className={`w-full flex items-center gap-3 px-5 text-base transition-colors ${
              isActive
                ? 'bg-white text-[#121933] font-medium'
                : 'text-white hover:bg-[#1E2750]'
            }`}
            style={{ height: '52px' }}
          >
            <Icon className="w-5 h-5" />
            {item.label}
          </button>
        );
      })}
    </nav>
  </div>
);

export default SettingsSidebar;
