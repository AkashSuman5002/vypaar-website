import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import ToggleSwitch from './ToggleSwitch';
import SettingsSection from './SettingsSection';
import { SettingsInputRow, SettingsButtonRow } from './SettingsRow';
import { Gift, Plus, Trash2, Save } from 'lucide-react';
import { defaultPrefs, loadSettings, saveCategory } from '../../hooks/useSettings';

const DEFAULT_CUSTOM_FIELDS = [
  { id: 'gst', name: 'GST Number', showInPrint: true },
  { id: 'pan', name: 'PAN Number', showInPrint: false },
  { id: 'creditLimit', name: 'Credit Limit', showInPrint: true },
  { id: 'openingBalance', name: 'Opening Balance', showInPrint: false },
];

const PartyTab = () => {
  const [settings, setSettings] = useState(defaultPrefs.party);
  const [customFields, setCustomFields] = useState(DEFAULT_CUSTOM_FIELDS);
  const [newFieldName, setNewFieldName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings().then(data => {
      if (data?.preferences?.party) {
        setSettings({ ...defaultPrefs.party, ...data.preferences.party });
        if (Array.isArray(data.preferences.party.customFieldDefs) && data.preferences.party.customFieldDefs.length > 0) {
          setCustomFields(data.preferences.party.customFieldDefs);
        }
      }
    });
  }, []);

  const update = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  const addCustomField = () => {
    const name = newFieldName.trim();
    if (!name) return;
    if (customFields.some(f => f.name.toLowerCase() === name.toLowerCase())) {
      toast.error('Field name already exists');
      return;
    }
    setCustomFields(prev => [...prev, { id: `f${Date.now()}`, name, showInPrint: false }]);
    setNewFieldName('');
  };

  const removeCustomField = (id) => {
    setCustomFields(prev => prev.filter(f => f.id !== id));
  };

  const toggleFieldPrint = (id) => {
    setCustomFields(prev => prev.map(f => f.id === id ? { ...f, showInPrint: !f.showInPrint } : f));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCategory('party', { ...settings, customFieldDefs: customFields });
      toast.success('Party settings saved');
    } catch { toast.error('Failed to save party settings'); }
    finally { setSaving(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 space-y-6 overflow-y-auto max-h-full">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-6">
          <SettingsSection title="Party Settings">
            <ToggleSwitch label="Party Grouping" checked={settings.partyGrouping} onChange={v => update('partyGrouping', v)} />
            <ToggleSwitch label="Shipping Address" checked={settings.shippingAddress} onChange={v => update('shippingAddress', v)} />
            <ToggleSwitch label="Print Shipping Address" checked={settings.printShippingAddress} onChange={v => update('printShippingAddress', v)} />
            <ToggleSwitch label="Manage Party Status" checked={settings.managePartyStatus} onChange={v => update('managePartyStatus', v)} />
          </SettingsSection>
          <SettingsSection title="Payment Reminder">
            <ToggleSwitch label="Payment Reminder" checked={settings.paymentReminder} onChange={v => update('paymentReminder', v)} />
            <SettingsInputRow label="Reminder Days" value={settings.reminderDays} onChange={v => update('reminderDays', v)} placeholder="7" suffix="days before" type="number" />
            <SettingsButtonRow label="Reminder Message" buttonLabel="Configure Message" buttonColor="bg-gray-500" />
          </SettingsSection>
          <SettingsSection title="Enable Loyalty Points">
            <div className="py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-amber-500" />
                  <span className="text-sm text-[#1F2937]">Loyalty Points</span>
                </div>
                <button onClick={() => update('enableLoyalty', !settings.enableLoyalty)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${settings.enableLoyalty ? 'bg-blue-600' : 'bg-gray-200'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${settings.enableLoyalty ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Reward customers with loyalty points on purchases</p>
            </div>
          </SettingsSection>
        </div>
        <div className="space-y-6">
          <SettingsSection title="Additional Fields">
            <div className="py-2 space-y-3">
              {customFields.length === 0 && (
                <p className="text-xs text-slate-400 italic">No custom fields defined. Add one below.</p>
              )}
              {customFields.map(field => (
                <div key={field.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
                  <span className="text-sm text-[#1F2937] dark:text-slate-200">{field.name}</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={field.showInPrint} onChange={() => toggleFieldPrint(field.id)} className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">Print</span>
                    </label>
                    <button type="button" onClick={() => removeCustomField(field.id)}
                      className="text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1 rounded transition-colors"
                      title="Remove field">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-2">
                <input type="text" value={newFieldName} onChange={e => setNewFieldName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomField(); } }}
                  placeholder="New field name (e.g., PAN Number)"
                  className="flex-1 px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                <button type="button" onClick={addCustomField}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors">
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            </div>
          </SettingsSection>
        </div>
      </div>
      <div className="flex justify-end sticky bottom-0 bg-[#F5F6FA] dark:bg-gray-900 py-3">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm">
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Party Settings'}
        </button>
      </div>
    </motion.div>
  );
};

export default PartyTab;
