import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { saveCategory } from '../../hooks/useSettings';
import { Bell, BellOff, Save, Loader2, ShoppingCart, Receipt, DollarSign, Package, Users, AlertTriangle, RotateCcw, Wallet, Mail, MessageSquare, Smartphone, ChevronDown, ChevronUp } from 'lucide-react';

const NOTIFICATION_TYPES = [
  { key: 'new_sale', label: 'New Sale Created', icon: ShoppingCart, category: 'Sales' },
  { key: 'new_purchase', label: 'New Purchase Created', icon: Receipt, category: 'Purchases' },
  { key: 'payment_received', label: 'Payment Received', icon: DollarSign, category: 'Payments' },
  { key: 'payment_due', label: 'Payment Due Reminder', icon: AlertTriangle, category: 'Payments' },
  { key: 'low_stock', label: 'Low Stock Alert', icon: Package, category: 'Inventory' },
  { key: 'sale_return', label: 'Sale Return', icon: RotateCcw, category: 'Sales' },
  { key: 'purchase_return', label: 'Purchase Return', icon: RotateCcw, category: 'Purchases' },
  { key: 'expense_created', label: 'Expense Recorded', icon: Wallet, category: 'Expenses' },
  { key: 'party_added', label: 'New Party Added', icon: Users, category: 'Parties' },
  { key: 'bank_transaction', label: 'Bank Transaction', icon: DollarSign, category: 'Bank' },
  { key: 'service_reminder', label: 'Service Reminder', icon: Bell, category: 'Reminders' },
  { key: 'sale_cancelled', label: 'Sale Cancelled', icon: RotateCcw, category: 'Sales' },
  { key: 'purchase_cancelled', label: 'Purchase Cancelled', icon: RotateCcw, category: 'Purchases' },
];

const ChannelSection = ({ title, icon: Icon, iconColor, enabled, onToggle, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 transition-colors">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${enabled ? 'bg-blue-50' : 'bg-gray-100'}`}>
            <Icon className={`w-4 h-4 ${enabled ? 'text-blue-600' : 'text-gray-400'}`} />
          </div>
          <span className="text-sm font-medium text-gray-900">{title}</span>
          {enabled && <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full">Active</span>}
        </div>
        <div className="flex items-center gap-3">
          <div onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${enabled ? 'bg-blue-600' : 'bg-gray-300'}`}>
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform`}
              style={{ transform: `translateX(${enabled ? '18px' : '2px'})` }} />
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>
      {open && enabled && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
          className="border-t border-gray-100 px-4 py-4 space-y-3">
          {children}
        </motion.div>
      )}
    </div>
  );
};

const NotificationPreferencesTab = () => {
  const [enabled, setEnabled] = useState(true);
  const [preferences, setPreferences] = useState({});
  const [emailConfig, setEmailConfig] = useState({ enabled: false, smtpHost: '', smtpPort: '587', smtpSecure: false, smtpUser: '', smtpPass: '', fromEmail: '', paymentReceived: true, lowStock: true });
  const [smsConfig, setSmsConfig] = useState({ enabled: false, provider: 'generic', apiKey: '', senderId: '', paymentReceived: true, lowStock: true });
  const [pushConfig, setPushConfig] = useState({ enabled: false, paymentReceived: true, lowStock: true, newSale: false, newPurchase: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    import('../../hooks/useSettings').then(({ loadSettings }) => {
      loadSettings().then(data => {
        const notifPrefs = data?.preferences?.notifications || {};
        const allEnabled = {};
        NOTIFICATION_TYPES.forEach(t => { allEnabled[t.key] = notifPrefs[t.key] !== undefined ? notifPrefs[t.key] : true; });
        setPreferences(allEnabled);
        setEnabled(notifPrefs.enableNotifications !== false);
        if (notifPrefs.email) setEmailConfig(prev => ({ ...prev, ...notifPrefs.email }));
        if (notifPrefs.sms) setSmsConfig(prev => ({ ...prev, ...notifPrefs.sms }));
        if (notifPrefs.push) setPushConfig(prev => ({ ...prev, ...notifPrefs.push }));
        setLoading(false);
      });
    });
  }, []);

  const togglePref = (key) => setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleAll = (enable) => { const updated = {}; NOTIFICATION_TYPES.forEach(t => { updated[t.key] = enable; }); setPreferences(updated); };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCategory('notifications', {
        enableNotifications: enabled,
        ...preferences,
        email: emailConfig,
        sms: smsConfig,
        push: pushConfig,
      });
      toast.success('Notification preferences saved');
    } catch { toast.error('Failed to save preferences'); }
    finally { setSaving(false); }
  };

  const categories = [...new Set(NOTIFICATION_TYPES.map(t => t.category))];

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#1F2937]">Notification Preferences</h1>
          <p className="text-sm text-gray-500 mt-0.5">Choose which notifications you want to receive and how</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-gray-300'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
          <span className="text-sm font-medium text-gray-700">{enabled ? 'Enabled' : 'Disabled'}</span>
        </div>
      </div>

      {enabled && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => toggleAll(true)} className="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">Enable All</button>
            <button onClick={() => toggleAll(false)} className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Disable All</button>
            <span className="text-xs text-gray-400 ml-2">{Object.values(preferences).filter(Boolean).length} of {NOTIFICATION_TYPES.length} enabled</span>
          </div>

          {categories.map(category => (
            <div key={category} className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700">{category}</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {NOTIFICATION_TYPES.filter(t => t.category === category).map(type => {
                  const Icon = type.icon;
                  const isEnabled = preferences[type.key] !== false;
                  return (
                    <div key={type.key} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isEnabled ? 'bg-blue-50' : 'bg-gray-100'}`}>
                          <Icon className={`w-4 h-4 ${isEnabled ? 'text-blue-600' : 'text-gray-400'}`} />
                        </div>
                        <span className={`text-sm font-medium ${isEnabled ? 'text-gray-900' : 'text-gray-500'}`}>{type.label}</span>
                      </div>
                      <button onClick={() => togglePref(type.key)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}>
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform`}
                          style={{ transform: `translateX(${isEnabled ? '18px' : '2px'})` }} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Notification Channels */}
          <div className="pt-4">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">Notification Channels</h2>
            <div className="space-y-3">
              <ChannelSection title="Email Notifications" icon={Mail} enabled={emailConfig.enabled} onToggle={() => setEmailConfig(p => ({ ...p, enabled: !p.enabled }))}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">SMTP Host</label>
                    <input type="text" value={emailConfig.smtpHost} onChange={e => setEmailConfig(p => ({ ...p, smtpHost: e.target.value }))}
                      placeholder="smtp.gmail.com" className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">SMTP Port</label>
                    <input type="text" value={emailConfig.smtpPort} onChange={e => setEmailConfig(p => ({ ...p, smtpPort: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">SMTP User</label>
                    <input type="text" value={emailConfig.smtpUser} onChange={e => setEmailConfig(p => ({ ...p, smtpUser: e.target.value }))}
                      placeholder="your@email.com" className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">SMTP Password</label>
                    <input type="password" value={emailConfig.smtpPass} onChange={e => setEmailConfig(p => ({ ...p, smtpPass: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">From Email</label>
                    <input type="email" value={emailConfig.fromEmail} onChange={e => setEmailConfig(p => ({ ...p, fromEmail: e.target.value }))}
                      placeholder="noreply@business.com" className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div className="flex items-center gap-4 pt-5">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={emailConfig.smtpSecure} onChange={e => setEmailConfig(p => ({ ...p, smtpSecure: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      SSL/TLS
                    </label>
                  </div>
                </div>
                <div className="pt-2 space-y-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={emailConfig.paymentReceived} onChange={e => setEmailConfig(p => ({ ...p, paymentReceived: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    Payment received emails
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={emailConfig.lowStock} onChange={e => setEmailConfig(p => ({ ...p, lowStock: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    Low stock alert emails
                  </label>
                </div>
              </ChannelSection>

              <ChannelSection title="SMS Notifications" icon={MessageSquare} enabled={smsConfig.enabled} onToggle={() => setSmsConfig(p => ({ ...p, enabled: !p.enabled }))}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Provider</label>
                    <select value={smsConfig.provider} onChange={e => setSmsConfig(p => ({ ...p, provider: e.target.value }))}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                      <option value="generic">Generic HTTP API</option>
                      <option value="twilio">Twilio</option>
                      <option value="textlocal">TextLocal</option>
                      <option value="msg91">MSG91</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Sender ID</label>
                    <input type="text" value={smsConfig.senderId} onChange={e => setSmsConfig(p => ({ ...p, senderId: e.target.value }))}
                      placeholder="VYAPAR" className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">API Key</label>
                    <input type="password" value={smsConfig.apiKey} onChange={e => setSmsConfig(p => ({ ...p, apiKey: e.target.value }))}
                      placeholder="Enter your SMS API key" className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="pt-2 space-y-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={smsConfig.paymentReceived} onChange={e => setSmsConfig(p => ({ ...p, paymentReceived: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    Payment received SMS
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={smsConfig.lowStock} onChange={e => setSmsConfig(p => ({ ...p, lowStock: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    Low stock alert SMS
                  </label>
                </div>
              </ChannelSection>

              <ChannelSection title="Push Notifications" icon={Smartphone} enabled={pushConfig.enabled} onToggle={() => setPushConfig(p => ({ ...p, enabled: !p.enabled }))}>
                <p className="text-xs text-gray-500 mb-2">Push notifications require VAPID keys configured in the server environment.</p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={pushConfig.paymentReceived} onChange={e => setPushConfig(p => ({ ...p, paymentReceived: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    Payment received push
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={pushConfig.lowStock} onChange={e => setPushConfig(p => ({ ...p, lowStock: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    Low stock alert push
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={pushConfig.newSale} onChange={e => setPushConfig(p => ({ ...p, newSale: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    New sale push
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={pushConfig.newPurchase} onChange={e => setPushConfig(p => ({ ...p, newPurchase: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    New purchase push
                  </label>
                </div>
              </ChannelSection>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Bell className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800">About Notifications</p>
                <p className="text-sm text-blue-600 mt-1">
                  Disabled notifications will not be created in the system. You can always change these preferences later.
                  Configure email, SMS, and push channels to receive notifications across multiple delivery methods.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {!enabled && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
          <BellOff className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Notifications are disabled. Enable them to receive alerts for business events.</p>
        </motion.div>
      )}

      <div className="flex justify-end pt-2">
        <button onClick={handleSave} disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
};

export default NotificationPreferencesTab;
