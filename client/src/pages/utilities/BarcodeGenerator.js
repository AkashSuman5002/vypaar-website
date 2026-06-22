import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { Info, Printer, Settings2, Plus, Trash2 } from 'lucide-react';
import { productAPI, barcodeLabelAPI } from '../../services/api';

// Canonical Code 128 module patterns (values 0..106). Mirrors the server-side
// generator so the preview matches the printed PDF and is genuinely scannable.
const CODE128_PATTERNS = [
  '11011001100','11001101100','11001100110','10010011000','10010001100','10001001100',
  '10011001000','10011000100','10001100100','11001001000','11001000100','11000100100',
  '10110011100','10011011100','10011001110','10111001100','10011101100','10011100110',
  '11001110010','11001011100','11001001110','11011100100','11001110100','11101101110',
  '11101001100','11100101100','11100100110','11101100100','11100110100','11100110010',
  '11011011000','11011000110','11000110110','10100011000','10001011000','10001000110',
  '10110001000','10001101000','10001100010','11010001000','11000101000','11000100010',
  '10110111000','10110001110','10001101110','10111011000','10111000110','10001110110',
  '11101110110','11010001110','11000101110','11011101000','11011100010','11011101110',
  '11101011000','11101000110','11100010110','11101101000','11101100010','11100011010',
  '11101111010','11001000010','11110001010','10100110000','10100001100','10010110000',
  '10010000110','10000101100','10000100110','10110010000','10110000100','10011010000',
  '10011000010','10000110100','10000110010','11000010010','11001010000','11110111010',
  '11000010100','10001111010','10100111100','10010111100','10010011110','10111100100',
  '10011110100','10011110010','11110100100','11110010100','11110010010','11011011110',
  '11011110110','11110110110','10101111000','10100011110','10001011110','10111101000',
  '10111100010','11110101000','11110100010','10111011110','10111101110','11101011110',
  '11110101110','11010000100','11010010000','11010011100','1100011101011'
];
const CODE128_START_B = 104;
const CODE128_STOP = 106;

function encodeCode128B(text) {
  if (!text) text = '000000000000';
  const values = [];
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code < 32 || code > 126) code = 32;
    values.push(code - 32);
  }
  let checksum = CODE128_START_B;
  for (let i = 0; i < values.length; i++) checksum += values[i] * (i + 1);
  checksum = checksum % 103;
  let bits = CODE128_PATTERNS[CODE128_START_B];
  for (const v of values) bits += CODE128_PATTERNS[v];
  bits += CODE128_PATTERNS[checksum];
  bits += CODE128_PATTERNS[CODE128_STOP];
  return bits;
}

const BarcodeGenerator = () => {
  const [products, setProducts] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [noOfLabels, setNoOfLabels] = useState('1');
  const [header, setHeader] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [line3, setLine3] = useState('');
  const [line4, setLine4] = useState('');
  const [barcodeItems, setBarcodeItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    productAPI.getAll().then(r => {
      setProducts(r.data?.data || []);
    }).catch(() => toast.error('Failed to load items'))
      .finally(() => setLoading(false));
  }, []);

  const selectedItem = products.find(p => p._id === selectedItemId);

  const handleAddItem = () => {
    if (!selectedItemId) { toast.error('Please select an item'); return; }
    if (!noOfLabels || parseInt(noOfLabels) < 1) { toast.error('Enter valid number of labels'); return; }
    const prod = products.find(p => p._id === selectedItemId);
    setBarcodeItems(prev => [...prev, {
      id: Date.now(), itemName: prod.name, itemId: prod._id,
      itemCode: itemCode || prod.sku || '', noOfLabels: parseInt(noOfLabels),
      header, line1, line2, line3, line4,
    }]);
    toast.success('Item added for barcode generation');
    setSelectedItemId(''); setItemCode(''); setNoOfLabels('1');
    setHeader(''); setLine1(''); setLine2(''); setLine3(''); setLine4('');
  };

  const handleRemoveItem = (id) => setBarcodeItems(prev => prev.filter(i => i.id !== id));

  const handleGenerate = async () => {
    if (barcodeItems.length === 0) { toast.error('Add items first'); return; }
    setSubmitting(true);
    try {
      const res = await barcodeLabelAPI.generate({
        labels: barcodeItems.map(item => ({
          productId: item.itemId,
          itemName: item.itemName,
          itemCode: item.itemCode,
          quantity: item.noOfLabels,
          header: item.header, line1: item.line1, line2: item.line2, line3: item.line3, line4: item.line4,
        })),
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = 'barcode-labels.pdf';
      a.click(); window.URL.revokeObjectURL(url);
      toast.success('Barcodes generated successfully!');
      setBarcodeItems([]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate barcodes');
    } finally { setSubmitting(false); }
  };

  const PreviewBarcode = ({ code }) => {
    // Render a REAL Code 128 Set B barcode (matches the backend PDF output) so the
    // preview reflects what actually prints and is itself scannable.
    const pattern = encodeCode128B(String(code || '000000000000').replace(/[^\x20-\x7E]/g, '').slice(0, 30));
    const moduleW = 1;
    const quiet = 10;
    const totalModules = pattern.length + quiet * 2;
    const width = totalModules * moduleW;
    const height = 40;
    const bars = [];
    let i = 0;
    while (i < pattern.length) {
      if (pattern[i] === '1') {
        let run = 1;
        while (i + run < pattern.length && pattern[i + run] === '1') run++;
        bars.push(
          <rect key={i} x={(quiet + i) * moduleW} y={0} width={run * moduleW} height={height} fill="#1e293b" />
        );
        i += run;
      } else {
        i++;
      }
    }
    return (
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-full">
        <rect x={0} y={0} width={width} height={height} fill="#ffffff" />
        {bars}
      </svg>
    );
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-[#F8FAFC] flex items-center gap-2">Barcode Generator <Info className="w-5 h-5 text-slate-400 dark:text-[#64748B]" /></h1>
        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-[#94A3B8]">
          <Printer className="w-4 h-4" /> Label Printer | Size 2 Labels (50x25mm)
          <button onClick={() => navigate('/settings?tab=print')} className="p-2 rounded-lg border border-slate-200 dark:border-[#334155] hover:bg-slate-50 dark:hover:bg-[#1E293B]/70 transition-colors"><Settings2 className="w-4 h-4 text-slate-500 dark:text-[#64748B]" /></button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-[#334155] shadow-soft p-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-[#F8FAFC] mb-5">Enter item details to add for barcode</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-[#E2E8F0] mb-1">Item Name *</label>
              <select value={selectedItemId} onChange={(e) => { setSelectedItemId(e.target.value); const p = products.find(x => x._id === e.target.value); setItemCode(p?.sku || ''); }} className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-[#334155] rounded-lg bg-white dark:bg-[#1E293B] text-slate-900 dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm">
                <option value="">Enter Item Name</option>
                {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-[#E2E8F0] mb-1">Item Code *</label>
              <input type="text" value={itemCode} onChange={(e) => setItemCode(e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-[#334155] rounded-lg bg-white dark:bg-[#1E293B] text-slate-900 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" placeholder="Enter Item Code" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-[#E2E8F0] mb-1">No of Labels *</label>
              <input type="number" value={noOfLabels} onChange={(e) => setNoOfLabels(e.target.value)} min="1" className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-[#334155] rounded-lg bg-white dark:bg-[#1E293B] text-slate-900 dark:text-[#F8FAFC] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-[#E2E8F0] mb-1">Header</label>
              <input type="text" value={header} onChange={(e) => setHeader(e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-[#334155] rounded-lg bg-white dark:bg-[#1E293B] text-slate-900 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" placeholder="Enter Header" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-[#E2E8F0] mb-1">Line 1</label>
              <input type="text" value={line1} onChange={(e) => setLine1(e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-[#334155] rounded-lg bg-white dark:bg-[#1E293B] text-slate-900 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" placeholder="Enter Line 1" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div><label className="block text-sm font-medium text-slate-700 dark:text-[#E2E8F0] mb-1">Line 2</label><input type="text" value={line2} onChange={(e) => setLine2(e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-[#334155] rounded-lg bg-white dark:bg-[#1E293B] text-slate-900 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" placeholder="Line 2" /></div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-[#E2E8F0] mb-1">Line 3</label><input type="text" value={line3} onChange={(e) => setLine3(e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-[#334155] rounded-lg bg-white dark:bg-[#1E293B] text-slate-900 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" placeholder="Line 3" /></div>
            <div><label className="block text-sm font-medium text-slate-700 dark:text-[#E2E8F0] mb-1">Line 4</label><input type="text" value={line4} onChange={(e) => setLine4(e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-[#334155] rounded-lg bg-white dark:bg-[#1E293B] text-slate-900 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" placeholder="Line 4" /></div>
          </div>
          <button onClick={handleAddItem} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"><Plus className="w-4 h-4" /> Add for Barcode</button>
        </div>
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-[#334155] shadow-soft p-6">
          <h3 className="text-sm font-bold text-slate-900 dark:text-[#F8FAFC] mb-4 text-center">Preview</h3>
          <div className="border border-slate-200 dark:border-[#334155] rounded-xl p-6 bg-slate-50/50 dark:bg-[#0F172A]/40 flex flex-col items-center">
            <p className="text-xs font-semibold text-slate-700 dark:text-[#E2E8F0] mb-2">{header || 'Header'}</p>
            <div className="w-48 h-12 bg-white dark:bg-[#1E293B] rounded flex items-center justify-center mb-2 overflow-hidden border border-slate-200 dark:border-[#334155]">
              <PreviewBarcode code={itemCode || selectedItem?.sku || '123456789012'} />
            </div>
            <p className="text-[10px] text-slate-500 dark:text-[#64748B] mb-1">{itemCode || selectedItem?.sku || 'Item Code'}</p>
            {line1 && <p className="text-[10px] text-slate-500 dark:text-[#64748B]">{line1}</p>}
            {line2 && <p className="text-[10px] text-slate-500 dark:text-[#64748B]">{line2}</p>}
            {line3 && <p className="text-[10px] text-slate-500 dark:text-[#64748B]">{line3}</p>}
            {line4 && <p className="text-[10px] text-slate-500 dark:text-[#64748B]">{line4}</p>}
          </div>
        </div>
      </div>
      <div className="mt-6 bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-[#334155] shadow-soft overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#334155]"><h3 className="text-base font-bold text-slate-900 dark:text-[#F8FAFC]">Item Details</h3></div>
        <table className="w-full">
          <thead><tr className="bg-slate-50 dark:bg-[#111827] border-b border-slate-200 dark:border-[#334155]">
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-[#64748B] w-10"><input type="checkbox" className="rounded border-slate-300 dark:border-[#334155]" /></th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-[#64748B]">Item Name</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-[#64748B]">Labels</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-[#64748B]">Header</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-[#64748B]">Line 1</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-[#64748B]">Line 2</th>
            <th className="px-4 py-3 w-10"></th>
          </tr></thead>
          <tbody>
            {barcodeItems.length === 0 ? (
              <tr><td colSpan="7" className="px-6 py-16 text-center text-sm text-slate-400 dark:text-[#64748B]">Added items for Barcode generation will appear here.</td></tr>
            ) : barcodeItems.map((item) => (
              <tr key={item.id} className="border-b border-slate-100 dark:border-[#334155] hover:bg-slate-50/50 dark:hover:bg-[#1E293B]/70 transition-colors">
                <td className="px-4 py-3"><input type="checkbox" className="rounded border-slate-300 dark:border-[#334155]" /></td>
                <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-[#F8FAFC]">{item.itemName}</td>
                <td className="px-4 py-3 text-sm text-slate-500 dark:text-[#64748B]">{item.noOfLabels}</td>
                <td className="px-4 py-3 text-sm text-slate-500 dark:text-[#64748B]">{item.header || '---'}</td>
                <td className="px-4 py-3 text-sm text-slate-500 dark:text-[#64748B]">{item.line1 || '---'}</td>
                <td className="px-4 py-3 text-sm text-slate-500 dark:text-[#64748B]">{item.line2 || '---'}</td>
                <td className="px-4 py-3"><button onClick={() => handleRemoveItem(item.id)} className="p-1 text-slate-400 dark:text-[#64748B] hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between items-center mt-6">
          <button onClick={() => {
              if (barcodeItems.length === 0) return toast.info('Add items first to preview');
              const previewWindow = window.open('', '_blank');
              const itemsHtml = barcodeItems.map(item => `
                <div style="border:1px solid #ddd;padding:12px;margin:8px;display:inline-block;width:200px;text-align:center;font-family:Arial,sans-serif">
                  <div style="font-weight:bold;font-size:14px;margin-bottom:4px">${item.header || item.itemName}</div>
                  <div style="font-size:12px;color:#666;margin-bottom:2px">${item.itemName}</div>
                  <div style="font-size:11px;color:#888">Code: ${item.itemCode || 'N/A'}</div>
                  <div style="font-size:11px;color:#888">Labels: ${item.noOfLabels}</div>
                  ${item.line1 ? `<div style="font-size:10px;color:#999">${item.line1}</div>` : ''}
                  ${item.line2 ? `<div style="font-size:10px;color:#999">${item.line2}</div>` : ''}
                  <div style="margin-top:8px;font-size:20px;letter-spacing:2px">||||| |||| ||| |||| |||||</div>
                </div>
              `).join('');
              previewWindow.document.write(`<html><head><title>Barcode Preview</title></head><body style="padding:20px"><h2>Barcode Label Preview</h2><p>${barcodeItems.length} item(s), ${barcodeItems.reduce((s,i) => s + (parseInt(i.noOfLabels)||1), 0)} total labels</p><div>${itemsHtml}</div></body></html>`);
              previewWindow.document.close();
            }}
            className="px-5 py-2.5 border border-slate-200 dark:border-[#334155] text-slate-600 dark:text-[#94A3B8] text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-[#1E293B]/70 transition-colors">Preview</button>
        <button onClick={handleGenerate} disabled={submitting || barcodeItems.length === 0} className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2">
          {submitting ? 'Generating...' : 'Generate'}
        </button>
      </div>
    </motion.div>
  );
};

export default BarcodeGenerator;
