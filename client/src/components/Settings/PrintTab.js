import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { Save, ChevronRight, Download } from 'lucide-react';
import { defaultPrefs, loadSettings, saveCategory } from '../../hooks/useSettings';

const previewItems = [
  { name: 'Brittania Choclate Cake(12345678)', qty: 100, rate: 100, gst: 0, unit: 'Box', desc: 'Brittania Choclate Cake description', batch: 'N1234', model: 'A12345', exp: '06/2027', mfg: '10/06/2026', size: 'Med/32', hsn: '12345678', mrp: 100 },
  { name: 'Cadbury Chocolate(34567890)', qty: 50, rate: 150, gst: 0, unit: 'Pac', desc: 'Cadbury cake description', batch: 'N5678', model: 'B67890', exp: '06/2027', mfg: '10/06/2026', size: 'Med/32', hsn: '34567890', mrp: 150 },
];

const thermalThemes = [
  { key: 'thermalTheme1', label: 'Theme 1' },
  { key: 'thermalTheme2', label: 'Theme 2' },
  { key: 'thermalTheme3', label: 'Theme 3' },
  { key: 'thermalTheme4', label: 'Theme 4' },
];

const regularThemeKeys = ['tallyTheme', 'landscapeTheme1', 'landscapeTheme2', 'gstTheme'];

const themeColors = {
  tallyTheme: { primary: '#2563EB', secondary: '#1E40AF', bg: '#EFF6FF' },
  landscapeTheme1: { primary: '#059669', secondary: '#047857', bg: '#ECFDF5' },
  landscapeTheme2: { primary: '#D97706', secondary: '#B45309', bg: '#FFFBEB' },
  gstTheme: { primary: '#7C3AED', secondary: '#6D28D9', bg: '#F5F3FF' },
  thermalTheme1: { primary: '#000000', secondary: '#333333', bg: '#FFFFFF' },
  thermalTheme2: { primary: '#1a5276', secondary: '#2e86c1', bg: '#EBF5FB' },
  thermalTheme3: { primary: '#000000', secondary: '#555555', bg: '#F8F9FA' },
  thermalTheme4: { primary: '#1B4332', secondary: '#2D6A4F', bg: '#F0FFF4' },
};

const SectionHeader = ({ title }) => (
  <div className="py-3 border-b border-gray-200">
    <h3 className="text-sm font-bold text-[#1F2937]">{title}</h3>
  </div>
);

const CheckboxRow = ({ label, checked, onChange, info }) => (
  <div className="flex items-center justify-between py-2.5">
    <div className="flex items-center gap-3">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer" />
      <span className="text-sm text-[#1F2937]">{label}</span>
    </div>
    {info && <span className="text-xs text-gray-400 cursor-help" title={info}>ⓘ</span>}
  </div>
);

const InputRow = ({ label, value, onChange, placeholder, type = 'text', suffix, info }) => (
  <div className="flex items-center justify-between py-2.5">
    <div className="flex items-center gap-2">
      <span className="text-sm text-[#1F2937]">{label}</span>
      {info && <span className="text-xs text-gray-400 cursor-help" title={info}>ⓘ</span>}
    </div>
    <div className="flex items-center gap-2">
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-20 px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white text-[#1F2937] text-center" />
      {suffix && <span className="text-xs text-gray-400">{suffix}</span>}
    </div>
  </div>
);

const SelectRow = ({ label, value, onChange, options, info }) => (
  <div className="flex items-center justify-between py-2.5">
    <div className="flex items-center gap-2">
      <span className="text-sm text-[#1F2937]">{label}</span>
      {info && <span className="text-xs text-gray-400 cursor-help" title={info}>ⓘ</span>}
    </div>
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-40 px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-[#1F2937]">
      {options.map(opt => (
        <option key={typeof opt === 'string' ? opt : opt.value} value={typeof opt === 'string' ? opt : opt.value}>
          {typeof opt === 'string' ? opt : opt.label}
        </option>
      ))}
    </select>
  </div>
);

const PrintTab = () => {
  const [settings, setSettings] = useState(defaultPrefs.print);
  const [businessSettings, setBusinessSettings] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings().then(data => {
      if (data) {
        if (data.preferences?.print) {
          setSettings(prev => ({ ...prev, ...data.preferences.print }));
        }
        setBusinessSettings(data);
      }
    });
  }, []);

  const update = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCategory('print', settings);
      toast.success('Print settings saved');
    } catch { toast.error('Failed to save print settings'); }
    finally { setSaving(false); }
  };

  const isThermal = settings.printerType === 'thermal';
  const activeThemeKey = isThermal
    ? (settings.thermalTheme1 ? 'thermalTheme1' : settings.thermalTheme2 ? 'thermalTheme2' : settings.thermalTheme3 ? 'thermalTheme3' : settings.thermalTheme4 ? 'thermalTheme4' : 'thermalTheme1')
    : Object.keys(themeColors).find(k => regularThemeKeys.includes(k) && settings[k]) || 'gstTheme';
  const selectThermalTheme = (key) => {
    ['thermalTheme1', 'thermalTheme2', 'thermalTheme3', 'thermalTheme4'].forEach(k => update(k, false));
    update(key, true);
  };

  const selectRegularTheme = (key) => {
    regularThemeKeys.forEach(k => update(k, false));
    update(key, true);
  };

  const previewColor = isThermal
    ? themeColors[activeThemeKey]?.primary || '#000000'
    : (settings.accentColor && !regularThemeKeys.some(k => settings[k])) ? settings.accentColor : (themeColors[activeThemeKey]?.primary || settings.accentColor || '#000000');

  const fmtAmt = (val) => {
    const num = Number(val) || 0;
    const decimals = settings.showAmountDecimal !== false ? 2 : 0;
    if (settings.printAmountWithGrouping === false) return num.toFixed(decimals);
    return num.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const thermalPageSizeMap = { '2inch': '58mm', '3inch': '68mm', '4inch': '88mm' };
  const thermalPageWidth = settings.thermalPageSize === '2inch' ? 200 : settings.thermalPageSize === '4inch' ? 300 : settings.thermalPageSize === 'custom' ? (parseInt(settings.thermalCustomChars) || 48) * 5 : 250;

  const renderThermalPreview = () => {
    const totalQty = previewItems.reduce((s, i) => s + i.qty, 0);
    const totalAmount = previewItems.reduce((s, i) => s + i.qty * i.rate, 0);
    const isTheme1 = activeThemeKey === 'thermalTheme1';
    const isTheme2 = activeThemeKey === 'thermalTheme2';
    const isTheme3 = activeThemeKey === 'thermalTheme3';
    const isTheme4 = activeThemeKey === 'thermalTheme4';
    const showMRP = (isTheme3 || isTheme4) && settings.showItemMRP;
    const showHSN = settings.showItemHSN !== false;
    const showSNo = settings.showItemSNo !== false;
    const showUOM = settings.showItemUOM !== false;
    const today = new Date().toLocaleDateString('en-IN');

    return (
      <div className="bg-white border border-gray-200 shadow-sm rounded-lg overflow-hidden" style={{ width: thermalPageWidth, fontFamily: 'Courier New, monospace', fontSize: '10px' }}>
        {/* HEADER */}
        <div className="p-3 text-center" style={{ borderBottom: `2px dashed ${previewColor}` }}>
          {settings.showCompanyLogo && businessSettings?.logo && <div className="mb-1 text-[8px] text-gray-400">[Logo]</div>}
          {settings.showCompanyName && <div className="font-bold text-xs" style={{ color: previewColor }}>{businessSettings?.businessName || 'AKash'}</div>}
          {settings.showPhone && <div className="text-[9px] text-gray-500">Ph.No.: {businessSettings?.phone || '7878650749'}</div>}
          {settings.showAddress && businessSettings?.address && <div className="text-[9px] text-gray-500">{businessSettings.address}</div>}
          {settings.showEmail && businessSettings?.email && <div className="text-[9px] text-gray-500">{businessSettings.email}</div>}
          {settings.showGSTIN && businessSettings?.gstNumber && <div className="text-[9px] text-gray-500">GSTIN: {businessSettings.gstNumber}</div>}
        </div>

        {/* INVOICE INFO - differs by theme */}
        <div className="p-3 text-center" style={{ borderBottom: `1px dashed ${previewColor}` }}>
          <div className="font-bold text-[10px]" style={{ color: previewColor }}>Tax Invoice</div>
          {(isTheme1 || isTheme2) && (
            <div className="flex justify-end gap-4 text-[9px] text-gray-500 mt-1">
              <span>Date: {today}</span>
              <span>Invoice No.: Inv12345</span>
            </div>
          )}
          {isTheme3 && (
            <div className="flex justify-between text-[9px] text-gray-500 mt-1">
              <span>Date: {today}</span>
              <span>Invoice No.: Inv12345</span>
            </div>
          )}
          {isTheme4 && (
            <div className="flex justify-between text-[9px] text-gray-500 mt-1">
              <span>Invoice No.: Inv12345</span>
              <span>Date: {today}</span>
            </div>
          )}
        </div>

        {/* BILL TO */}
        <div className="p-3" style={{ borderBottom: `1px dashed ${previewColor}` }}>
          <div className="text-[9px] text-gray-600">
            <div className="font-semibold text-[10px]" style={{ color: previewColor }}>{businessSettings?.businessName || 'Vyapar tech solutions'} (Sample Party Name)</div>
            <div>Ph. No.: {businessSettings?.phone || '+91-9333911911, +91-6364444752'}</div>
            <div className="mt-1"><span className="font-semibold">Bill To:</span></div>
            <div>Sarjapur Road, Bangalore</div>
            <div><span className="font-semibold">Place of Supply:</span></div>
            <div>Karnataka</div>
          </div>
        </div>

        {/* ITEM TABLE */}
        <div className="p-3" style={{ borderBottom: `1px dashed ${previewColor}` }}>
          {/* Table Header */}
          <div className="text-[9px] font-bold flex" style={{ color: previewColor, borderBottom: `1px solid ${previewColor}`, paddingBottom: '2px' }}>
            {showSNo && <span className="w-6">#</span>}
            <span className="flex-1">{(isTheme1 || isTheme2) ? (showHSN ? 'Name(HSN)' : 'Name') : (showHSN ? 'Item Name(HSN)' : 'Item Name')}</span>
            <span className="w-10 text-right">Qty</span>
            {showMRP && <span className="w-12 text-right">MRP</span>}
            <span className="w-12 text-right">Price</span>
            <span className="w-14 text-right">Amount</span>
          </div>

          {/* Per-Item Rows */}
          {previewItems.map((item, idx) => (
            <div key={idx} className="text-[9px] py-1" style={{ borderBottom: idx < previewItems.length - 1 ? '1px dotted #ddd' : 'none' }}>
              {/* Theme 2: Compact - name, qty, price, amount, desc, HSN/MRP line only */}
              {isTheme2 && (
                <>
                  <div className="flex">
                    {showSNo && <span className="w-6">{idx + 1}</span>}
                    <span className={`${showSNo ? 'flex-1' : ''} font-medium`}>{item.name}</span>
                  </div>
                  <div className="flex text-gray-500 ml-6">
                    <span>{item.qty}{showUOM ? ` + 0${item.unit}` : ''}</span>
                    <span className="w-12 text-right">{fmtAmt(item.rate)}</span>
                    <span className="w-14 text-right font-medium">{fmtAmt(item.qty * item.rate)}</span>
                  </div>
                  {settings.showItemDescription && <div className="ml-6 text-[8px] text-gray-400 italic">{item.desc}</div>}
                  {showHSN && <div className="ml-6 text-[8px] text-gray-400">HSN: {item.hsn}, MRP: {fmtAmt(item.mrp)}</div>}
                </>
              )}

              {/* Theme 1: Name (no MRP col), desc, HSN/MRP line, Disc/Tax/Final breakdown */}
              {isTheme1 && (
                <>
                  <div className="flex">
                    {showSNo && <span className="w-6">{idx + 1}</span>}
                    <span className={`${showSNo ? 'flex-1' : ''} font-medium`}>{item.name}</span>
                  </div>
                  <div className="flex text-gray-500 ml-6">
                    <span>{item.qty}{showUOM ? ` + 0${item.unit}` : ''}</span>
                    <span className="w-12 text-right">{fmtAmt(item.rate)}</span>
                    <span className="w-14 text-right font-medium">{fmtAmt(item.qty * item.rate)}</span>
                  </div>
                  {settings.showItemDescription && <div className="ml-6 text-[8px] text-gray-400 italic">{item.desc}</div>}
                  {showHSN && <div className="ml-6 text-[8px] text-gray-400">HSN: {item.hsn}, MRP: {fmtAmt(item.mrp)}</div>}
                  <div className="flex justify-end text-[8px] text-gray-500 mt-0.5">
                    <span>Disc.(1%)&nbsp;&nbsp;&nbsp;:</span>
                    <span className="w-14 text-right">-{fmtAmt(item.qty * item.rate * 0.01)}</span>
                  </div>
                  <div className="flex justify-end text-[8px] text-gray-500">
                    <span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:</span>
                    <span className="w-14 text-right">{fmtAmt(item.qty * item.rate * 0.05)}</span>
                  </div>
                  <div className="flex justify-end text-[8px] font-medium mt-0.5">
                    <span>Final amount&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:</span>
                    <span className="w-14 text-right">{fmtAmt(item.qty * item.rate)}</span>
                  </div>
                </>
              )}

              {/* Theme 3 & 4: Item Name(HSN) with MRP col, batch/model/exp/mfg/size details, Disc/Tax/Final */}
              {(isTheme3 || isTheme4) && (
                <>
                  <div className="flex">
                    {showSNo && <span className="w-6">{idx + 1}</span>}
                    <span className={`${showSNo ? 'flex-1' : ''} font-medium`}>{item.name}</span>
                  </div>
                  <div className="flex text-gray-500 ml-6">
                    <span>{item.qty}{showUOM ? ` + 0${item.unit}` : ''}</span>
                    {showMRP && <span className="w-12 text-right">{fmtAmt(item.mrp)}</span>}
                    <span className="w-12 text-right">{fmtAmt(item.rate)}</span>
                    <span className="w-14 text-right font-medium">{fmtAmt(item.qty * item.rate)}</span>
                  </div>
                  {settings.showItemDescription && <div className="ml-6 text-[8px] text-gray-400 italic">{item.desc}</div>}
                  <div className="ml-6 text-[8px] text-gray-400">
                    {settings.showBatchNo && `Batch No.: ${item.batch}, `}
                    {settings.showModelNo && `Model No.: ${item.model}, `}
                    {settings.showExpDate && `Exp. Date: ${item.exp}, `}
                    {settings.showMfgDate && `Mfg. Date: ${item.mfg}, `}
                    {settings.showSize && `Size: ${item.size}`}
                  </div>
                  <div className="flex justify-end text-[8px] text-gray-500 mt-0.5">
                    <span>Disc.(1%)&nbsp;&nbsp;&nbsp;:</span>
                    <span className="w-14 text-right">-{fmtAmt(item.qty * item.rate * 0.01)}</span>
                  </div>
                  <div className="flex justify-end text-[8px] text-gray-500">
                    <span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:</span>
                    <span className="w-14 text-right">{fmtAmt(item.qty * item.rate * 0.05)}</span>
                  </div>
                  <div className="flex justify-end text-[8px] font-medium mt-0.5">
                    <span>Final amount&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:</span>
                    <span className="w-14 text-right">{fmtAmt(item.qty * item.rate)}</span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* TOTALS - Theme 2 has different structure */}
        <div className="p-3" style={{ borderBottom: `1px dashed ${previewColor}` }}>
          {isTheme2 ? (
            <>
              <div className="flex justify-between text-[9px] font-bold">
                <span>Total</span>
                <span>{fmtAmt(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-[9px] text-gray-500 mt-1">
                <span>Sub Total</span>
                <span>{fmtAmt(17475)}</span>
              </div>
              <div className="flex justify-between text-[9px] text-gray-500">
                <span>Disc.</span>
                <span>-{fmtAmt(850)}</span>
              </div>
              {settings.taxDetails && (
                <div className="flex justify-between text-[9px] text-gray-500">
                  <span>Disc.(0%)&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:</span>
                  <span>-{fmtAmt(500)}</span>
                </div>
              )}
              <div className="flex justify-between text-[9px] text-gray-500">
                <span>Total Disc.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:</span>
                <span>-{fmtAmt(1350)}</span>
              </div>
              {settings.youSaved && (
                <div className="flex justify-between text-[9px] text-emerald-600">
                  <span>You Saved</span>
                  <span>{fmtAmt(125)}</span>
                </div>
              )}
              <div className="flex justify-between text-[10px] font-bold mt-1" style={{ color: previewColor, borderTop: `1px solid ${previewColor}`, paddingTop: '4px' }}>
                <span>Total</span>
                <span>{fmtAmt(20000)}</span>
              </div>
              {settings.receivedAmount && (
                <div className="flex justify-between text-[9px] text-gray-500 mt-1">
                  <span>Received</span><span>{fmtAmt(20000)}</span>
                </div>
              )}
              {settings.balanceAmount && (
                <div className="flex justify-between text-[9px] text-gray-500">
                  <span>Balance</span><span>{fmtAmt(0)}</span>
                </div>
              )}
              {settings.currentBalance && (
                <div className="flex justify-between text-[9px] text-gray-500">
                  <span>Current Balance</span><span>{fmtAmt(2500)}</span>
                </div>
              )}
            </>
          ) : (
            <>
              {settings.showTotalItemQty && (
                <div className="flex justify-between text-[9px] font-bold">
                  <span>Qty: {totalQty} + {previewItems.length}</span>
                  <span>{fmtAmt(totalAmount)}</span>
                </div>
              )}
              {settings.taxDetails && (
                <>
                  <div className="flex justify-between text-[9px] text-gray-500 mt-1">
                    <span>Disc.(0%)&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:</span>
                    <span>-{fmtAmt(500)}</span>
                  </div>
                  <div className="flex justify-between text-[9px] text-gray-500">
                    <span>Tax(0%)&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:</span>
                    <span>{fmtAmt(500)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-[9px] text-gray-500">
                <span>Total Disc.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:</span>
                <span>-{fmtAmt(1550)}</span>
              </div>
              {settings.youSaved && (
                <div className="flex justify-between text-[9px] text-emerald-600">
                  <span>You Saved</span>
                  <span>{fmtAmt(125)}</span>
                </div>
              )}
              <div className="flex justify-between text-[10px] font-bold mt-1" style={{ color: previewColor, borderTop: `1px solid ${previewColor}`, paddingTop: '4px' }}>
                <span>Total</span><span>{fmtAmt(20000)}</span>
              </div>
              {settings.receivedAmount && (
                <div className="flex justify-between text-[9px] text-gray-500 mt-1">
                  <span>Received</span><span>{fmtAmt(20000)}</span>
                </div>
              )}
              {settings.balanceAmount && (
                <div className="flex justify-between text-[9px] text-gray-500">
                  <span>Balance</span><span>{fmtAmt(0)}</span>
                </div>
              )}
              {settings.currentBalance && (
                <div className="flex justify-between text-[9px] text-gray-500">
                  <span>Current Balance</span><span>{fmtAmt(2500)}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* FOOTER */}
        {settings.amountInWords && (
          <div className="p-3 text-center text-[8px] text-gray-400 italic" style={{ borderBottom: `1px dashed ${previewColor}` }}>
            {settings.amountInWordsFormat === 'International' ? `Total: ₹${fmtAmt(20000)}` : 'Balance to be paid in 3 days'}
          </div>
        )}
        {settings.printDescription && (
          <div className="p-3 text-center text-[8px] text-gray-400" style={{ borderBottom: `1px dashed ${previewColor}` }}>
            Thank you for your business!
          </div>
        )}
        {settings.termsConditions && (
          <div className="p-2 text-center text-[7px] text-gray-400">Terms & Conditions apply</div>
        )}
        {Array.from({ length: parseInt(settings.extraLinesAtEnd) || 0 }).map((_, i) => (
          <div key={i} className="h-3">&nbsp;</div>
        ))}
      </div>
    );
  };

  const renderRegularPreview = () => {
    const totalQty = previewItems.reduce((s, i) => s + i.qty, 0);
    const totalAmount = previewItems.reduce((s, i) => s + i.qty * i.rate, 0);
    const isLandscape = settings.orientation === 'Landscape';
    const paperDims = { A4: { w: 595, h: 842 }, A5: { w: 420, h: 595 }, Letter: { w: 612, h: 792 }, Legal: { w: 612, h: 1008 } };
    const base = paperDims[settings.paperSize] || paperDims.A4;
    const pw = isLandscape ? base.h : base.w;
    const ph = isLandscape ? base.w : base.h;
    const topMargin = parseInt(settings.topPDFMargin) || 10;

    return (
      <div className="bg-white border border-gray-200 shadow-sm rounded-lg overflow-hidden mx-auto" style={{ width: pw, minHeight: ph, fontFamily: 'Inter, sans-serif' }}>
        <div className="p-6" style={{ paddingTop: `${topMargin * 3}px` }}>
          <div className="flex justify-between items-start pb-4" style={{ borderBottom: `2px solid ${previewColor}` }}>
            <div>
              <h2 className="text-lg font-bold" style={{ color: previewColor, fontSize: `${settings.companyNameTextSize || 16}px` }}>
                {businessSettings?.businessName || 'Your Business'}
              </h2>
              {businessSettings?.gstNumber && (
                <p className="text-[10px] text-gray-400 mt-0.5">GST: {businessSettings.gstNumber}</p>
              )}
              {businessSettings?.address && (
                <p className="text-[10px] text-gray-400 mt-1">{businessSettings.address}</p>
              )}
              <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                {businessSettings?.phone && <span>Phone: {businessSettings.phone}</span>}
                {businessSettings?.email && <span>Email: {businessSettings.email}</span>}
              </div>
            </div>
            <div className="text-right">
              <h3 className="text-base font-bold" style={{ color: previewColor, fontSize: `${settings.invoiceTextSize || 14}px` }}>INVOICE</h3>
              {settings.printOriginalDuplicate && settings.printOriginalDuplicate !== 'Original' && (
                <p className="text-[10px] text-gray-400 mt-0.5 font-semibold uppercase">{settings.printOriginalDuplicate}</p>
              )}
              <p className="text-[10px] text-gray-400 mt-1">Invoice #: INV-001</p>
              <p className="text-[10px] text-gray-400">Date: {new Date().toLocaleDateString()}</p>
            </div>
          </div>

          <div className="py-3 border-b border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Bill To</p>
            <p className="text-sm font-bold text-[#1F2937]">Walk-in Customer</p>
            {settings.currentBalance && (
              <p className="text-xs text-amber-600 mt-1">Current Balance: {fmtAmt(2500)}</p>
            )}
          </div>

          <div className="py-3 border-b border-gray-100">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: previewColor + '15' }}>
                  {settings.showItemSNo && <th className="p-2 text-left font-semibold text-[10px]" style={{ color: previewColor }}>#</th>}
                  <th className="p-2 text-left font-semibold text-[10px]" style={{ color: previewColor }}>Item</th>
                  {settings.showItemHSN && <th className="p-2 text-right font-semibold text-[10px]" style={{ color: previewColor }}>HSN</th>}
                  {settings.showItemUOM && <th className="p-2 text-right font-semibold text-[10px]" style={{ color: previewColor }}>UOM</th>}
                  {settings.showItemMRP && <th className="p-2 text-right font-semibold text-[10px]" style={{ color: previewColor }}>MRP</th>}
                  <th className="p-2 text-right font-semibold text-[10px]" style={{ color: previewColor }}>Qty</th>
                  <th className="p-2 text-right font-semibold text-[10px]" style={{ color: previewColor }}>Rate</th>
                  {settings.taxDetails && <th className="p-2 text-right font-semibold text-[10px]" style={{ color: previewColor }}>GST</th>}
                  <th className="p-2 text-right font-semibold text-[10px]" style={{ color: previewColor }}>Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {previewItems.map((item, idx) => {
                  const lineTotal = item.qty * item.rate;
                  return (
                    <tr key={idx}>
                      {settings.showItemSNo && <td className="py-2 px-2 text-gray-500">{idx + 1}</td>}
                      <td className="py-2 px-2 font-medium text-[#1F2937]">
                        {item.name}
                        {settings.showItemDescription && <div className="text-[10px] text-gray-400 italic">{item.desc}</div>}
                        {(settings.showBatchNo || settings.showExpDate || settings.showMfgDate || settings.showModelNo || settings.showSize) && (
                          <div className="text-[9px] text-gray-400 mt-0.5">
                            {settings.showBatchNo && `Batch: ${item.batch} `}
                            {settings.showModelNo && `Model: ${item.model} `}
                            {settings.showExpDate && `Exp: ${item.exp} `}
                            {settings.showMfgDate && `Mfg: ${item.mfg} `}
                            {settings.showSize && `Size: ${item.size}`}
                          </div>
                        )}
                      </td>
                      {settings.showItemHSN && <td className="py-2 px-2 text-right text-gray-500">{item.hsn}</td>}
                      {settings.showItemUOM && <td className="py-2 px-2 text-right text-gray-500">{item.unit}</td>}
                      {settings.showItemMRP && <td className="py-2 px-2 text-right text-gray-500">{fmtAmt(item.mrp)}</td>}
                      <td className="py-2 px-2 text-right text-gray-500">{item.qty}</td>
                      <td className="py-2 px-2 text-right text-gray-500">{fmtAmt(item.rate)}</td>
                      {settings.taxDetails && <td className="py-2 px-2 text-right" style={{ color: previewColor }}>{item.gst}%</td>}
                      <td className="py-2 px-2 text-right font-semibold text-[#1F2937]">{fmtAmt(lineTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="py-3 border-b border-gray-100">
            {settings.showTotalItemQty && (
              <div className="flex justify-between text-xs py-0.5">
                <span className="text-gray-400">Total Qty</span>
                <span className="font-medium text-[#1F2937]">{totalQty}</span>
              </div>
            )}
            <div className="flex justify-between text-xs py-0.5">
              <span className="text-gray-400">Subtotal</span>
              <span className="font-medium text-[#1F2937]">{fmtAmt(totalAmount)}</span>
            </div>
            {settings.taxDetails && (
              <>
                <div className="flex justify-between text-xs py-0.5">
                  <span className="text-gray-400">CGST</span>
                  <span className="font-medium" style={{ color: previewColor }}>{fmtAmt(0)}</span>
                </div>
                <div className="flex justify-between text-xs py-0.5">
                  <span className="text-gray-400">SGST</span>
                  <span className="font-medium" style={{ color: previewColor }}>{fmtAmt(0)}</span>
                </div>
              </>
            )}
            {settings.receivedAmount && (
              <div className="flex justify-between text-xs py-0.5">
                <span className="text-gray-400">Received</span>
                <span className="font-medium text-[#1F2937]">{fmtAmt(totalAmount)}</span>
              </div>
            )}
            {settings.balanceAmount && (
              <div className="flex justify-between text-xs py-0.5">
                <span className="text-gray-400">Balance</span>
                <span className="font-medium text-amber-600">{fmtAmt(0)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm pt-2" style={{ borderTop: `1px solid ${previewColor}40` }}>
              <span className="font-bold text-[#1F2937]">Grand Total</span>
              <span className="font-bold text-base" style={{ color: previewColor }}>{fmtAmt(totalAmount)}</span>
            </div>
            {settings.youSaved && (
              <div className="flex justify-between text-xs pt-1">
                <span className="text-emerald-600 font-medium">You Saved</span>
                <span className="text-emerald-600 font-medium">{fmtAmt(125)}</span>
              </div>
            )}
          </div>

          {settings.amountInWords && (
            <p className="text-[10px] text-gray-400 italic mt-2">
              {settings.amountInWordsFormat === 'International'
                ? `Total: $${fmtAmt(totalAmount)}`
                : `Rupees ${Math.floor(totalAmount).toLocaleString('en-IN')} only`}
            </p>
          )}

          <div className="mt-4 pt-3 text-[10px] text-gray-400 flex justify-between" style={{ borderTop: `1px solid ${previewColor}20` }}>
            <div className="space-y-1">
              {settings.termsConditions && <p>Terms & Conditions apply</p>}
              {settings.receivedBy && <p>Received By: ________</p>}
              {settings.deliveredBy && <p>Delivered By: ________</p>}
            </div>
            <div className="space-y-1 text-right">
              {settings.signature && <p>Authorized Signature</p>}
              {settings.paymentMode && <p>Payment: Cash</p>}
              {settings.acknowledgement && <p>Acknowledgement: Received</p>}
            </div>
          </div>
        </div>
      </div>
    );
  };

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
        <div className="w-[420px] min-w-[420px] overflow-y-auto space-y-4 pr-2">

          {isThermal && (
            <>
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <SectionHeader title="Print Company Info / Header" />
                <div className="px-5 py-2">
                  <CheckboxRow label="Company Name" checked={settings.showCompanyName} onChange={v => update('showCompanyName', v)} />
                  {settings.showCompanyName && (
                    <div className="ml-7 mb-2">
                      <input type="text" value={businessSettings?.businessName || ''} readOnly
                        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-gray-50 text-[#1F2937]" />
                    </div>
                  )}
                  <CheckboxRow label="Company Logo" checked={settings.showCompanyLogo} onChange={v => update('showCompanyLogo', v)}
                    info="Upload logo in General Settings" />
                  <div className="ml-7 mb-2">
                    <span className="text-xs text-blue-600 cursor-pointer hover:underline">(Change)</span>
                  </div>
                  <CheckboxRow label="Address" checked={settings.showAddress} onChange={v => update('showAddress', v)} />
                  {settings.showAddress && (
                    <div className="ml-7 mb-2">
                      <input type="text" value={businessSettings?.address || ''} readOnly
                        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-gray-50 text-[#1F2937]" />
                    </div>
                  )}
                  <CheckboxRow label="Email" checked={settings.showEmail} onChange={v => update('showEmail', v)} />
                  {settings.showEmail && (
                    <div className="ml-7 mb-2">
                      <input type="text" value={businessSettings?.email || ''} readOnly
                        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-gray-50 text-[#1F2937]" />
                    </div>
                  )}
                  <CheckboxRow label="Phone Number" checked={settings.showPhone} onChange={v => update('showPhone', v)} />
                  {settings.showPhone && (
                    <div className="ml-7 mb-2">
                      <input type="text" value={businessSettings?.phone || ''} readOnly
                        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-gray-50 text-[#1F2937]" />
                    </div>
                  )}
                  <CheckboxRow label="GSTIN on Sale" checked={settings.showGSTIN} onChange={v => update('showGSTIN', v)} />
                  {settings.showGSTIN && (
                    <div className="ml-7 mb-2">
                      <input type="text" value={businessSettings?.gstNumber || ''} readOnly
                        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-gray-50 text-[#1F2937]" />
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-200">
                  <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Change Layout</span>
                </div>
                <div className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    {/* Theme 1: Name, Qty, Price, Amount - with per-item Disc/Tax/Final */}
                    <button onClick={() => selectThermalTheme('thermalTheme1')}
                      className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                        settings.thermalTheme1 ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                      <div className="w-20 h-28 border border-gray-200 rounded bg-white p-1.5 flex flex-col text-[5px] leading-tight overflow-hidden">
                        <div className="text-center font-bold text-[6px] mb-0.5" style={{ color: '#000000' }}>Header</div>
                        <div className="h-px bg-gray-300 mb-0.5"></div>
                        <div className="flex font-bold text-[5px]" style={{ color: '#000000' }}>
                          <span className="w-3">#</span><span className="flex-1">Name</span><span className="w-4 text-right">Qty</span><span className="w-5 text-right">Price</span><span className="w-5 text-right">Amt</span>
                        </div>
                        <div className="h-px bg-gray-200 mb-0.5"></div>
                        <div className="flex text-gray-600"><span className="w-3">1</span><span className="flex-1 truncate">Item A</span><span className="w-4 text-right">10</span><span className="w-5 text-right">100</span><span className="w-5 text-right">1000</span></div>
                        <div className="flex text-gray-400 text-[4px]"><span className="w-3"></span><span className="flex-1">HSN:1234 MRP:120</span></div>
                        <div className="flex text-gray-400 text-[4px] justify-end"><span>Disc(1%):-10</span></div>
                        <div className="flex text-gray-400 text-[4px] justify-end"><span>Final:1000</span></div>
                        <div className="flex text-gray-600"><span className="w-3">2</span><span className="flex-1 truncate">Item B</span><span className="w-4 text-right">5</span><span className="w-5 text-right">200</span><span className="w-5 text-right">1000</span></div>
                        <div className="h-px bg-gray-200 my-0.5"></div>
                        <div className="flex text-gray-400 text-[4px] justify-end"><span>Disc(0%):-50</span></div>
                        <div className="flex text-gray-400 text-[4px] justify-end"><span>Tax(0%):50</span></div>
                        <div className="flex font-bold text-[5px] mt-auto" style={{ color: '#000000' }}><span>Total</span><span className="ml-auto">2000</span></div>
                      </div>
                      <span className="text-[10px] text-gray-500">Theme 1</span>
                    </button>

                    {/* Theme 2: Name, Qty, Price, Amount - compact, Sub Total / Disc breakdown */}
                    <button onClick={() => selectThermalTheme('thermalTheme2')}
                      className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                        settings.thermalTheme2 ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                      <div className="w-20 h-28 border border-gray-200 rounded bg-white p-1.5 flex flex-col text-[5px] leading-tight overflow-hidden">
                        <div className="text-center font-bold text-[6px] mb-0.5" style={{ color: '#1a5276' }}>Header</div>
                        <div className="h-px bg-gray-300 mb-0.5"></div>
                        <div className="flex font-bold text-[5px]" style={{ color: '#1a5276' }}>
                          <span className="w-3">#</span><span className="flex-1">Name</span><span className="w-4 text-right">Qty</span><span className="w-5 text-right">Price</span><span className="w-5 text-right">Amt</span>
                        </div>
                        <div className="h-px bg-gray-200 mb-0.5"></div>
                        <div className="flex text-gray-600"><span className="w-3">1</span><span className="flex-1 truncate">Item A</span><span className="w-4 text-right">10</span><span className="w-5 text-right">100</span><span className="w-5 text-right">1000</span></div>
                        <div className="flex text-gray-400 text-[4px]"><span className="w-3"></span><span className="flex-1">HSN:1234 MRP:120</span></div>
                        <div className="flex text-gray-600"><span className="w-3">2</span><span className="flex-1 truncate">Item B</span><span className="w-4 text-right">5</span><span className="w-5 text-right">200</span><span className="w-5 text-right">1000</span></div>
                        <div className="h-px bg-gray-200 my-0.5"></div>
                        <div className="flex text-gray-400 text-[4px]"><span>Total</span><span className="ml-auto">2000</span></div>
                        <div className="flex text-gray-400 text-[4px]"><span>Sub Total</span><span className="ml-auto">1950</span></div>
                        <div className="flex text-gray-400 text-[4px]"><span>Disc.</span><span className="ml-auto">-50</span></div>
                        <div className="flex font-bold text-[5px] mt-auto" style={{ color: '#1a5276' }}><span>Total</span><span className="ml-auto">2000</span></div>
                      </div>
                      <span className="text-[10px] text-gray-500">Theme 2</span>
                    </button>

                    {/* Theme 3: Item Name(HSN), Qty, MRP, Price, Amount - Date on left, Inv on right */}
                    <button onClick={() => selectThermalTheme('thermalTheme3')}
                      className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                        settings.thermalTheme3 ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                      <div className="w-20 h-28 border border-gray-200 rounded bg-white p-1.5 flex flex-col text-[5px] leading-tight overflow-hidden">
                        <div className="text-center font-bold text-[6px] mb-0.5" style={{ color: '#000000' }}>Header</div>
                        <div className="flex justify-between text-[4px] text-gray-400 mb-0.5"><span>Date</span><span>Inv</span></div>
                        <div className="h-px bg-gray-300 mb-0.5"></div>
                        <div className="flex font-bold text-[5px]" style={{ color: '#000000' }}>
                          <span className="w-3">#</span><span className="flex-1">Item(HSN)</span><span className="w-3 text-right">Qty</span><span className="w-4 text-right">MRP</span><span className="w-5 text-right">Amt</span>
                        </div>
                        <div className="h-px bg-gray-200 mb-0.5"></div>
                        <div className="flex text-gray-600"><span className="w-3">1</span><span className="flex-1 truncate">Item A</span><span className="w-3 text-right">10</span><span className="w-4 text-right">120</span><span className="w-5 text-right">1000</span></div>
                        <div className="flex text-gray-400 text-[4px]"><span className="w-3"></span><span className="flex-1">Batch:N1 Exp:06/27</span></div>
                        <div className="flex text-gray-400 text-[4px] justify-end"><span>Disc:-10 Final:1000</span></div>
                        <div className="flex text-gray-600"><span className="w-3">2</span><span className="flex-1 truncate">Item B</span><span className="w-3 text-right">5</span><span className="w-4 text-right">200</span><span className="w-5 text-right">1000</span></div>
                        <div className="h-px bg-gray-200 my-0.5"></div>
                        <div className="flex text-gray-400 text-[4px] justify-end"><span>Disc:-50 Tax:50</span></div>
                        <div className="flex font-bold text-[5px] mt-auto" style={{ color: '#000000' }}><span>Total</span><span className="ml-auto">2000</span></div>
                      </div>
                      <span className="text-[10px] text-gray-500">Theme 3</span>
                    </button>

                    {/* Theme 4: Item Name(HSN), Qty, MRP, Price, Amount - Inv on left, Date on right */}
                    <button onClick={() => selectThermalTheme('thermalTheme4')}
                      className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                        settings.thermalTheme4 ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                      <div className="w-20 h-28 border border-gray-200 rounded bg-white p-1.5 flex flex-col text-[5px] leading-tight overflow-hidden">
                        <div className="text-center font-bold text-[6px] mb-0.5" style={{ color: '#1B4332' }}>Header</div>
                        <div className="flex justify-between text-[4px] text-gray-400 mb-0.5"><span>Inv</span><span>Date</span></div>
                        <div className="h-px bg-gray-300 mb-0.5"></div>
                        <div className="flex font-bold text-[5px]" style={{ color: '#1B4332' }}>
                          <span className="w-3">#</span><span className="flex-1">Item(HSN)</span><span className="w-3 text-right">Qty</span><span className="w-4 text-right">MRP</span><span className="w-5 text-right">Amt</span>
                        </div>
                        <div className="h-px bg-gray-200 mb-0.5"></div>
                        <div className="flex text-gray-600"><span className="w-3">1</span><span className="flex-1 truncate">Item A</span><span className="w-3 text-right">10</span><span className="w-4 text-right">120</span><span className="w-5 text-right">1000</span></div>
                        <div className="flex text-gray-400 text-[4px]"><span className="w-3"></span><span className="flex-1">Batch:N1 Exp:06/27</span></div>
                        <div className="flex text-gray-400 text-[4px] justify-end"><span>Disc:-10 Final:1000</span></div>
                        <div className="flex text-gray-600"><span className="w-3">2</span><span className="flex-1 truncate">Item B</span><span className="w-3 text-right">5</span><span className="w-4 text-right">200</span><span className="w-5 text-right">1000</span></div>
                        <div className="h-px bg-gray-200 my-0.5"></div>
                        <div className="flex text-gray-400 text-[4px] justify-end"><span>Disc:-50 Tax:50</span></div>
                        <div className="flex font-bold text-[5px] mt-auto" style={{ color: '#1B4332' }}><span>Total</span><span className="ml-auto">2000</span></div>
                      </div>
                      <span className="text-[10px] text-gray-500">Theme 4</span>
                    </button>

                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-5 py-2">
                  <CheckboxRow label="Make Thermal Printer Default" checked={settings.makeThermalDefault} onChange={v => update('makeThermalDefault', v)} />
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-5 py-2">
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-[#1F2937]">Page Size</span>
                    <div className="flex items-center gap-0">
                      {[
                        { key: '2inch', label: '2 Inch', sub: '58mm' },
                        { key: '3inch', label: '3 Inch', sub: '68mm' },
                        { key: '4inch', label: '4 Inch', sub: '88mm' },
                        { key: 'custom', label: 'Custom', sub: '(Chars)' },
                      ].map((size, idx) => (
                        <button key={size.key} onClick={() => update('thermalPageSize', size.key)}
                          className={`px-3 py-2 text-center border transition-all ${
                            idx === 0 ? 'rounded-l-lg' : idx === 3 ? 'rounded-r-lg' : ''
                          } ${
                            settings.thermalPageSize === size.key
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                          }`}>
                          <div className="text-xs font-medium">{size.label}</div>
                          <div className="text-[9px] opacity-75">{size.sub}</div>
                        </button>
                      ))}
                      {settings.thermalPageSize === 'custom' && (
                        <input type="number" value={settings.thermalCustomChars} onChange={e => update('thermalCustomChars', e.target.value)}
                          className="w-16 ml-2 px-2 py-1 text-sm border border-gray-200 rounded-md text-center focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-5 py-2">
                  <SelectRow label="Printing Type" value={settings.printingType} onChange={v => update('printingType', v)}
                    options={['Text Printing', 'Image Printing']} />
                  <CheckboxRow label="Use Text Styling(Bold)" checked={settings.useTextStyling} onChange={v => update('useTextStyling', v)} />
                  <CheckboxRow label="Auto Cut Paper After Printing" checked={settings.autoCutPaper} onChange={v => update('autoCutPaper', v)} />
                  <CheckboxRow label="Open Cash Drawer After Printing" checked={settings.openCashDrawer} onChange={v => update('openCashDrawer', v)} />
                  <InputRow label="Extra lines at the end" value={settings.extraLinesAtEnd} onChange={v => update('extraLinesAtEnd', v)} placeholder="0" type="number" />
                  <InputRow label="Number of copies" value={settings.numberOfCopies} onChange={v => update('numberOfCopies', v)} placeholder="1" type="number" />
                </div>
              </div>
            </>
          )}

          {!isThermal && (
            <>
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <SectionHeader title="Print Settings" />
                <div className="px-5 py-2">
                  <CheckboxRow label="Balance Amount" checked={settings.balanceAmount} onChange={v => update('balanceAmount', v)} />
                  <CheckboxRow label="Current Balance of Party" checked={settings.currentBalance} onChange={v => update('currentBalance', v)} />
                  <CheckboxRow label="Tax Details" checked={settings.taxDetails} onChange={v => update('taxDetails', v)} />
                  <CheckboxRow label="You Saved" checked={settings.youSaved} onChange={v => update('youSaved', v)} />
                  <CheckboxRow label="Print Amount with Grouping" checked={settings.printAmountWithGrouping} onChange={v => update('printAmountWithGrouping', v)} />
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-[#1F2937]">Amount in Words</span>
                    <select value={settings.amountInWordsFormat} onChange={e => update('amountInWordsFormat', e.target.value)}
                      className="w-32 px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-[#1F2937]">
                      <option value="Indian">Indian</option>
                      <option value="International">International</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <SectionHeader title="Footer Settings" />
                <div className="px-5 py-2">
                  <CheckboxRow label="Print Description" checked={settings.printDescription} onChange={v => update('printDescription', v)} />
                  <CheckboxRow label="Print Terms and Conditions" checked={settings.termsConditions} onChange={v => update('termsConditions', v)} />
                  <CheckboxRow label="Received By" checked={settings.receivedBy} onChange={v => update('receivedBy', v)} />
                  <CheckboxRow label="Delivered By" checked={settings.deliveredBy} onChange={v => update('deliveredBy', v)} />
                  <CheckboxRow label="Signature" checked={settings.signature} onChange={v => update('signature', v)} />
                  <CheckboxRow label="Payment Mode" checked={settings.paymentMode} onChange={v => update('paymentMode', v)} />
                  <CheckboxRow label="Acknowledgement" checked={settings.acknowledgement} onChange={v => update('acknowledgement', v)} />
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <SectionHeader title="Page Setup" />
                <div className="px-5 py-2">
                  <SelectRow label="Paper Size" value={settings.paperSize} onChange={v => update('paperSize', v)} options={['A4', 'A5', 'Letter', 'Legal']} />
                  <SelectRow label="Orientation" value={settings.orientation} onChange={v => update('orientation', v)} options={['Portrait', 'Landscape']} />
                  <InputRow label="Company Name Text Size" value={settings.companyNameTextSize} onChange={v => update('companyNameTextSize', v)} placeholder="16" suffix="px" />
                  <InputRow label="Invoice Text Size" value={settings.invoiceTextSize} onChange={v => update('invoiceTextSize', v)} placeholder="14" suffix="px" />
                  <SelectRow label="Print Original/Duplicate" value={settings.printOriginalDuplicate} onChange={v => update('printOriginalDuplicate', v)} options={['Original', 'Duplicate', 'Triplicate', 'Original & Duplicate']} />
                  <InputRow label="Top PDF Margin" value={settings.topPDFMargin} onChange={v => update('topPDFMargin', v)} placeholder="10" suffix="mm" />
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-200">
                  <span className="text-sm font-semibold text-[#1F2937]">Theme Selection</span>
                </div>
                <div className="px-5 py-4 grid grid-cols-2 gap-3">
                  {/* Tally Theme: Portrait, clean header, blue accent */}
                  <button onClick={() => selectRegularTheme('tallyTheme')}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                      settings.tallyTheme ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                    }`}>
                    <div className="w-24 h-32 border border-gray-200 rounded bg-white p-1.5 flex flex-col text-[5px] leading-tight overflow-hidden">
                      <div className="text-center font-bold text-[6px] text-blue-600 border-b border-blue-200 pb-0.5 mb-0.5">INVOICE</div>
                      <div className="flex justify-between text-[4px] text-gray-400 mb-0.5"><span>Inv:001</span><span>Date</span></div>
                      <div className="flex font-bold text-[5px] text-blue-600 border-b border-gray-200 pb-0.5 mb-0.5">
                        <span className="flex-1">Item</span><span className="w-4 text-right">Qty</span><span className="w-5 text-right">Rate</span><span className="w-6 text-right">Amount</span>
                      </div>
                      <div className="flex text-gray-600"><span className="flex-1 truncate">Product A</span><span className="w-4 text-right">10</span><span className="w-5 text-right">100</span><span className="w-6 text-right">1000</span></div>
                      <div className="flex text-gray-600"><span className="flex-1 truncate">Product B</span><span className="w-4 text-right">5</span><span className="w-5 text-right">200</span><span className="w-6 text-right">1000</span></div>
                      <div className="h-px bg-gray-200 my-0.5"></div>
                      <div className="flex text-gray-400 text-[4px]"><span>CGST</span><span className="ml-auto">180</span></div>
                      <div className="flex text-gray-400 text-[4px]"><span>SGST</span><span className="ml-auto">180</span></div>
                      <div className="flex font-bold text-[5px] text-blue-600 mt-auto"><span>Grand Total</span><span className="ml-auto">2360</span></div>
                    </div>
                    <span className="text-[10px] text-gray-500">Tally Theme</span>
                  </button>

                  {/* Landscape Theme 1: Wider header, green accent, landscape feel */}
                  <button onClick={() => selectRegularTheme('landscapeTheme1')}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                      settings.landscapeTheme1 ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                    }`}>
                    <div className="w-24 h-32 border border-gray-200 rounded bg-white p-1.5 flex flex-col text-[5px] leading-tight overflow-hidden">
                      <div className="flex justify-between items-center border-b border-green-200 pb-0.5 mb-0.5">
                        <div className="font-bold text-[6px] text-green-700">Business Name</div>
                        <div className="text-[4px] text-gray-400">Logo</div>
                      </div>
                      <div className="bg-green-50 text-center text-[5px] font-bold text-green-700 py-0.5 mb-0.5">TAX INVOICE</div>
                      <div className="flex justify-between text-[4px] text-gray-400 mb-0.5"><span>Bill To: Customer</span><span>Invoice #: 001</span></div>
                      <div className="flex font-bold text-[5px] text-green-700 bg-green-50 py-0.5 px-0.5 mb-0.5 rounded">
                        <span className="flex-1">Item</span><span className="w-4 text-right">Qty</span><span className="w-5 text-right">Rate</span><span className="w-6 text-right">Amt</span>
                      </div>
                      <div className="flex text-gray-600"><span className="flex-1 truncate">Product A</span><span className="w-4 text-right">10</span><span className="w-5 text-right">100</span><span className="w-6 text-right">1000</span></div>
                      <div className="flex text-gray-600"><span className="flex-1 truncate">Product B</span><span className="w-4 text-right">5</span><span className="w-5 text-right">200</span><span className="w-6 text-right">1000</span></div>
                      <div className="h-px bg-gray-200 my-0.5"></div>
                      <div className="flex font-bold text-[5px] text-green-700 mt-auto"><span>Total</span><span className="ml-auto">2360</span></div>
                    </div>
                    <span className="text-[10px] text-gray-500">Landscape Theme 1</span>
                  </button>

                  {/* Landscape Theme 2: Landscape header, amber accent, horizontal layout */}
                  <button onClick={() => selectRegularTheme('landscapeTheme2')}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                      settings.landscapeTheme2 ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                    }`}>
                    <div className="w-24 h-32 border border-gray-200 rounded bg-white p-1.5 flex flex-col text-[5px] leading-tight overflow-hidden">
                      <div className="bg-amber-50 p-0.5 rounded mb-0.5">
                        <div className="flex justify-between items-center">
                          <div className="font-bold text-[6px] text-amber-700">Business</div>
                          <div className="text-[4px] text-gray-400">Ph: 9876</div>
                        </div>
                        <div className="text-[4px] text-gray-400">Address, City - 560001</div>
                      </div>
                      <div className="text-center text-[5px] font-bold text-amber-700 my-0.5">INVOICE</div>
                      <div className="flex font-bold text-[5px] text-amber-700 border-b border-amber-200 pb-0.5 mb-0.5">
                        <span className="flex-1">Product</span><span className="w-4 text-right">Qty</span><span className="w-5 text-right">Rate</span><span className="w-6 text-right">Total</span>
                      </div>
                      <div className="flex text-gray-600"><span className="flex-1 truncate">Product A</span><span className="w-4 text-right">10</span><span className="w-5 text-right">100</span><span className="w-6 text-right">1000</span></div>
                      <div className="flex text-gray-600"><span className="flex-1 truncate">Product B</span><span className="w-4 text-right">5</span><span className="w-5 text-right">200</span><span className="w-6 text-right">1000</span></div>
                      <div className="h-px bg-gray-200 my-0.5"></div>
                      <div className="flex text-gray-400 text-[4px]"><span>Disc</span><span className="ml-auto">-100</span></div>
                      <div className="flex font-bold text-[5px] text-amber-700 mt-auto"><span>Total</span><span className="ml-auto">2260</span></div>
                    </div>
                    <span className="text-[10px] text-gray-500">Landscape Theme 2</span>
                  </button>

                  {/* GST Theme: Purple accent, GST-focused with tax breakdown */}
                  <button onClick={() => selectRegularTheme('gstTheme')}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                      settings.gstTheme ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                    }`}>
                    <div className="w-24 h-32 border border-gray-200 rounded bg-white p-1.5 flex flex-col text-[5px] leading-tight overflow-hidden">
                      <div className="text-center font-bold text-[6px] text-purple-700 border-b border-purple-200 pb-0.5 mb-0.5">TAX INVOICE</div>
                      <div className="flex justify-between text-[4px] text-gray-400 mb-0.5"><span>Inv: INV-001</span><span> Date</span></div>
                      <div className="flex font-bold text-[5px] text-purple-700 border-b border-purple-200 pb-0.5 mb-0.5">
                        <span className="flex-1">Item</span><span className="w-3 text-right">HSN</span><span className="w-4 text-right">Qty</span><span className="w-5 text-right">Rate</span><span className="w-5 text-right">GST</span><span className="w-5 text-right">Amt</span>
                      </div>
                      <div className="flex text-gray-600"><span className="flex-1 truncate">Product A</span><span className="w-3 text-right">1234</span><span className="w-4 text-right">10</span><span className="w-5 text-right">100</span><span className="w-5 text-right">18%</span><span className="w-5 text-right">1180</span></div>
                      <div className="flex text-gray-600"><span className="flex-1 truncate">Product B</span><span className="w-3 text-right">5678</span><span className="w-4 text-right">5</span><span className="w-5 text-right">200</span><span className="w-5 text-right">12%</span><span className="w-5 text-right">1120</span></div>
                      <div className="h-px bg-gray-200 my-0.5"></div>
                      <div className="flex text-gray-400 text-[4px]"><span>CGST</span><span className="ml-auto">230</span></div>
                      <div className="flex text-gray-400 text-[4px]"><span>SGST</span><span className="ml-auto">230</span></div>
                      <div className="flex font-bold text-[5px] text-purple-700 mt-auto"><span>Total</span><span className="ml-auto">2760</span></div>
                    </div>
                    <span className="text-[10px] text-gray-500">GST Theme</span>
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-200">
                  <span className="text-sm font-semibold text-[#1F2937]">Color Customizer</span>
                </div>
                <div className="px-5 py-4 grid grid-cols-6 gap-3">
                  {['#2563EB', '#059669', '#D97706', '#7C3AED', '#DC2626', '#0891B2', '#4F46E5', '#65A30D'].map(color => (
                    <button key={color} onClick={() => { update('accentColor', color); regularThemeKeys.forEach(k => update(k, false)); }}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${settings.accentColor === color ? 'border-gray-800 scale-110' : 'border-gray-200'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {isThermal && (
            <>
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <SectionHeader title="Item table" />
                <div className="px-5 py-2">
                  <CheckboxRow label="S.No" checked={settings.showItemSNo} onChange={v => update('showItemSNo', v)} />
                  <CheckboxRow label="HSN/SAC Code" checked={settings.showItemHSN} onChange={v => update('showItemHSN', v)} />
                  <CheckboxRow label="Units of Measurement" checked={settings.showItemUOM} onChange={v => update('showItemUOM', v)} />
                  <CheckboxRow label="MRP" checked={settings.showItemMRP} onChange={v => update('showItemMRP', v)} />
                  <CheckboxRow label="Description" checked={settings.showItemDescription} onChange={v => update('showItemDescription', v)} />
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <SectionHeader title="Additional Item Details" />
                <div className="px-5 py-2">
                  <CheckboxRow label="Batch No." checked={settings.showBatchNo} onChange={v => update('showBatchNo', v)} />
                  <CheckboxRow label="Exp. Date" checked={settings.showExpDate} onChange={v => update('showExpDate', v)} />
                  <CheckboxRow label="Mfg. Date" checked={settings.showMfgDate} onChange={v => update('showMfgDate', v)} />
                  <CheckboxRow label="Size" checked={settings.showSize} onChange={v => update('showSize', v)} />
                  <CheckboxRow label="Model No." checked={settings.showModelNo} onChange={v => update('showModelNo', v)} />
                  <CheckboxRow label="Serial No." checked={settings.showSerialNo} onChange={v => update('showSerialNo', v)} />
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <SectionHeader title="Totals & Taxes" />
                <div className="px-5 py-2">
                  <CheckboxRow label="Total Item Quantity" checked={settings.showTotalItemQty} onChange={v => update('showTotalItemQty', v)} />
                  <CheckboxRow label="Amount with Decimal" checked={settings.showAmountDecimal} onChange={v => update('showAmountDecimal', v)} info="e.g. 0.00" />
                  <CheckboxRow label="Received Amount" checked={settings.receivedAmount} onChange={v => update('receivedAmount', v)} />
                  <CheckboxRow label="Balance Amount" checked={settings.balanceAmount} onChange={v => update('balanceAmount', v)} />
                  <CheckboxRow label="Current Balance of Party" checked={settings.currentBalance} onChange={v => update('currentBalance', v)} />
                  <CheckboxRow label="Tax Details" checked={settings.taxDetails} onChange={v => update('taxDetails', v)} />
                  <CheckboxRow label="You Saved" checked={settings.youSaved} onChange={v => update('youSaved', v)} />
                  <CheckboxRow label="Print Amount with Grouping" checked={settings.printAmountWithGrouping} onChange={v => update('printAmountWithGrouping', v)} />
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-[#1F2937]">Amount in Words</span>
                    <select value={settings.amountInWordsFormat} onChange={e => update('amountInWordsFormat', e.target.value)}
                      className="w-32 px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-[#1F2937]">
                      <option value="Indian">Indian</option>
                      <option value="International">International</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <SectionHeader title="Footer" />
                <div className="px-5 py-2">
                  <CheckboxRow label="Print Description" checked={settings.printDescription} onChange={v => update('printDescription', v)} />
                  <CheckboxRow label="Print Terms and Conditions" checked={settings.termsConditions} onChange={v => update('termsConditions', v)} />
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <SectionHeader title="Vyapar Printer Setup" />
                <div className="px-5 py-3 space-y-2">
                  {[
                    { label: '2 Inch (VYPRTP2001)', file: 'VYPRTP2001' },
                    { label: '3 Inch (VYPRTP3001)', file: 'VYPRTP3001' },
                    { label: '2 Inch (VYPRTP2002)', file: 'VYPRTP2002' },
                  ].map(printer => (
                    <button key={printer.file}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-pink-50 border border-pink-200 rounded-lg text-pink-700 text-sm font-medium hover:bg-pink-100 transition-colors">
                      <span>{printer.label} - Quick Setup</span>
                      <Download className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <span className="text-sm font-medium text-[#1F2937]">Live Invoice Preview</span>
            </div>
            <div className="p-6 flex justify-center">
              {isThermal ? renderThermalPreview() : renderRegularPreview()}
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
