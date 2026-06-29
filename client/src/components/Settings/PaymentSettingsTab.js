import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { CreditCard, Save, Loader2, ExternalLink, ShieldCheck, Info } from 'lucide-react';
import { paymentAPI } from '../../services/api';
import ToggleSwitch from './ToggleSwitch';

const PaymentSettingsTab = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [keyId, setKeyId] = useState('');
  const [keySecret, setKeySecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [hasSecret, setHasSecret] = useState(false);
  const [hasWebhookSecret, setHasWebhookSecret] = useState(false);
  const [mode, setMode] = useState('test');

  useEffect(() => {
    paymentAPI.getConfig()
      .then(({ data }) => {
        setEnabled(!!data.enabled);
        setKeyId(data.keyId || '');
        setHasSecret(!!data.hasSecret);
        setHasWebhookSecret(!!data.hasWebhookSecret);
        setMode(data.mode || 'test');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (enabled && !keyId.trim()) return toast.warn('Enter your Razorpay Key ID');
    if (enabled && !keySecret.trim() && !hasSecret) return toast.warn('Enter your Razorpay Key Secret');
    setSaving(true);
    try {
      const payload = { enabled, keyId: keyId.trim() };
      if (keySecret.trim()) payload.keySecret = keySecret.trim();
      if (webhookSecret.trim()) payload.webhookSecret = webhookSecret.trim();
      const { data } = await paymentAPI.saveConfig(payload);
      toast.success(data.enabled ? 'Razorpay connected & saved' : 'Payment settings saved');
      if (keySecret.trim()) { setHasSecret(true); setKeySecret(''); }
      if (webhookSecret.trim()) { setHasWebhookSecret(true); setWebhookSecret(''); }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to save — check your keys');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;

  const inputCls = 'w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none';

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/15 flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[#1F2937] dark:text-gray-100">Payments</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Collect online payments from customers via Razorpay (UPI, cards, netbanking).</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#1F2937] dark:text-gray-100">Razorpay</span>
            {keyId && (
              <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${keyId.startsWith('rzp_live_')
                ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'}`}>
                {keyId.startsWith('rzp_live_') ? 'LIVE' : 'TEST'}
              </span>
            )}
            {enabled && hasSecret && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5" /> Connected
              </span>
            )}
          </div>
          <ToggleSwitch checked={enabled} onChange={setEnabled} />
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Key ID</label>
            <input type="text" value={keyId} onChange={e => setKeyId(e.target.value)} placeholder="rzp_test_xxxxxxxx or rzp_live_xxxxxxxx" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Key Secret</label>
            <input type="password" value={keySecret} onChange={e => setKeySecret(e.target.value)}
              placeholder={hasSecret ? '•••••••••• (saved — leave blank to keep)' : 'Your Razorpay key secret'} className={inputCls} autoComplete="new-password" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Webhook Secret <span className="text-gray-400 font-normal">(optional — for auto-confirmation on the cloud)</span>
            </label>
            <input type="password" value={webhookSecret} onChange={e => setWebhookSecret(e.target.value)}
              placeholder={hasWebhookSecret ? '•••••••••• (saved)' : 'Razorpay webhook secret'} className={inputCls} autoComplete="new-password" />
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 px-3 py-2.5">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Get your keys from <span className="font-semibold">Razorpay Dashboard → Settings → API Keys</span>.
              Use <span className="font-semibold">Test</span> keys (rzp_test_…) to try it safely with fake payments before going live.
              When enabled, the WhatsApp invoice message includes a real <span className="font-semibold">Pay Now</span> link and paid invoices are marked automatically.
            </p>
          </div>

          <div className="flex items-center justify-between pt-1">
            <a href="https://dashboard.razorpay.com/app/keys" target="_blank" rel="noreferrer"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">
              Open Razorpay Dashboard <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentSettingsTab;
