import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import ToggleSwitch from './ToggleSwitch';
import SettingsSection from './SettingsSection';
import { SettingsSelectRow, SettingsInputRow } from './SettingsRow';
import { ZoomIn, Warehouse, Save } from 'lucide-react';
import { defaultPrefs, loadSettings, saveCategory } from '../../hooks/useSettings';
import { settingAPI, backupAPI } from '../../services/api';

const GeneralTab = () => {
  const [settings, setSettings] = useState(defaultPrefs.general);
  const [business, setBusiness] = useState({
    businessName: '', phone: '', email: '', address: '', gstNumber: '',
    state: '', currency: '₹', invoicePrefix: 'INV-',
    bankName: '', bankAccountNumber: '', bankIfsc: '', bankBranch: '', upiId: '',
  });
  const [saving, setSaving] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeConfirm, setPasscodeConfirm] = useState('');
  const [hasPasscode, setHasPasscode] = useState(false);
  const [lastBackupDate, setLastBackupDate] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [invoiceNote, setInvoiceNote] = useState('');
  const [signaturePreview, setSignaturePreview] = useState('');

  useEffect(() => {
    loadSettings().then(data => {
      if (data?.preferences?.general) {
        setSettings({ ...defaultPrefs.general, ...data.preferences.general });
        setHasPasscode(!!data.preferences.general.passcodeHash);
        if (data.preferences.general.darkMode !== undefined) {
          setDarkMode(data.preferences.general.darkMode);
        }
      }
      const topFields = ['businessName', 'phone', 'email', 'address', 'gstNumber',
        'state', 'currency', 'invoicePrefix', 'bankName', 'bankAccountNumber', 'bankIfsc', 'bankBranch', 'upiId'];
      const biz = {};
      topFields.forEach(f => { if (data[f] !== undefined) biz[f] = data[f]; });
      setBusiness(prev => ({ ...prev, ...biz }));
      if (data?.invoiceNote) setInvoiceNote(data.invoiceNote);
      if (data?.signature) setSignaturePreview(`/${data.signature}`);
    });
    backupAPI.getHistory().then(({ data }) => {
      if (data && data.length > 0) {
        setLastBackupDate(data[0].created);
      }
    }).catch(() => {});
  }, []);

  const update = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));
  const updateBusiness = (key, value) => setBusiness(prev => ({ ...prev, [key]: value }));

  const handleClearPasscode = async () => {
    try {
      await settingAPI.clearPasscode();
      setHasPasscode(false);
      setPasscodeInput('');
      setPasscodeConfirm('');
      setSettings(prev => ({ ...prev, enablePasscode: false }));
      toast.success('Passcode cleared');
    } catch { toast.error('Failed to clear passcode'); }
  };

  const handleSave = async () => {
    if (settings.enablePasscode && passcodeInput) {
      if (passcodeInput.length < 4) {
        toast.error('Passcode must be at least 4 characters');
        return;
      }
      if (passcodeInput !== passcodeConfirm) {
        toast.error('Passcodes do not match');
        return;
      }
    }
    setSaving(true);
    try {
      const payload = { ...business, invoiceNote, preferences: { general: { ...settings } } };
      if (settings.enablePasscode && passcodeInput) {
        payload.passcode = passcodeInput;
        payload.preferences.general.enablePasscode = true;
      }
      const { data } = await settingAPI.update(payload);
      setSettings(prev => ({ ...prev, ...(data?.preferences?.general || {}) }));
      setHasPasscode(!!data?.preferences?.general?.passcodeHash);
      setPasscodeInput('');
      setPasscodeConfirm('');
      toast.success('General settings saved');
    } catch { toast.error('Failed to save general settings'); }
    finally { setSaving(false); }
  };

  const zoomOptions = ['70', '80', '90', '100', '110', '115', '120', '130'];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 space-y-6 overflow-y-auto max-h-full">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="space-y-6">
          <SettingsSection title="Application">
            <ToggleSwitch label="Enable Passcode" checked={settings.enablePasscode} onChange={v => update('enablePasscode', v)} />
            {settings.enablePasscode && (
              <div className="py-2 space-y-3 pl-1 border-l-2 border-blue-100 dark:border-blue-900/40 ml-1">
                {hasPasscode ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">A passcode is set. Enter a new value to change it.</p>
                ) : (
                  <p className="text-xs text-amber-600 dark:text-amber-400">No passcode set yet. Create one below.</p>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">New Passcode</label>
                  <input type="password" value={passcodeInput} onChange={e => setPasscodeInput(e.target.value)}
                    placeholder="At least 4 characters"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Confirm Passcode</label>
                  <input type="password" value={passcodeConfirm} onChange={e => setPasscodeConfirm(e.target.value)}
                    placeholder="Re-enter passcode"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                {hasPasscode && (
                  <button type="button" onClick={handleClearPasscode}
                    className="text-xs text-red-600 dark:text-red-400 hover:underline">
                    Remove existing passcode
                  </button>
                )}
              </div>
            )}
            <SettingsSelectRow label="Business Currency" value={settings.businessCurrency} onChange={v => update('businessCurrency', v)} options={['INR', 'USD', 'EUR']} />
            <SettingsInputRow label="GSTIN Number" value={settings.gstin} onChange={v => update('gstin', v)} placeholder="Enter GSTIN" />
            <ToggleSwitch label="Stop Sale on Negative Stock" checked={settings.stopSaleOnNegativeStock} onChange={v => update('stopSaleOnNegativeStock', v)} />
            <ToggleSwitch label="Block New Items from Transaction Form" checked={settings.blockNewItemsFromTransaction} onChange={v => update('blockNewItemsFromTransaction', v)} />
            <ToggleSwitch label="Block New Parties from Transaction Form" checked={settings.blockNewPartiesFromTransaction} onChange={v => update('blockNewPartiesFromTransaction', v)} />
          </SettingsSection>
          <SettingsSection title="More Transactions">
            <ToggleSwitch label="Estimate/Quotation" checked={settings.estimateQuotation} onChange={v => update('estimateQuotation', v)} />
            <ToggleSwitch label="Proforma Invoice" checked={settings.proformaInvoice} onChange={v => update('proformaInvoice', v)} />
            <ToggleSwitch label="Sale/Purchase Order" checked={settings.salePurchaseOrder} onChange={v => update('salePurchaseOrder', v)} />
            <ToggleSwitch label="Other Income" checked={settings.otherIncome} onChange={v => update('otherIncome', v)} />
            <ToggleSwitch label="Fixed Assets" checked={settings.fixedAssets} onChange={v => update('fixedAssets', v)} />
            <ToggleSwitch label="Delivery Challan" checked={settings.deliveryChallan} onChange={v => update('deliveryChallan', v)} />
            <ToggleSwitch label="Goods Return on Delivery Challan" checked={settings.goodsReturnOnDC} onChange={v => update('goodsReturnOnDC', v)} />
            <ToggleSwitch label="Print Amount on Delivery Challan" checked={settings.printAmountOnDC} onChange={v => update('printAmountOnDC', v)} />
          </SettingsSection>
        </div>
        <div className="space-y-6">
          <SettingsSection title="Business Profile">
            <div className="space-y-3 pt-1">
              <SettingsInputRow label="Business Name" value={business.businessName} onChange={v => updateBusiness('businessName', v)} placeholder="Your business name" />
              <SettingsInputRow label="Phone" value={business.phone} onChange={v => updateBusiness('phone', v)} placeholder="Phone number" />
              <SettingsInputRow label="Email" value={business.email} onChange={v => updateBusiness('email', v)} placeholder="Email address" />
              <SettingsInputRow label="Address" value={business.address} onChange={v => updateBusiness('address', v)} placeholder="Business address" />
              <SettingsInputRow label="GST Number" value={business.gstNumber} onChange={v => updateBusiness('gstNumber', v)} placeholder="GSTIN" />
              <SettingsSelectRow label="State" value={business.state} onChange={v => updateBusiness('state', v)}
                options={['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry']} />
              <SettingsInputRow label="Currency Symbol" value={business.currency} onChange={v => updateBusiness('currency', v)} placeholder="₹" />
              <SettingsInputRow label="Invoice Prefix" value={business.invoicePrefix} onChange={v => updateBusiness('invoicePrefix', v)} placeholder="INV-" />
              <SettingsInputRow label="Bank Name" value={business.bankName} onChange={v => updateBusiness('bankName', v)} placeholder="Bank name" />
              <SettingsInputRow label="Bank Account No" value={business.bankAccountNumber} onChange={v => updateBusiness('bankAccountNumber', v)} placeholder="Account number" />
              <SettingsInputRow label="Bank IFSC" value={business.bankIfsc} onChange={v => updateBusiness('bankIfsc', v)} placeholder="IFSC code" />
              <SettingsInputRow label="Bank Branch" value={business.bankBranch} onChange={v => updateBusiness('bankBranch', v)} placeholder="Branch name" />
              <SettingsInputRow label="UPI ID" value={business.upiId} onChange={v => updateBusiness('upiId', v)} placeholder="UPI ID" />
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Invoice Note</label>
                <textarea value={invoiceNote} onChange={e => setInvoiceNote(e.target.value)}
                  placeholder="Default note to appear on invoices (e.g., Thank you for your business!)"
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Signature</label>
                <div className="flex items-center gap-3">
                  {signaturePreview && (
                    <img src={signaturePreview} alt="Signature" className="h-12 w-32 object-contain border rounded" />
                  )}
                  <label className="cursor-pointer">
                    <span className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50">
                      {signaturePreview ? 'Change' : 'Upload'} Signature
                    </span>
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const formData = new FormData();
                      formData.append('file', file);
                      try {
                        const { data } = await settingAPI.updateWithLogo(formData);
                        const sigPath = data?.signature || data?.path || (data?.settings?.signature);
                        if (sigPath) {
                          setSignaturePreview(`/${sigPath}`);
                          update('signature', sigPath);
                        } else {
                          setSignaturePreview(URL.createObjectURL(file));
                        }
                        toast.success('Signature uploaded');
                      } catch { toast.error('Failed to upload signature'); }
                    }} />
                  </label>
                  {signaturePreview && (
                    <button onClick={() => { setSignaturePreview(''); }} className="text-xs text-red-500 hover:underline">Remove</button>
                  )}
                </div>
              </div>
            </div>
          </SettingsSection>
          <SettingsSection title="Stock Transfer Between Godowns">
            <div className="py-2">
              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                <Warehouse className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm text-[#1F2937]">Manage stock movement between multiple godowns or warehouses with transfer notes.</p>
                  <ToggleSwitch label="Enable Godown Management" checked={settings.enableGodown} onChange={v => update('enableGodown', v)} />
                </div>
              </div>
            </div>
          </SettingsSection>
        </div>
        <div className="space-y-6">
          <SettingsSection title="Backup & History">
            <ToggleSwitch label="Auto Backup" checked={settings.autoBackup} onChange={v => update('autoBackup', v)} />
            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm text-[#1F2937]">Last Backup</span>
              <span className="text-sm text-gray-400">
                {lastBackupDate
                  ? new Date(lastBackupDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : 'Never'}
              </span>
            </div>
            <ToggleSwitch label="Audit Trail" checked={settings.auditTrail} onChange={v => update('auditTrail', v)} />
          </SettingsSection>
          <SettingsSection title="Customize Your View">
            <div className="py-4 space-y-4">
              <div className="flex items-center gap-3">
                <ZoomIn className="w-5 h-5 text-gray-400" />
                <span className="text-sm font-medium text-[#1F2937]">Zoom Level</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {zoomOptions.map(z => (
                  <button key={z} onClick={() => update('zoomLevel', z)}
                    className={`py-2 text-sm font-medium rounded-md border transition-all ${
                      settings.zoomLevel === z
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-[#1F2937] border-gray-200 hover:border-blue-300'
                    }`}>
                    {z}%
                  </button>
                ))}
              </div>
              <ToggleSwitch label="Dark Mode" checked={darkMode} onChange={v => {
                setDarkMode(v);
                update('darkMode', v);
                if (v) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              }} />
            </div>
          </SettingsSection>
          <SettingsSection title="Amount Decimal Places">
            <div className="py-2">
              <SettingsSelectRow label="Decimal Places" value={settings.amountDecimalPlaces} onChange={v => update('amountDecimalPlaces', v)} options={['0', '1', '2', '3']} />
            </div>
          </SettingsSection>
        </div>
      </div>
      <div className="flex justify-end sticky bottom-0 bg-[#F5F6FA] py-3">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm">
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save General Settings'}
        </button>
      </div>
    </motion.div>
  );
};

export default GeneralTab;
