import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import ToggleSwitch from './ToggleSwitch';
import SettingsSection from './SettingsSection';
import { SettingsSelectRow, SettingsInputRow, SettingsButtonRow } from './SettingsRow';
import { Plus, Tag, Save } from 'lucide-react';
import { defaultPrefs, loadSettings, saveCategory } from '../../hooks/useSettings';

const ItemTab = () => {
  const [settings, setSettings] = useState(defaultPrefs.item);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings().then(data => {
      if (data?.preferences?.item) {
        setSettings({ ...defaultPrefs.item, ...data.preferences.item });
      }
    });
  }, []);

  const update = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCategory('item', settings);
      toast.success('Item settings saved');
    } catch { toast.error('Failed to save item settings'); }
    finally { setSaving(false); }
  };

  const [customFields] = useState([
    { id: 1, name: 'HSN Code' },
    { id: 2, name: 'Color' },
  ]);

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
            <SettingsButtonRow label="Manage Categories" buttonLabel="Open" buttonColor="bg-gray-500" />
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
              {customFields.map(field => (
                <div key={field.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-[#1F2937]">{field.name}</span>
                  </div>
                </div>
              ))}
              <button className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 py-2">
                <Plus className="w-4 h-4" /> Add Custom Fields
              </button>
            </div>
          </SettingsSection>
        </div>
      </div>
      <div className="flex justify-end sticky bottom-0 bg-[#F5F6FA] py-3">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm">
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Item Settings'}
        </button>
      </div>
    </motion.div>
  );
};

export default ItemTab;
