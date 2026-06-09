import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import ToggleSwitch from './ToggleSwitch';
import SettingsSection from './SettingsSection';
import { Smartphone, CreditCard, Eye, LogIn, Save, Loader2, CheckCircle, Wifi, WifiOff } from 'lucide-react';
import { defaultPrefs, loadSettings, saveCategory } from '../../hooks/useSettings';
import { whatsappAPI } from '../../services/api';

const TransactionMessageTab = () => {
  const [settings, setSettings] = useState(defaultPrefs.transactionMessage);
  const [saving, setSaving] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('invoice');
  const [templateText, setTemplateText] = useState('');
  const [whatsappStatus, setWhatsappStatus] = useState({ connected: false, status: 'disconnected' });

  const defaultTemplates = {
    invoice: 'Dear {customer_name},\n\nThank you for your purchase!\n\nInvoice: {invoice_number}\nDate: {date}\nAmount: {currency}{amount}\n{balance_line}\n\nView Invoice: {invoice_link}\n\nRegards,\n{company_name}',
    estimate: 'Dear {customer_name},\n\nHere is your estimate/quotation.\n\nEstimate: {invoice_number}\nDate: {date}\nAmount: {currency}{amount}\n\nRegards,\n{company_name}',
    order: 'Dear {customer_name},\n\nYour order has been confirmed.\n\nOrder: {invoice_number}\nDate: {date}\nAmount: {currency}{amount}\n\nRegards,\n{company_name}',
    proforma: 'Dear {customer_name},\n\nProforma Invoice for your reference.\n\nInvoice: {invoice_number}\nDate: {date}\nAmount: {currency}{amount}\n\nRegards,\n{company_name}',
    challan: 'Dear {customer_name},\n\nDelivery Challan attached.\n\nChallan: {invoice_number}\nDate: {date}\n\nRegards,\n{company_name}',
    credit_note: 'Dear {customer_name},\n\nCredit Note issued.\n\nNote: {invoice_number}\nDate: {date}\nAmount: {currency}{amount}\n\nRegards,\n{company_name}',
    payment_in: 'Dear {customer_name},\n\nPayment received successfully.\n\nAmount: {currency}{amount}\nMode: {payment_mode}\n{balance_line}\n\nThank you!\n{company_name}',
    payment_out: 'Dear {supplier_name},\n\nPayment sent successfully.\n\nAmount: {currency}{amount}\nMode: {payment_mode}\n\nRegards,\n{company_name}',
  };

  const templateVars = [
    { key: '{customer_name}', desc: 'Customer name' },
    { key: '{supplier_name}', desc: 'Supplier name' },
    { key: '{company_name}', desc: 'Your business name' },
    { key: '{invoice_number}', desc: 'Invoice number' },
    { key: '{date}', desc: 'Transaction date' },
    { key: '{amount}', desc: 'Total amount' },
    { key: '{currency}', desc: 'Currency symbol' },
    { key: '{balance}', desc: 'Remaining balance' },
    { key: '{balance_line}', desc: 'Balance line (if unpaid)' },
    { key: '{payment_mode}', desc: 'Payment mode' },
    { key: '{invoice_link}', desc: 'Web link to invoice' },
    { key: '{payment_link}', desc: 'Payment link' },
  ];

  useEffect(() => {
    loadSettings().then(data => {
      if (data?.preferences?.transactionMessage) {
        setSettings({ ...defaultPrefs.transactionMessage, ...data.preferences.transactionMessage });
        const savedTemplates = data.preferences.transactionMessage.templates || {};
        setTemplateText(savedTemplates[selectedTemplate] || defaultTemplates[selectedTemplate]);
      }
    });
    whatsappAPI.getStatus().then(({ data }) => setWhatsappStatus(data)).catch(() => {});
  }, []);

  useEffect(() => {
    loadSettings().then(data => {
      const savedTemplates = data?.preferences?.transactionMessage?.templates || {};
      setTemplateText(savedTemplates[selectedTemplate] || defaultTemplates[selectedTemplate]);
    });
  }, [selectedTemplate]);

  const update = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const existing = await loadSettings();
      const existingTemplates = existing?.preferences?.transactionMessage?.templates || {};
      await saveCategory('transactionMessage', { ...settings, templates: { ...existingTemplates, [selectedTemplate]: templateText } });
      toast.success('Transaction message settings saved');
    } catch { toast.error('Failed to save message settings'); }
    finally { setSaving(false); }
  };

  const handleSaveTemplate = async () => {
    try {
      const current = await whatsappAPI.getTemplates();
      const updated = { ...current.data.templates, [selectedTemplate]: templateText };
      await whatsappAPI.saveTemplates(updated);
      toast.success('Template saved');
    } catch { toast.error('Failed to save template'); }
  };

  const autoMessagesList = [
    { key: 'autoMsgSales', label: 'Sales' },
    { key: 'autoMsgPurchase', label: 'Purchase' },
    { key: 'autoMsgSalesReturn', label: 'Sales Return' },
    { key: 'autoMsgPurchaseReturn', label: 'Purchase Return' },
    { key: 'autoMsgPaymentIn', label: 'Payment In' },
    { key: 'autoMsgPaymentOut', label: 'Payment Out' },
    { key: 'autoMsgSaleOrder', label: 'Sale Order' },
    { key: 'autoMsgPurchaseOrder', label: 'Purchase Order' },
    { key: 'autoMsgEstimate', label: 'Estimate' },
    { key: 'autoMsgProforma', label: 'Proforma' },
    { key: 'autoMsgDeliveryChallan', label: 'Delivery Challan' },
    { key: 'autoMsgCancelledInvoice', label: 'Cancelled Invoice' },
  ];

  const renderPreview = () => {
    let text = templateText || defaultTemplates.invoice;
    const vars = {
      customer_name: 'Rahul Traders',
      company_name: 'Your Business',
      invoice_number: 'INV-000001',
      date: new Date().toLocaleDateString('en-IN'),
      amount: '2,500.00',
      currency: '₹',
      balance: '1,000.00',
      balance_line: 'Balance: ₹1,000.00',
      payment_mode: 'UPI',
      invoice_link: 'https://yourapp.com/sales/view/123',
      payment_link: 'https://yourapp.com/sales/view/123?pay=true',
      supplier_name: 'ABC Suppliers',
    };
    for (const [key, value] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return text;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 h-full flex flex-col overflow-hidden">
      <div className="flex gap-6 flex-1 overflow-hidden">
        <div className="w-[420px] min-w-[420px] overflow-y-auto space-y-6 pr-2">
          <SettingsSection title="WhatsApp Connection">
            <div className={`flex items-center gap-3 p-3 rounded-lg ${whatsappStatus.connected ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-amber-50 dark:bg-amber-500/10'}`}>
              {whatsappStatus.connected ? <Wifi className="w-5 h-5 text-emerald-500" /> : <WifiOff className="w-5 h-5 text-amber-500" />}
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{whatsappStatus.connected ? 'Connected' : 'Not Connected'}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {whatsappStatus.connected ? `Phone: ${whatsappStatus.phoneNumber}` : 'Go to WhatsApp Connect page to link'}
                </p>
              </div>
            </div>
          </SettingsSection>
          <SettingsSection title="Message Type">
            <ToggleSwitch label="Send via Vyapar" checked={settings.sendViaVyapar} onChange={v => update('sendViaVyapar', v)} />
            <ToggleSwitch label="Send via WhatsApp" checked={settings.sendViaWhatsApp} onChange={v => update('sendViaWhatsApp', v)} />
          </SettingsSection>
          <SettingsSection title="Recipient Settings">
            <ToggleSwitch label="Send Message to Party" checked={settings.sendMessageToParty} onChange={v => update('sendMessageToParty', v)} />
            <ToggleSwitch label="Send Copy to Self" checked={settings.sendCopyToSelf} onChange={v => update('sendCopyToSelf', v)} />
            <ToggleSwitch label="Send Transaction Updates" checked={settings.sendTransactionUpdates} onChange={v => update('sendTransactionUpdates', v)} />
            <ToggleSwitch label="Auto Share Invoices" checked={settings.autoShareInvoices} onChange={v => update('autoShareInvoices', v)} />
          </SettingsSection>
          <SettingsSection title="Message Content">
            <ToggleSwitch label="Current Balance" checked={settings.currentBalance} onChange={v => update('currentBalance', v)} />
            <ToggleSwitch label="Web Invoice Link" checked={settings.webInvoiceLink} onChange={v => update('webInvoiceLink', v)} />
            <ToggleSwitch label="Payment Link" checked={settings.paymentLink} onChange={v => update('paymentLink', v)} />
          </SettingsSection>
          <SettingsSection title="Automatic Messages">
            <div className="max-h-[300px] overflow-y-auto">
              {autoMessagesList.map(({ key, label }) => (
                <ToggleSwitch key={key} label={label} checked={settings[key]} onChange={v => update(key, v)} />
              ))}
            </div>
          </SettingsSection>
        </div>
        <div className="flex-1 overflow-y-auto space-y-6">
          <SettingsSection title="Message Editor">
            <div className="py-3 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Transaction Type</label>
                <select value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-[#1F2937]">
                  <option value="invoice">Sale Invoice</option>
                  <option value="estimate">Estimate / Quotation</option>
                  <option value="order">Sale Order</option>
                  <option value="proforma">Proforma Invoice</option>
                  <option value="challan">Delivery Challan</option>
                  <option value="credit_note">Credit Note / Return</option>
                  <option value="payment_in">Payment Received</option>
                  <option value="payment_out">Payment Sent</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Message Template</label>
                <textarea value={templateText} onChange={e => setTemplateText(e.target.value)} rows={6}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-[#1F2937] resize-none font-mono" />
                <button onClick={handleSaveTemplate}
                  className="mt-2 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50 transition-colors">
                  Save Template
                </button>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Available Variables</label>
                <div className="grid grid-cols-2 gap-1">
                  {templateVars.map(v => (
                    <div key={v.key} className="flex items-center gap-2 text-xs">
                      <code className="px-1 py-0.5 bg-gray-100 rounded text-blue-600 font-mono">{v.key}</code>
                      <span className="text-gray-400">{v.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SettingsSection>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-[#1F2937]">Message Preview</span>
              </div>
              <span className="text-xs text-gray-400">WhatsApp Preview</span>
            </div>
            <div className="p-6 flex justify-center">
              <div className="w-[360px] bg-gray-50 rounded-2xl overflow-hidden border border-gray-200">
                <div className="bg-green-600 px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"><Smartphone className="w-5 h-5 text-white" /></div>
                  <div><p className="text-sm font-medium text-white">WhatsApp Business</p><p className="text-xs text-green-200">{whatsappStatus.connected ? 'Online' : 'Offline'}</p></div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="bg-white rounded-lg p-3 shadow-sm">
                    <p className="text-sm text-[#1F2937] whitespace-pre-line">{renderPreview()}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 text-xs text-gray-400"><CreditCard className="w-3.5 h-3.5" /><span>Invoice attached</span></div>
                  </div>
                  <div className="text-xs text-gray-400 text-right">Delivered</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-end pt-3">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm">
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Message Settings'}
        </button>
      </div>
    </motion.div>
  );
};

export default TransactionMessageTab;
