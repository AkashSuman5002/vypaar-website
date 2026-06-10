import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { serviceReminderAPI } from '../../services/api';
import { defaultPrefs, loadSettings, saveCategory } from '../../hooks/useSettings';
import {
  Bell, Search, ChevronRight, Plus, Trash2,
  Clock, MessageSquare, Package, Wrench,
  Info, ArrowLeft, Eye, Check,
} from 'lucide-react';

const STEP_ENABLE = 0;
const STEP_SELECT_ITEMS = 1;
const STEP_REMINDER_DETAILS = 2;

const ServiceRemindersTab = () => {
  const [enabled, setEnabled] = useState(false);
  const [step, setStep] = useState(STEP_ENABLE);
  const [reminders, setReminders] = useState([]);
  const [loadingReminders, setLoadingReminders] = useState(true);
  const [selectedItems, setSelectedItems] = useState([]);

  useEffect(() => {
    loadSettings().then(data => {
      const val = data?.preferences?.serviceReminders?.enableReminders;
      if (val) {
        setEnabled(true);
      }
    });
  }, []);

  useEffect(() => {
    if (enabled) loadReminders();
  }, [enabled]);

  const loadReminders = async () => {
    setLoadingReminders(true);
    try {
      const { data } = await serviceReminderAPI.getAll();
      setReminders(data.reminders || []);
    } catch {
      toast.error('Failed to load reminders');
    } finally {
      setLoadingReminders(false);
    }
  };

  const handleEnable = async () => {
    setEnabled(true);
    try {
      await saveCategory('serviceReminders', { enableReminders: true });
      setStep(STEP_SELECT_ITEMS);
    } catch {
      toast.error('Failed to save settings');
    }
  };

  const handleDisable = async () => {
    setEnabled(false);
    setStep(STEP_ENABLE);
    try {
      await saveCategory('serviceReminders', { enableReminders: false });
      toast.success('Service reminders disabled');
    } catch {
      toast.error('Failed to save settings');
    }
  };

  const handleItemsSelected = (items) => {
    setSelectedItems(items);
    setStep(STEP_REMINDER_DETAILS);
  };

  const handleReminderSaved = () => {
    setStep(STEP_SELECT_ITEMS);
    setSelectedItems([]);
    loadReminders();
  };

  if (!enabled) {
    return <EnableScreen onEnable={handleEnable} />;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
        {step !== STEP_ENABLE && (
          <button onClick={() => { setStep(step === STEP_REMINDER_DETAILS ? STEP_SELECT_ITEMS : STEP_ENABLE); }}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-[#1F2937] dark:text-white">Service Reminders</h1>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Info className="w-3.5 h-3.5" /> See how it works
          </span>
        </div>
        <div className="ml-auto">
          <button onClick={handleDisable} className="text-xs text-red-500 hover:text-red-600 transition-colors">
            Disable
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {step === STEP_SELECT_ITEMS && (
            <motion.div key="select" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full">
              <SelectItemsScreen onNext={handleItemsSelected} />
            </motion.div>
          )}
          {step === STEP_REMINDER_DETAILS && (
            <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full">
              <ReminderDetailsScreen
                selectedItems={selectedItems}
                onBack={() => setStep(STEP_SELECT_ITEMS)}
                onSaved={handleReminderSaved}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {reminders.length > 0 && step === STEP_SELECT_ITEMS && (
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <ReminderList reminders={reminders} onRefresh={loadReminders} />
        </div>
      )}
    </div>
  );
};

const EnableScreen = ({ onEnable }) => (
  <div className="p-6 h-full flex flex-col items-center justify-center max-w-lg mx-auto text-center">
    <div className="relative mb-6">
      <div className="w-56 h-40 bg-gradient-to-br from-orange-100 via-orange-50 to-yellow-50 rounded-t-full flex items-end justify-center overflow-hidden">
        <div className="w-24 h-24 bg-white rounded-t-2xl border-2 border-orange-200 flex items-center justify-center mb-0 relative">
          <div className="text-2xl font-bold text-orange-400">V</div>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Bell className="w-8 h-8 text-orange-400" />
          </div>
        </div>
        <div className="absolute top-8 left-8">
          <Wrench className="w-8 h-8 text-orange-300 -rotate-45" />
        </div>
        <div className="absolute top-12 right-12">
          <Package className="w-7 h-7 text-orange-300" />
        </div>
      </div>
    </div>

    <div className="flex items-center justify-center gap-2 mb-2">
      <h2 className="text-2xl font-bold text-[#1F2937]">Service Reminders</h2>
      <span className="px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-700 rounded-full">New</span>
    </div>

    <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
      <span>Remind your parties</span>
      <span>|</span>
      <span>Don't lose customers</span>
      <span>|</span>
      <span>Grow your Business</span>
    </div>

    <button onClick={onEnable}
      className="flex items-center gap-2 px-8 py-3 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors shadow-md">
      <Bell className="w-5 h-5" /> Enable Service Reminders
    </button>
  </div>
);

const SelectItemsScreen = ({ onNext }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState({});

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await serviceReminderAPI.getItems({ search, type: filter });
      setItems(data.items || []);
    } catch {
      toast.error('Failed to load items');
    } finally {
      setLoading(false);
    }
  }, [search, filter]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const toggleSelect = (id) => {
    setSelected(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAll = () => {
    const allSelected = items.length > 0 && items.every(i => selected[i._id]);
    if (allSelected) {
      setSelected({});
    } else {
      const newSel = {};
      items.forEach(i => { newSel[i._id] = true; });
      setSelected(newSel);
    }
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const handleContinue = () => {
    const selItems = items.filter(i => selected[i._id]);
    if (selItems.length === 0) {
      toast.warn('Please select at least one item');
      return;
    }
    onNext(selItems);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#1F2937]">Select Items for Reminder</h2>
        <span className="text-xs text-blue-600 flex items-center gap-1 cursor-pointer">
          <Info className="w-3.5 h-3.5" /> See how it works
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600 font-medium">Filter by:</span>
        {['all', 'Products', 'Services'].map(f => (
          <button key={f} onClick={() => setFilter(f === 'all' ? 'all' : f.toLowerCase())}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              (f === 'all' && filter === 'all') || filter === f.toLowerCase()
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}>
            {f === 'all' ? 'All Items' : f}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Search items" value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center px-4 py-3 bg-gray-50 border-b border-gray-200">
          <input type="checkbox" checked={items.length > 0 && items.every(i => selected[i._id])} onChange={toggleAll}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
          <span className="ml-3 text-sm font-medium text-gray-700">ALL ITEMS</span>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Loading items...</div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">No items found</div>
          ) : (
            items.map(item => (
              <div key={item._id} className="flex items-center px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                <input type="checkbox" checked={!!selected[item._id]} onChange={() => toggleSelect(item._id)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="ml-3 text-sm text-[#1F2937]">{item.name}</span>
                {item.unit && <span className="ml-auto text-xs text-gray-400">{item.unit}</span>}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button onClick={handleContinue}
          className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          disabled={selectedCount === 0}>
          Continue <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const ReminderDetailsScreen = ({ selectedItems, onBack, onSaved }) => {
  const [servicePeriod, setServicePeriod] = useState('');
  const [sendTo, setSendTo] = useState('only_me');
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!servicePeriod || parseInt(servicePeriod) < 1) {
      toast.warn('Please enter a valid service period');
      return;
    }
    setSaving(true);
    try {
      await serviceReminderAPI.create({
        name: `Service Reminder (${selectedItems.length} item${selectedItems.length > 1 ? 's' : ''})`,
        items: selectedItems.map(i => ({ product: i._id, productName: i.name })),
        servicePeriod: parseInt(servicePeriod),
        sendRemindersTo: sendTo,
      });
      toast.success('Service reminder created');
      onSaved();
    } catch {
      toast.error('Failed to create reminder');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <p className="text-sm text-gray-500">Number of items selected</p>
            <p className="text-2xl font-bold text-[#1F2937]">{selectedItems.length}</p>
          </div>
        </div>
        <button onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit Selected Items
        </button>
      </div>

      <div>
        <h2 className="text-base font-semibold text-[#1F2937] mb-1">Add Reminder Details</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Service Period<span className="text-red-500">*</span></label>
          <div className="relative">
            <input type="number" min="1" placeholder="Enter Service Period" value={servicePeriod}
              onChange={e => setServicePeriod(e.target.value)}
              className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none pr-16" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">Days</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Send Reminders to <span className="text-red-500">*</span></label>
          <select value={sendTo} onChange={e => setSendTo(e.target.value)}
            className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white">
            <option value="only_me">Only Me</option>
            <option value="party">Party (Customer/Supplier)</option>
            <option value="both">Both</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">This selection will be applicable for all Service Reminders, can change later in Reminder Settings.</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => setShowPreview(!showPreview)}
          className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2">
          <Eye className="w-4 h-4" /> Preview Message
        </button>
      </div>

      <AnimatePresence>
        {showPreview && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="bg-blue-50 border border-blue-200 rounded-lg p-4 overflow-hidden">
            <div className="flex items-start gap-3">
              <MessageSquare className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800">Service Reminder Message</p>
                <p className="text-sm text-blue-600 mt-1">
                  Hi, this is a reminder that the service period for your purchased item
                  {selectedItems.length > 1 ? 's' : ''} ({selectedItems.map(i => i.name).join(', ')}) is due in {servicePeriod || '__'} days.
                  Please schedule your next service/renewal.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[#1F2937]">Get timely reminders as per service period</h4>
            <ul className="mt-2 space-y-1">
              <li className="text-xs text-gray-500 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                With automated reminders, you can focus on running your business while we take care of sending out reminders at the appropriate times.
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button onClick={handleSave} disabled={saving || !servicePeriod}
          className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50">
          <Plus className="w-4 h-4" /> {saving ? 'Saving...' : 'Add Reminder'}
        </button>
      </div>
    </div>
  );
};

const ReminderList = ({ reminders, onRefresh }) => {
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this reminder?')) return;
    try {
      await serviceReminderAPI.delete(id);
      toast.success('Reminder deleted');
      onRefresh();
    } catch {
      toast.error('Failed to delete reminder');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#1F2937]">Your Reminders ({reminders.length})</h3>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {reminders.map(r => (
          <div key={r._id} className="border border-gray-200 rounded-lg p-3 hover:border-blue-200 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center">
                  <Bell className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1F2937]">{r.name}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {r.servicePeriod} days</span>
                    <span className="flex items-center gap-1">
                      <span className="w-4 h-4 rounded bg-gray-100 flex items-center justify-center"><Check className="w-3 h-3 text-gray-500" /></span>
                      {r.items?.length || 0} items
                    </span>
                  </p>
                </div>
              </div>
              <button onClick={() => handleDelete(r._id)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ServiceRemindersTab;
