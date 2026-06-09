import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { formatCurrency } from '../../utils/format';
import ToggleSwitch from './ToggleSwitch';
import SettingsSection from './SettingsSection';
import { SettingsSelectRow, SettingsInputRow } from './SettingsRow';
import { Image, Palette, Save, Phone, Mail, MapPin, BadgePercent } from 'lucide-react';
import { defaultPrefs, loadSettings, saveCategory } from '../../hooks/useSettings';

const previewItems = [
  { name: 'Premium Notebook', qty: 5, rate: 120, gst: 12 },
  { name: 'Gel Pen Pack', qty: 10, rate: 35, gst: 5 },
  { name: 'Desk Organizer', qty: 2, rate: 450, gst: 18 },
];

const themeColors = {
  tallyTheme: { primary: '#2563EB', secondary: '#1E40AF', bg: '#EFF6FF' },
  landscapeTheme1: { primary: '#059669', secondary: '#047857', bg: '#ECFDF5' },
  landscapeTheme2: { primary: '#D97706', secondary: '#B45309', bg: '#FFFBEB' },
  gstTheme: { primary: '#7C3AED', secondary: '#6D28D9', bg: '#F5F3FF' },
};

const PrintTab = () => {
  const [settings, setSettings] = useState(defaultPrefs.print);
  const [businessSettings, setBusinessSettings] = useState({});
  const [accentColor, setAccentColor] = useState('#2563EB');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings().then(data => {
      if (data) {
        if (data.preferences?.print) {
          setSettings({ ...defaultPrefs.print, ...data.preferences.print });
        }
        setBusinessSettings(data);
        if (data.preferences?.print?.accentColor) {
          setAccentColor(data.preferences.print.accentColor);
        }
      }
    });
  }, []);

  const update = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCategory('print', { ...settings, accentColor });
      toast.success('Print settings saved');
    } catch { toast.error('Failed to save print settings'); }
    finally { setSaving(false); }
  };

  const isThermal = settings.printerType === 'thermal';
  const activeThemeKey = Object.keys(themeColors).find(k => settings[k]);
  const activeColor = activeThemeKey ? themeColors[activeThemeKey] : null;
  const previewColor = activeColor ? activeColor.primary : accentColor;

  const themes = [
    { key: 'tallyTheme', label: 'Tally Theme', color: 'bg-blue-600', active: settings.tallyTheme },
    { key: 'landscapeTheme1', label: 'Landscape Theme 1', color: 'bg-emerald-600', active: settings.landscapeTheme1 },
    { key: 'landscapeTheme2', label: 'Landscape Theme 2', color: 'bg-amber-600', active: settings.landscapeTheme2 },
    { key: 'gstTheme', label: 'GST Theme', color: 'bg-purple-600', active: settings.gstTheme },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 h-full flex flex-col overflow-hidden">
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {['regular', 'thermal'].map(type => (
          <button key={type} onClick={() => update('printerType', type)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all capitalize ${
              settings.printerType === type ? 'bg-white text-[#1F2937] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {type} Printer
          </button>
        ))}
      </div>

      <div className="flex gap-6 flex-1 overflow-hidden">
        <div className="w-[400px] min-w-[400px] overflow-y-auto space-y-6 pr-2">
          <SettingsSection title="Print Settings">
            <ToggleSwitch label="Balance Amount" checked={settings.balanceAmount} onChange={v => update('balanceAmount', v)} />
            <ToggleSwitch label="Current Balance" checked={settings.currentBalance} onChange={v => update('currentBalance', v)} />
            <ToggleSwitch label="Tax Details" checked={settings.taxDetails} onChange={v => update('taxDetails', v)} />
            <ToggleSwitch label="You Saved" checked={settings.youSaved} onChange={v => update('youSaved', v)} />
            <ToggleSwitch label="Print Amount with Grouping" checked={settings.printAmountWithGrouping} onChange={v => update('printAmountWithGrouping', v)} />
            <ToggleSwitch label="Amount in Words" checked={settings.amountInWords} onChange={v => update('amountInWords', v)} />
          </SettingsSection>
          <SettingsSection title="Footer Settings">
            <ToggleSwitch label="Print Description" checked={settings.printDescription} onChange={v => update('printDescription', v)} />
            <ToggleSwitch label="Terms & Conditions" checked={settings.termsConditions} onChange={v => update('termsConditions', v)} />
            <ToggleSwitch label="Received By" checked={settings.receivedBy} onChange={v => update('receivedBy', v)} />
            <ToggleSwitch label="Delivered By" checked={settings.deliveredBy} onChange={v => update('deliveredBy', v)} />
            <ToggleSwitch label="Signature" checked={settings.signature} onChange={v => update('signature', v)} />
            <ToggleSwitch label="Payment Mode" checked={settings.paymentMode} onChange={v => update('paymentMode', v)} />
            <ToggleSwitch label="Acknowledgement" checked={settings.acknowledgement} onChange={v => update('acknowledgement', v)} />
          </SettingsSection>
          <SettingsSection title="Page Setup">
            <SettingsSelectRow label="Paper Size" value={settings.paperSize} onChange={v => update('paperSize', v)} options={['A4', 'A5', 'Letter', 'Legal']} />
            <SettingsSelectRow label="Orientation" value={settings.orientation} onChange={v => update('orientation', v)} options={['Portrait', 'Landscape']} />
            <SettingsInputRow label="Company Name Text Size" value={settings.companyNameTextSize} onChange={v => update('companyNameTextSize', v)} placeholder="16" suffix="px" />
            <SettingsInputRow label="Invoice Text Size" value={settings.invoiceTextSize} onChange={v => update('invoiceTextSize', v)} placeholder="14" suffix="px" />
            <SettingsSelectRow label="Print Original/Duplicate" value={settings.printOriginalDuplicate} onChange={v => update('printOriginalDuplicate', v)} options={['Original', 'Duplicate', 'Triplicate', 'Original & Duplicate']} />
            <SettingsInputRow label="Top PDF Margin" value={settings.topPDFMargin} onChange={v => update('topPDFMargin', v)} placeholder="10" suffix="mm" />
          </SettingsSection>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Image className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-[#1F2937]">Live Invoice Preview</span>
              </div>
            </div>
            <div className="p-6 flex justify-center">
              <div className={`border border-gray-200 rounded-lg bg-white shadow-sm ${isThermal ? 'w-[300px]' : ''}`} style={{ maxWidth: isThermal ? 300 : 595, minHeight: isThermal ? 'auto' : 842 }}>
                <div className={`${isThermal ? 'p-4' : 'p-6'}`} style={{ fontFamily: 'Inter, sans-serif' }}>
                  {/* Header */}
                  <div className={`flex ${isThermal ? 'flex-col text-center' : 'justify-between items-start'} pb-4`} style={{ borderBottom: `2px solid ${previewColor}` }}>
                    <div>
                      <h2 className="text-lg font-bold" style={{ color: previewColor, fontSize: `${settings.companyNameTextSize || 16}px` }}>
                        {businessSettings?.businessName || 'Your Business'}
                      </h2>
                      {businessSettings?.gstNumber && (
                        <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                          <BadgePercent className="w-3 h-3" /> GST: {businessSettings.gstNumber}
                        </p>
                      )}
                      {businessSettings?.address && (
                        <p className="text-[10px] text-gray-400 mt-1 flex items-start gap-1">
                          <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" /> {businessSettings.address}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                        {businessSettings?.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{businessSettings.phone}</span>}
                        {businessSettings?.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{businessSettings.email}</span>}
                      </div>
                    </div>
                    <div className={isThermal ? 'text-center mt-2' : 'text-right'}>
                      <h3 className="text-base font-bold" style={{ color: previewColor, fontSize: `${settings.invoiceTextSize || 14}px` }}>INVOICE</h3>
                      <p className="text-[10px] text-gray-400 mt-1">Invoice #: INV-001</p>
                      <p className="text-[10px] text-gray-400">Date: {new Date().toLocaleDateString()}</p>
                    </div>
                  </div>

                  {/* Bill To */}
                  <div className="py-3 border-b border-gray-100">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Bill To</p>
                    <p className="text-sm font-bold text-[#1F2937]">Walk-in Customer</p>
                    {settings.currentBalance && (
                      <p className="text-xs text-amber-600 mt-1">Current Balance: {formatCurrency(2500)}</p>
                    )}
                    {settings.printDescription && (
                      <p className="text-[10px] text-gray-400 mt-1 italic">Description: Sample invoice for stationery items</p>
                    )}
                  </div>

                  {/* Items Table */}
                  <div className="py-3 border-b border-gray-100">
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ background: previewColor + '15' }}>
                          <th className="p-2 text-left font-semibold text-[10px] uppercase tracking-wider" style={{ color: previewColor }}>Item</th>
                          <th className="p-2 text-right font-semibold text-[10px] uppercase tracking-wider" style={{ color: previewColor }}>Qty</th>
                          <th className="p-2 text-right font-semibold text-[10px] uppercase tracking-wider" style={{ color: previewColor }}>Rate</th>
                          {settings.taxDetails && <th className="p-2 text-right font-semibold text-[10px] uppercase tracking-wider" style={{ color: previewColor }}>GST</th>}
                          <th className="p-2 text-right font-semibold text-[10px] uppercase tracking-wider" style={{ color: previewColor }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {previewItems.map((item, idx) => {
                          const lineTotal = item.qty * item.rate;
                          const gstHalf = lineTotal * (item.gst / 100) / 2;
                          const amount = lineTotal + gstHalf + gstHalf;
                          return (
                            <tr key={idx}>
                              <td className="py-2 px-2 font-medium text-[#1F2937]">{item.name}</td>
                              <td className="py-2 px-2 text-right text-gray-500">{item.qty}</td>
                              <td className="py-2 px-2 text-right text-gray-500">{formatCurrency(item.rate)}</td>
                              {settings.taxDetails && <td className="py-2 px-2 text-right" style={{ color: previewColor }}>{item.gst}%</td>}
                              <td className="py-2 px-2 text-right font-semibold text-[#1F2937]">{formatCurrency(amount)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  <div className="py-3 border-b border-gray-100">
                    <div className="flex justify-between text-xs py-0.5">
                      <span className="text-gray-400">Subtotal</span>
                      <span className="font-medium text-[#1F2937]">{formatCurrency(previewItems.reduce((s, i) => s + i.qty * i.rate, 0))}</span>
                    </div>
                    {settings.taxDetails && (
                      <>
                        <div className="flex justify-between text-xs py-0.5">
                          <span className="text-gray-400">CGST</span>
                          <span className="font-medium" style={{ color: previewColor }}>{formatCurrency(previewItems.reduce((s, i) => s + (i.qty * i.rate * (i.gst / 100) / 2), 0))}</span>
                        </div>
                        <div className="flex justify-between text-xs py-0.5">
                          <span className="text-gray-400">SGST</span>
                          <span className="font-medium" style={{ color: previewColor }}>{formatCurrency(previewItems.reduce((s, i) => s + (i.qty * i.rate * (i.gst / 100) / 2), 0))}</span>
                        </div>
                      </>
                    )}
                    {settings.balanceAmount && (
                      <div className="flex justify-between text-xs py-0.5">
                        <span className="text-gray-400">Balance</span>
                        <span className="font-medium text-amber-600">{formatCurrency(previewItems.reduce((s, i) => s + i.qty * i.rate + (i.qty * i.rate * (i.gst / 100)), 0))}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm pt-2" style={{ borderTop: `1px solid ${previewColor}40` }}>
                      <span className="font-bold text-[#1F2937]">Grand Total</span>
                      <span className="font-bold text-base" style={{ color: previewColor }}>{formatCurrency(previewItems.reduce((s, i) => s + i.qty * i.rate + (i.qty * i.rate * (i.gst / 100)), 0))}</span>
                    </div>
                    {settings.youSaved && (
                      <div className="flex justify-between text-xs pt-1">
                        <span className="text-emerald-600 font-medium">You Saved</span>
                        <span className="text-emerald-600 font-medium">{formatCurrency(125)}</span>
                      </div>
                    )}
                  </div>

                  {/* Amount in Words */}
                  {settings.amountInWords && (
                    <p className="text-[10px] text-gray-400 italic mt-2">
                      Rupees {previewItems.reduce((s, i) => s + i.qty * i.rate + (i.qty * i.rate * (i.gst / 100)), 0).toLocaleString()} only
                    </p>
                  )}

                  {/* Footer */}
                  <div className={`mt-4 pt-3 text-[10px] text-gray-400 ${isThermal ? 'text-center' : 'flex justify-between'}`} style={{ borderTop: `1px solid ${previewColor}20` }}>
                    <div className="space-y-1">
                      {settings.termsConditions && <p>Terms & Conditions apply</p>}
                      {settings.receivedBy && <p>Received By: ________</p>}
                      {settings.deliveredBy && <p>Delivered By: ________</p>}
                    </div>
                    <div className={`space-y-1 ${isThermal ? 'mt-2' : 'text-right'}`}>
                      {settings.signature && <p>Authorized Signature</p>}
                      {settings.paymentMode && <p>Payment: Cash</p>}
                      {settings.acknowledgement && <p>Acknowledgement: Received</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <Palette className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-[#1F2937]">Theme Selection</span>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              {themes.map(theme => (
                <button key={theme.key} onClick={() => { const next = !theme.active; Object.keys(themeColors).forEach(k => update(k, false)); if (next) { update(theme.key, true); setAccentColor(themeColors[theme.key].primary); } }}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    theme.active ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                  }`}>
                  <div className={`w-8 h-8 rounded-md ${theme.color}`} />
                  <span className="text-sm font-medium text-[#1F2937]">{theme.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-[#1F2937]">Color Customizer</span>
            </div>
            <div className="p-4 grid grid-cols-6 gap-3">
              {['#2563EB', '#059669', '#D97706', '#7C3AED', '#DC2626', '#0891B2', '#4F46E5', '#65A30D'].map(color => (
                <button key={color} onClick={() => { setAccentColor(color); Object.keys(themeColors).forEach(k => update(k, false)); }}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${accentColor === color ? 'border-gray-800 scale-110' : 'border-gray-200'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-end pt-3">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm">
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Print Settings'}
        </button>
      </div>
    </motion.div>
  );
};

export default PrintTab;
