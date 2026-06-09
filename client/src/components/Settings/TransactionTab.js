import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import ToggleSwitch from './ToggleSwitch';
import SettingsSection from './SettingsSection';
import { SettingsInputRow, SettingsSelectRow } from './SettingsRow';
import { Save } from 'lucide-react';
import { defaultPrefs, loadSettings, saveCategory } from '../../hooks/useSettings';

const TransactionTab = () => {
  const [settings, setSettings] = useState(defaultPrefs.transaction);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings().then(data => {
      if (data?.preferences?.transaction) {
        setSettings({ ...defaultPrefs.transaction, ...data.preferences.transaction });
      }
    });
  }, []);

  const update = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCategory('transaction', settings);
      toast.success('Transaction settings saved');
    } catch { toast.error('Failed to save transaction settings'); }
    finally { setSaving(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 space-y-6 overflow-y-auto max-h-full">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="space-y-6">
          <SettingsSection title="Transaction Settings">
            <SettingsSelectRow label="Invoice/Bill No" value={settings.invoiceNo} onChange={v => update('invoiceNo', v)} options={['Auto', 'Manual']} />
            <ToggleSwitch label="Add Time on Transactions" checked={settings.addTimeOnTransactions} onChange={v => update('addTimeOnTransactions', v)} />
            <ToggleSwitch label="Cash Sale by Default" checked={settings.cashSaleByDefault} onChange={v => update('cashSaleByDefault', v)} />
            <SettingsSelectRow label="Billing Name of Parties" value={settings.billingNameOfParties} onChange={v => update('billingNameOfParties', v)} options={['Registered', 'Trading', 'Both']} />
            <ToggleSwitch label="Customer P.O. Details" checked={settings.customerPODetails} onChange={v => update('customerPODetails', v)} />
            <SettingsSelectRow label="Inclusive/Exclusive Tax" value={settings.inclusiveExclusiveTax} onChange={v => update('inclusiveExclusiveTax', v)} options={['Inclusive', 'Exclusive']} />
            <ToggleSwitch label="Display Purchase Price" checked={settings.displayPurchasePrice} onChange={v => update('displayPurchasePrice', v)} />
          </SettingsSection>
          <SettingsSection title="Price & Quantity">
            <ToggleSwitch label="Last Sale Price" checked={settings.lastSalePrice} onChange={v => update('lastSalePrice', v)} />
            <ToggleSwitch label="Last Purchase Price" checked={settings.lastPurchasePrice} onChange={v => update('lastPurchasePrice', v)} />
            <ToggleSwitch label="Free Item Quantity" checked={settings.freeItemQuantity} onChange={v => update('freeItemQuantity', v)} />
            <SettingsInputRow label="Count" value={settings.count} onChange={v => update('count', v)} placeholder="1" />
          </SettingsSection>
          <SettingsSection title="Tax & Discount">
            <ToggleSwitch label="Transaction-wise Tax" checked={settings.transactionWiseTax} onChange={v => update('transactionWiseTax', v)} />
            <ToggleSwitch label="Transaction-wise Discount" checked={settings.transactionWiseDiscount} onChange={v => update('transactionWiseDiscount', v)} />
          </SettingsSection>
        </div>
        <div className="space-y-6">
          <SettingsSection title="Rounding">
            <ToggleSwitch label="Round Off Total" checked={settings.roundOffTotal} onChange={v => update('roundOffTotal', v)} />
            <SettingsSelectRow label="Rounding Method" value={settings.roundingMethod} onChange={v => update('roundingMethod', v)} options={['Normal', 'Up', 'Down']} />
          </SettingsSection>
          <SettingsSection title="More Transaction Features">
            <ToggleSwitch label="E-Way Bill No" checked={settings.eWayBillNo} onChange={v => update('eWayBillNo', v)} />
            <ToggleSwitch label="Quick Entry" checked={settings.quickEntry} onChange={v => update('quickEntry', v)} />
            <ToggleSwitch label="Do Not Show Invoice Preview" checked={settings.doNotShowInvoicePreview} onChange={v => update('doNotShowInvoicePreview', v)} />
            <ToggleSwitch label="Passcode for Edit/Delete" checked={settings.passcodeForEditDelete} onChange={v => update('passcodeForEditDelete', v)} />
            <ToggleSwitch label="Discount During Payments" checked={settings.discountDuringPayments} onChange={v => update('discountDuringPayments', v)} />
            <ToggleSwitch label="Link Payments to Invoice" checked={settings.linkPaymentsToInvoice} onChange={v => update('linkPaymentsToInvoice', v)} />
            <ToggleSwitch label="Due Dates and Payment Terms" checked={settings.dueDatesPaymentTerms} onChange={v => update('dueDatesPaymentTerms', v)} />
            <ToggleSwitch label="Show Profit While Creating Invoice" checked={settings.showProfitWhileCreatingInvoice} onChange={v => update('showProfitWhileCreatingInvoice', v)} />
            <ToggleSwitch label="Terms & Conditions" checked={settings.termsAndConditions} onChange={v => update('termsAndConditions', v)} />
            <ToggleSwitch label="Additional Fields" checked={settings.additionalFields} onChange={v => update('additionalFields', v)} />
            <ToggleSwitch label="Transportation Details" checked={settings.transportationDetails} onChange={v => update('transportationDetails', v)} />
            <ToggleSwitch label="Additional Charges" checked={settings.additionalCharges} onChange={v => update('additionalCharges', v)} />
          </SettingsSection>
        </div>
        <div className="space-y-6">
          <SettingsSection title="Transaction Prefixes">
            <div className="space-y-1">
              <SettingsInputRow label="Sale Prefix" value={settings.salePrefix} onChange={v => update('salePrefix', v)} placeholder="SALE-" />
              <SettingsInputRow label="Credit Note Prefix" value={settings.creditNotePrefix} onChange={v => update('creditNotePrefix', v)} placeholder="CN-" />
              <SettingsInputRow label="Sale Order Prefix" value={settings.saleOrderPrefix} onChange={v => update('saleOrderPrefix', v)} placeholder="SO-" />
              <SettingsInputRow label="Purchase Order Prefix" value={settings.purchaseOrderPrefix} onChange={v => update('purchaseOrderPrefix', v)} placeholder="PO-" />
              <SettingsInputRow label="Estimate Prefix" value={settings.estimatePrefix} onChange={v => update('estimatePrefix', v)} placeholder="EST-" />
              <SettingsInputRow label="Proforma Prefix" value={settings.proformaPrefix} onChange={v => update('proformaPrefix', v)} placeholder="PRO-" />
              <SettingsInputRow label="Delivery Challan Prefix" value={settings.deliveryChallanPrefix} onChange={v => update('deliveryChallanPrefix', v)} placeholder="DC-" />
              <SettingsInputRow label="Payment In Prefix" value={settings.paymentInPrefix} onChange={v => update('paymentInPrefix', v)} placeholder="PI-" />
              <SettingsInputRow label="Receipt Prefix" value={settings.receiptPrefix} onChange={v => update('receiptPrefix', v)} placeholder="RCP-" />
            </div>
          </SettingsSection>
        </div>
      </div>
      <div className="flex justify-end sticky bottom-0 bg-[#F5F6FA] py-3">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm">
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Transaction Settings'}
        </button>
      </div>
    </motion.div>
  );
};

export default TransactionTab;
