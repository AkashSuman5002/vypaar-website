import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { Info, Printer, Settings2, Plus, Trash2 } from 'lucide-react';
import { productAPI, barcodeLabelAPI } from '../../services/api';

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

  useEffect(() => {
    productAPI.getAll().then(r => {
      setProducts(r.data.products || r.data || []);
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

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">Barcode Generator <Info className="w-5 h-5 text-slate-400" /></h1>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <Printer className="w-4 h-4" /> Label Printer | Size 2 Labels (50x25mm)
          <button onClick={() => toast.info('Label size: 50x25mm | Printer: Label Printer | Configure from Settings > Print')} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"><Settings2 className="w-4 h-4 text-slate-500" /></button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-soft p-6">
          <h2 className="text-base font-bold text-slate-900 mb-5">Enter item details to add for barcode</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Item Name *</label>
              <select value={selectedItemId} onChange={(e) => { setSelectedItemId(e.target.value); const p = products.find(x => x._id === e.target.value); setItemCode(p?.sku || ''); }} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm">
                <option value="">Enter Item Name</option>
                {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Item Code *</label>
              <input type="text" value={itemCode} onChange={(e) => setItemCode(e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" placeholder="Enter Item Code" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">No of Labels *</label>
              <input type="number" value={noOfLabels} onChange={(e) => setNoOfLabels(e.target.value)} min="1" className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Header</label>
              <input type="text" value={header} onChange={(e) => setHeader(e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" placeholder="Enter Header" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Line 1</label>
              <input type="text" value={line1} onChange={(e) => setLine1(e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" placeholder="Enter Line 1" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Line 2</label><input type="text" value={line2} onChange={(e) => setLine2(e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" placeholder="Line 2" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Line 3</label><input type="text" value={line3} onChange={(e) => setLine3(e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" placeholder="Line 3" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Line 4</label><input type="text" value={line4} onChange={(e) => setLine4(e.target.value)} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm" placeholder="Line 4" /></div>
          </div>
          <button onClick={handleAddItem} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"><Plus className="w-4 h-4" /> Add for Barcode</button>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-6">
          <h3 className="text-sm font-bold text-slate-900 mb-4 text-center">Preview</h3>
          <div className="border border-slate-200 rounded-xl p-6 bg-slate-50/50 flex flex-col items-center">
            <p className="text-xs font-semibold text-slate-700 mb-2">{header || 'Header'}</p>
            <div className="w-40 h-12 bg-slate-200 rounded flex items-center justify-center mb-2 overflow-hidden">
              <svg viewBox="0 0 120 40" className="w-full h-full">
                {Array.from({ length: 40 }, (_, i) => <rect key={i} x={i * 3} y={0} width={i % 3 === 0 ? 2 : 1} height={40} fill="#1e293b" />)}
              </svg>
            </div>
            <p className="text-[10px] text-slate-500 mb-1">{itemCode || selectedItem?.sku || 'Item Code'}</p>
            {line1 && <p className="text-[10px] text-slate-500">{line1}</p>}
            {line2 && <p className="text-[10px] text-slate-500">{line2}</p>}
            {line3 && <p className="text-[10px] text-slate-500">{line3}</p>}
            {line4 && <p className="text-[10px] text-slate-500">{line4}</p>}
          </div>
        </div>
      </div>
      <div className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-soft overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200"><h3 className="text-base font-bold text-slate-900">Item Details</h3></div>
        <table className="w-full">
          <thead><tr className="bg-slate-50 border-b border-slate-200">
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 w-10"><input type="checkbox" className="rounded border-slate-300" /></th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Item Name</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Labels</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Header</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Line 1</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Line 2</th>
            <th className="px-4 py-3 w-10"></th>
          </tr></thead>
          <tbody>
            {barcodeItems.length === 0 ? (
              <tr><td colSpan="7" className="px-6 py-16 text-center text-sm text-slate-400">Added items for Barcode generation will appear here.</td></tr>
            ) : barcodeItems.map((item) => (
              <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3"><input type="checkbox" className="rounded border-slate-300" /></td>
                <td className="px-4 py-3 text-sm font-medium text-slate-900">{item.itemName}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{item.noOfLabels}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{item.header || '---'}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{item.line1 || '---'}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{item.line2 || '---'}</td>
                <td className="px-4 py-3"><button onClick={() => handleRemoveItem(item.id)} className="p-1 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button></td>
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
            className="px-5 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">Preview</button>
        <button onClick={handleGenerate} disabled={submitting || barcodeItems.length === 0} className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2">
          {submitting ? 'Generating...' : 'Generate'}
        </button>
      </div>
    </motion.div>
  );
};

export default BarcodeGenerator;
