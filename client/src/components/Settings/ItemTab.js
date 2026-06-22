import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import ToggleSwitch from './ToggleSwitch';
import SettingsSection from './SettingsSection';
import { SettingsSelectRow, SettingsInputRow, SettingsButtonRow } from './SettingsRow';
import { Plus, Tag, Trash2, Check, X, Pencil, Save } from 'lucide-react';
import { defaultPrefs, loadSettings, saveCategory } from '../../hooks/useSettings';

const ItemTab = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(defaultPrefs.item);
  const [saving, setSaving] = useState(false);

  const [customFields, setCustomFields] = useState([]);
  const [newFieldName, setNewFieldName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    loadSettings().then(data => {
      if (data?.preferences?.item) {
        setSettings({ ...defaultPrefs.item, ...data.preferences.item });
        if (Array.isArray(data.preferences.item.customFieldDefs)) {
          setCustomFields(data.preferences.item.customFieldDefs);
        }
      }
    });
  }, []);

  const update = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  // Persist custom field definitions under preferences.item.customFieldDefs
  const updateCustomFields = (fields) => {
    setCustomFields(fields);
    update('customFieldDefs', fields);
  };

  const addCustomField = () => {
    const name = newFieldName.trim();
    if (!name) return;
    if (customFields.some(f => f.name.toLowerCase() === name.toLowerCase())) {
      toast.error('Field name already exists');
      return;
    }
    updateCustomFields([...customFields, { id: `f${Date.now()}`, name }]);
    setNewFieldName('');
  };

  const deleteCustomField = (id) => {
    updateCustomFields(customFields.filter(f => f.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const startEdit = (field) => {
    setEditingId(field.id);
    setEditingName(field.name);
  };

  const saveEdit = (id) => {
    const name = editingName.trim();
    if (!name) { toast.error('Field name cannot be empty'); return; }
    if (customFields.some(f => f.id !== id && f.name.toLowerCase() === name.toLowerCase())) {
      toast.error('Field name already exists');
      return;
    }
    updateCustomFields(customFields.map(f => f.id === id ? { ...f, name } : f));
    setEditingId(null);
    setEditingName('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCategory('item', { ...settings, customFieldDefs: customFields });
      toast.success('Item settings saved');
    } catch { toast.error('Failed to save item settings'); }
    finally { setSaving(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 space-y-6 overflow-y-auto max-h-full">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="space-y-6">
          <SettingsSection title="Item Settings">
            <ToggleSwitch label="Enable Item" checked={settings.enableItem} onChange={v => update('enableItem', v)} />
            <SettingsSelectRow label="Product/Service" value={settings.productService} onChange={v => update('productService', v)} options={['Product', 'Service', 'Both']} />
            <ToggleSwitch label="Barcode Scan" checked={settings.barcodeScan} onChange={v => update('barcodeScan', v)} />
            <ToggleSwitch label="Stock Maintenance" checked={settings.stockMaintenance} onChange={v => update('stockMaintenance', v)} />
            <ToggleSwitch label="Manufacturing" checked={settings.manufacturing} onChange={v => update('manufacturing', v)} />
            <ToggleSwitch label="Low Stock Dialog" checked={settings.lowStockDialog} onChange={v => update('lowStockDialog', v)} />
          </SettingsSection>
          <SettingsSection title="Item Units">
            <SettingsSelectRow label="Default Unit" value={settings.itemUnits} onChange={v => update('itemUnits', v)} options={['Piece', 'Kg', 'Liter', 'Meter', 'Box', 'Pack']} />
            <SettingsInputRow label="Unit" value={settings.unit} onChange={v => update('unit', v)} placeholder="Pcs" />
          </SettingsSection>
          <SettingsSection title="Categories">
            <ToggleSwitch label="Item Category" checked={settings.itemCategory} onChange={v => update('itemCategory', v)} />
            <SettingsButtonRow label="Manage Categories" buttonLabel="Open" buttonColor="bg-gray-500" onClick={() => navigate('/products')} />
          </SettingsSection>
        </div>
        <div className="space-y-6">
          <SettingsSection title="Pricing">
            <ToggleSwitch label="Party Wise Rate" checked={settings.partyWiseRate} onChange={v => update('partyWiseRate', v)} />
            <ToggleSwitch label="Description" checked={settings.description} onChange={v => update('description', v)} />
            <ToggleSwitch label="Item Wise Tax" checked={settings.itemWiseTax} onChange={v => update('itemWiseTax', v)} />
            <ToggleSwitch label="Item Wise Discount" checked={settings.itemWiseDiscount} onChange={v => update('itemWiseDiscount', v)} />
            <ToggleSwitch label="Update Sale Price Automatically" checked={settings.updateSalePriceAuto} onChange={v => update('updateSalePriceAuto', v)} />
          </SettingsSection>
          <SettingsSection title="Additional Item Fields">
            <ToggleSwitch label="MRP" checked={settings.mrp} onChange={v => update('mrp', v)} />
            <ToggleSwitch label="Calculate Tax on MRP" checked={settings.calculateTaxOnMRP} onChange={v => update('calculateTaxOnMRP', v)} />
            <ToggleSwitch label="Serial Number Tracking" checked={settings.serialNumberTracking} onChange={v => update('serialNumberTracking', v)} />
            <ToggleSwitch label="Batch Tracking" checked={settings.batchTracking} onChange={v => update('batchTracking', v)} />
            <ToggleSwitch label="Expiry Date" checked={settings.expiryDate} onChange={v => update('expiryDate', v)} />
            <ToggleSwitch label="Manufacturing Date" checked={settings.manufacturingDate} onChange={v => update('manufacturingDate', v)} />
            <ToggleSwitch label="Model Number" checked={settings.modelNumber} onChange={v => update('modelNumber', v)} />
            <ToggleSwitch label="Size" checked={settings.size} onChange={v => update('size', v)} />
          </SettingsSection>
        </div>
        <div className="space-y-6">
          <SettingsSection title="Item Custom Fields">
            <div className="py-2 space-y-3">
              {customFields.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 italic">No custom fields defined. Add one below.</p>
              )}
              {customFields.map(field => (
                <div key={field.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg">
                  {editingId === field.id ? (
                    <>
                      <input type="text" value={editingName} autoFocus
                        onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); saveEdit(field.id); }
                          if (e.key === 'Escape') { setEditingId(null); }
                        }}
                        className="flex-1 mr-2 px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-[#1F2937] dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => saveEdit(field.id)} title="Save"
                          className="p-1 text-green-600 hover:text-green-700 dark:hover:text-green-400 transition-colors">
                          <Check className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} title="Cancel"
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <span className="text-sm text-[#1F2937] dark:text-slate-200">{field.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => startEdit(field)} title="Edit"
                          className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => deleteCustomField(field.id)} title="Delete"
                          className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              <div className="flex items-center gap-2 pt-2">
                <input type="text" value={newFieldName} onChange={e => setNewFieldName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomField(); } }}
                  placeholder="New field name (e.g., HSN Code)"
                  className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-sm text-[#1F2937] dark:text-slate-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                <button type="button" onClick={addCustomField}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors">
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            </div>
          </SettingsSection>
        </div>
      </div>
      <div className="flex justify-end sticky bottom-0 bg-[#F5F6FA] dark:bg-gray-900 py-3">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm">
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Item Settings'}
        </button>
      </div>
    </motion.div>
  );
};

export default ItemTab;
