import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Clock, Calendar, Save, Loader2, CheckCircle2, Database, RefreshCw } from 'lucide-react';
import { toast } from 'react-toastify';
import { backupAPI } from '../../services/api';

const FREQUENCIES = [
  { value: 'daily', label: 'Daily', desc: 'Backup once every day' },
  { value: 'weekly', label: 'Weekly', desc: 'Backup once every week' },
  { value: 'monthly', label: 'Monthly', desc: 'Backup once every month' },
];

const formatDateTime = (iso) => {
  if (!iso) return 'Never';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return 'Never';
  }
};

const AutoBackup = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoBackup, setAutoBackup] = useState(false);
  const [frequency, setFrequency] = useState('daily');
  const [retention, setRetention] = useState(5);
  const [lastBackup, setLastBackup] = useState(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await backupAPI.getConfig();
      const cfg = res?.data || res || {};
      setAutoBackup(!!cfg.autoBackup);
      setFrequency(cfg.frequency || 'daily');
      setRetention(Number.isFinite(cfg.retention) ? cfg.retention : (parseInt(cfg.retention, 10) || 5));
      setLastBackup(cfg.lastBackup || null);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load backup settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    const ret = parseInt(retention, 10);
    if (!Number.isInteger(ret) || ret < 1) {
      toast.error('Retention must be at least 1 backup');
      return;
    }
    setSaving(true);
    try {
      await backupAPI.saveConfig({ autoBackup, frequency, retention: ret });
      toast.success('Backup settings saved');
      loadConfig();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to save backup settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-3xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft overflow-hidden">
          <div className="p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-500/20 rounded-2xl flex items-center justify-center">
                <Clock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Auto Backup</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Automatically back up your business data on a schedule.</p>
            </div>

            {loading ? (
              <div className="flex flex-col items-center gap-3 py-16">
                <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
                <p className="text-sm text-slate-400 dark:text-slate-500">Loading settings...</p>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-xl mx-auto">
                {/* Toggle */}
                <div className="flex items-center justify-between bg-slate-50 dark:bg-gray-700/30 rounded-xl p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                      <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Enable Automatic Backups</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Keep your data safe without manual effort.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoBackup}
                    onClick={() => setAutoBackup(v => !v)}
                    className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors ${autoBackup ? 'bg-blue-600' : 'bg-slate-300 dark:bg-gray-600'}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${autoBackup ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {/* Frequency */}
                <div className={`bg-slate-50 dark:bg-gray-700/30 rounded-xl p-5 transition-opacity ${autoBackup ? '' : 'opacity-50 pointer-events-none'}`}>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                    <Calendar className="w-4 h-4" /> Backup Frequency
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {FREQUENCIES.map(f => (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => setFrequency(f.value)}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${frequency === f.value ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'border-slate-200 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-700'}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{f.label}</span>
                          {frequency === f.value && <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{f.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Retention */}
                <div className={`bg-slate-50 dark:bg-gray-700/30 rounded-xl p-5 transition-opacity ${autoBackup ? '' : 'opacity-50 pointer-events-none'}`}>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Retention</label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Number of recent backups to keep. Older backups are removed automatically.</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={retention}
                      onChange={e => setRetention(e.target.value)}
                      className="w-28 px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-slate-100 text-sm"
                    />
                    <span className="text-sm text-slate-500 dark:text-slate-400">backups kept</span>
                  </div>
                </div>

                {/* Last backup */}
                <div className="flex items-center justify-between bg-slate-50 dark:bg-gray-700/30 rounded-xl p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Last Backup</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(lastBackup)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={loadConfig}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-gray-700 rounded-lg hover:bg-white dark:hover:bg-gray-700"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                  </button>
                </div>

                {/* Save */}
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-soft"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutoBackup;
