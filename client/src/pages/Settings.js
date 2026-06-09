import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import SettingsSidebar from '../components/Settings/SettingsSidebar';
import GeneralTab from '../components/Settings/GeneralTab';
import TransactionTab from '../components/Settings/TransactionTab';
import PrintTab from '../components/Settings/PrintTab';
import TaxesTab from '../components/Settings/TaxesTab';
import TransactionMessageTab from '../components/Settings/TransactionMessageTab';
import PartyTab from '../components/Settings/PartyTab';
import ItemTab from '../components/Settings/ItemTab';
import ServiceRemindersTab from '../components/Settings/ServiceRemindersTab';
import AccountingTab from '../components/Settings/AccountingTab';

const TABS = [
  { key: 'general', label: 'General', component: GeneralTab },
  { key: 'transaction', label: 'Transaction', component: TransactionTab },
  { key: 'print', label: 'Print', component: PrintTab },
  { key: 'taxes', label: 'Taxes & GST', component: TaxesTab },
  { key: 'transactionMessage', label: 'Transaction Message', component: TransactionMessageTab },
  { key: 'party', label: 'Party', component: PartyTab },
  { key: 'item', label: 'Item', component: ItemTab },
  { key: 'serviceReminders', label: 'Service Reminders', component: ServiceRemindersTab },
  { key: 'accounting', label: 'Accounting', component: AccountingTab },
];

const SearchOverlay = ({ query, setQuery, results, onSelect }) => (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    className="absolute top-2 left-4 right-4 z-50 bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden"
  >
    <div className="p-3 border-b border-gray-100">
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search settings..."
        autoFocus
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
    <div className="p-2 max-h-60 overflow-y-auto">
      {results.length === 0 ? (
        <p className="px-3 py-4 text-sm text-gray-400 text-center">No results found</p>
      ) : results.map(item => (
        <button
          key={item.key}
          onClick={() => { onSelect(item.key); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[#1F2937] hover:bg-gray-50 rounded-md transition-colors"
        >
          <Search className="w-4 h-4 text-gray-400" />
          {item.label}
        </button>
      ))}
    </div>
  </motion.div>
);

const Settings = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const tabFromUrl = new URLSearchParams(location.search).get('tab');
  const initialTab = TABS.find(t => t.key === tabFromUrl)?.key || 'general';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    const t = new URLSearchParams(location.search).get('tab');
    if (t && TABS.find(x => x.key === t)) setActiveTab(t);
  }, [location.search]);

  const filteredTabs = TABS.filter(t =>
    t.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const ActiveComponent = TABS.find(t => t.key === activeTab)?.component || GeneralTab;

  const handleSearchToggle = () => {
    setSearchOpen(prev => !prev);
    setSearchQuery('');
  };

  const handleSearchSelect = (key) => {
    setActiveTab(key);
    setSearchOpen(false);
    setSearchQuery('');
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-[#F5F6FA] flex flex-col">
      <div className="flex items-center justify-end px-6 py-3 bg-white border-b border-slate-200">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
          Close
        </button>
      </div>
      <div className="flex flex-1 min-h-0">
        <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} onSearch={handleSearchToggle} />
        <div className="flex-1 flex flex-col min-w-0 relative" ref={searchRef}>
          <AnimatePresence>
            {searchOpen && (
              <SearchOverlay
                query={searchQuery}
                setQuery={setSearchQuery}
                results={filteredTabs}
                onSelect={handleSearchSelect}
              />
            )}
          </AnimatePresence>
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15 }}
                className="min-h-full"
              >
                <ActiveComponent />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
