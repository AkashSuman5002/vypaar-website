import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import ToggleSwitch from './ToggleSwitch';
import SettingsSection from './SettingsSection';
import { Plus, Edit3, Trash2, Percent, Save } from 'lucide-react';
import { defaultPrefs, loadSettings, saveCategory } from '../../hooks/useSettings';

const TaxesTab = () => {
  const [settings, setSettings] = useState(defaultPrefs.taxes);
  const [saving, setSaving] = useState(false);
  const [taxRates, setTaxRates] = useState(defaultPrefs.taxes.taxRates);
  const [editingRate, setEditingRate] = useState(null);
  const [newRate, setNewRate] = useState({ igst: '', cgst: '', sgst: '', label: '' });

  useEffect(() => {
    loadSettings().then(data => {
      if (data?.preferences?.taxes) {
        setSettings({ ...defaultPrefs.taxes, ...data.preferences.taxes });
        if (data.preferences.taxes.taxRates) {
          setTaxRates(data.preferences.taxes.taxRates);
        }
      }
    });
  }, []);

  const update = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCategory('taxes', { ...settings, taxRates });
      toast.success('Tax settings saved');
    } catch { toast.error('Failed to save tax settings'); }
    finally { setSaving(false); }
  };

  const addRate = () => {
    if (!newRate.label || newRate.igst === '') { toast.error('Enter rate details'); return; }
    const igst = parseFloat(newRate.igst);
    setTaxRates(prev => [...prev, {
      igst,
      cgst: parseFloat(newRate.cgst) || igst / 2 || 0,
      sgst: parseFloat(newRate.sgst) || igst / 2 || 0,
      label: newRate.label,
    }]);
    setNewRate({ igst: '', cgst: '', sgst: '', label: '' });
  };

  const updateRate = (idx) => {
    setTaxRates(prev => prev.map((r, i) => i === idx ? { ...r, igst: parseFloat(r.igst), cgst: parseFloat(r.cgst), sgst: parseFloat(r.sgst) } : r));
    setEditingRate(null);
    toast.success('Rate updated');
  };

  const deleteRate = (idx) => {
    setTaxRates(prev => prev.filter((_, i) => i !== idx));
    toast.success('Rate deleted');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 space-y-6 overflow-y-auto max-h-full">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="space-y-6">
          <SettingsSection title="GST Settings">
            <ToggleSwitch label="Enable GST" checked={settings.enableGST} onChange={v => update('enableGST', v)} />
            <ToggleSwitch label="HSN/SAC Code" checked={settings.hsnSac} onChange={v => update('hsnSac', v)} />
            <ToggleSwitch label="Additional Cess" checked={settings.additionalCess} onChange={v => update('additionalCess', v)} />
            <ToggleSwitch label="Reverse Charge" checked={settings.reverseCharge} onChange={v => update('reverseCharge', v)} />
            <ToggleSwitch label="Place of Supply" checked={settings.placeOfSupply} onChange={v => update('placeOfSupply', v)} />
            <ToggleSwitch label="Composition Scheme" checked={settings.compositionScheme} onChange={v => update('compositionScheme', v)} />
            <ToggleSwitch label="Enable TCS" checked={settings.enableTCS} onChange={v => update('enableTCS', v)} />
            <ToggleSwitch label="Enable TDS" checked={settings.enableTDS} onChange={v => update('enableTDS', v)} />
          </SettingsSection>
          <div className="px-5">
            <button className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors">
              Tax List
            </button>
          </div>
        </div>
        <div className="space-y-6">
          <SettingsSection title="Tax Rates">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm font-medium text-[#1F2937]">Available Rates</span>
              <button onClick={() => { setEditingRate('new'); setNewRate({ igst: '', cgst: '', sgst: '', label: '' }); }}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add Rate
              </button>
            </div>
            {editingRate === 'new' && (
              <div className="p-3 bg-blue-50 rounded-lg space-y-2 mb-2">
                <input placeholder="Label (e.g. GST 10%)" value={newRate.label} onChange={e => setNewRate({ ...newRate, label: e.target.value })} className="w-full px-3 py-1.5 text-sm border rounded-md" />
                <div className="grid grid-cols-3 gap-2">
                  <input type="number" step="0.01" placeholder="IGST %" value={newRate.igst} onChange={e => setNewRate({ ...newRate, igst: e.target.value })} className="px-3 py-1.5 text-sm border rounded-md" />
                  <input type="number" step="0.01" placeholder="CGST %" value={newRate.cgst} onChange={e => setNewRate({ ...newRate, cgst: e.target.value })} className="px-3 py-1.5 text-sm border rounded-md" />
                  <input type="number" step="0.01" placeholder="SGST %" value={newRate.sgst} onChange={e => setNewRate({ ...newRate, sgst: e.target.value })} className="px-3 py-1.5 text-sm border rounded-md" />
                </div>
                <div className="flex gap-2">
                  <button onClick={addRate} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Save</button>
                  <button onClick={() => setEditingRate(null)} className="px-3 py-1.5 text-sm bg-gray-200 rounded-md hover:bg-gray-300">Cancel</button>
                </div>
              </div>
            )}
            <div className="max-h-[400px] overflow-y-auto">
              {taxRates.map((rate, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  {editingRate === i ? (
                    <div className="flex-1 mr-2 space-y-1">
                      <input value={rate.label} onChange={e => setTaxRates(prev => prev.map((r, j) => j === i ? { ...r, label: e.target.value } : r))} className="w-full px-2 py-1 text-sm border rounded" />
                      <div className="grid grid-cols-3 gap-1">
                        <input type="number" step="0.01" value={rate.igst} onChange={e => setTaxRates(prev => prev.map((r, j) => j === i ? { ...r, igst: e.target.value } : r))} className="px-2 py-1 text-xs border rounded" />
                        <input type="number" step="0.01" value={rate.cgst} onChange={e => setTaxRates(prev => prev.map((r, j) => j === i ? { ...r, cgst: e.target.value } : r))} className="px-2 py-1 text-xs border rounded" />
                        <input type="number" step="0.01" value={rate.sgst} onChange={e => setTaxRates(prev => prev.map((r, j) => j === i ? { ...r, sgst: e.target.value } : r))} className="px-2 py-1 text-xs border rounded" />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span className="text-sm text-[#1F2937]">{rate.label}</span>
                      <div className="text-xs text-gray-400 mt-0.5">IGST: {rate.igst}% | CGST: {rate.cgst}% | SGST: {rate.sgst}%</div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {editingRate === i ? (
                      <button onClick={() => updateRate(i)} className="p-1 text-blue-600 hover:text-blue-800"><Save className="w-4 h-4" /></button>
                    ) : (
                      <button onClick={() => setEditingRate(i)} className="p-1 text-gray-400 hover:text-blue-600 transition-colors"><Edit3 className="w-4 h-4" /></button>
                    )}
                    <button onClick={() => deleteRate(i)} className="p-1 text-gray-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </SettingsSection>
        </div>
      </div>
      <div className="flex justify-end sticky bottom-0 bg-[#F5F6FA] py-3">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm">
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Tax Settings'}
        </button>
      </div>
    </motion.div>
  );
};

export default TaxesTab;
