import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import ToggleSwitch from './ToggleSwitch';
import SettingsSection from './SettingsSection';
import { Save } from 'lucide-react';
import { defaultPrefs, loadSettings, saveCategory } from '../../hooks/useSettings';

const AccountingTab = () => {
  const [settings, setSettings] = useState(defaultPrefs.accounting);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings().then(data => {
      if (data?.preferences?.accounting) {
        setSettings({ ...defaultPrefs.accounting, ...data.preferences.accounting });
      }
    });
  }, []);

  const update = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCategory('accounting', settings);
      toast.success('Accounting settings saved');
    } catch { toast.error('Failed to save accounting settings'); }
    finally { setSaving(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 space-y-6 overflow-y-auto max-h-full">
      <div className="max-w-3xl space-y-6">
        <SettingsSection title="Accounting Settings">
          <ToggleSwitch label="Enable Accounting Module" checked={settings.enableAccounting} onChange={v => update('enableAccounting', v)} />
          <ToggleSwitch label="Allow Journal Entries" checked={settings.allowJournalEntries} onChange={v => update('allowJournalEntries', v)} disabled={!settings.enableAccounting} />
        </SettingsSection>
      </div>
      <div className="flex justify-end sticky bottom-0 bg-[#F5F6FA] py-3">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm">
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Accounting Settings'}
        </button>
      </div>
    </motion.div>
  );
};

export default AccountingTab;
