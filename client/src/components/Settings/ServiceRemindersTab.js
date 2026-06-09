import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import ToggleSwitch from './ToggleSwitch';
import SettingsSection from './SettingsSection';
import { SettingsInputRow } from './SettingsRow';
import { Bell, Users, TrendingUp, Play, Sparkles, Save } from 'lucide-react';
import { defaultPrefs, loadSettings, saveCategory } from '../../hooks/useSettings';

const ServiceRemindersTab = () => {
  const [settings, setSettings] = useState(defaultPrefs.serviceReminders);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings().then(data => {
      if (data?.preferences?.serviceReminders) {
        setSettings({ ...defaultPrefs.serviceReminders, ...data.preferences.serviceReminders });
      }
    });
  }, []);

  const update = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCategory('serviceReminders', settings);
      toast.success('Service reminders settings saved');
    } catch { toast.error('Failed to save service reminders settings'); }
    finally { setSaving(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 h-full flex flex-col overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full space-y-6">
        <SettingsSection title="Service Reminder Settings">
          <ToggleSwitch label="Enable Service Reminders" checked={settings.enableReminders} onChange={v => update('enableReminders', v)} />
          <SettingsInputRow label="Reminder Interval" value={settings.reminderInterval} onChange={v => update('reminderInterval', v)} placeholder="30" suffix="days" />
          <ToggleSwitch label="Auto Follow-up" checked={settings.autoFollowUp} onChange={v => update('autoFollowUp', v)} />
        </SettingsSection>

        <div className="bg-blue-600 rounded-xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full -translate-y-1/2 translate-x-1/2 opacity-30" />
          <div className="relative flex items-center gap-6">
            <div className="w-20 h-20 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Play className="w-8 h-8 text-white ml-1" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Watch Tutorial</h3>
              <p className="text-sm text-blue-100 mt-1">Learn how Service Reminders can help grow your business</p>
              <button className="mt-3 px-4 py-1.5 bg-white text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-50 transition-colors inline-flex items-center gap-2">
                <Play className="w-4 h-4" /> Play Video
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="w-48 h-48 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full flex items-center justify-center">
            <Bell className="w-20 h-20 text-blue-300" />
          </div>
        </div>

        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3">
            <h2 className="text-2xl font-bold text-[#1F2937]">Service Reminders</h2>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-700 rounded-full">New</span>
          </div>
          <p className="text-gray-400">Never miss a follow-up with automated service reminders</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: Users, label: 'Remind Parties', desc: 'Send automatic reminders to your customers' },
            { icon: TrendingUp, label: 'Retain Customers', desc: 'Keep customers coming back for more' },
            { icon: Sparkles, label: 'Grow Business', desc: 'Increase repeat business and revenue' },
          ].map((feature, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-5 text-center space-y-2">
              <div className="w-12 h-12 mx-auto bg-blue-50 rounded-xl flex items-center justify-center">
                <feature.icon className="w-6 h-6 text-blue-600" />
              </div>
              <p className="text-sm font-semibold text-[#1F2937]">{feature.label}</p>
              <p className="text-xs text-gray-400">{feature.desc}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Service Reminder Settings'}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ServiceRemindersTab;