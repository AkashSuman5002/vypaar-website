import React from 'react';
import { motion } from 'framer-motion';
import { BadgePercent, Phone, Mail, MapPin, Building } from 'lucide-react';
import { formatCurrency, formatDate, numberToWords } from '../../utils/format';

const InvoicePreview = ({ form, settings }) => {
  const { items, customer, customerName, date, dueDate, invoiceNumber, paidAmount, paymentMethod } = form;

  const taxableAmount = items.reduce((s, i) => s + (i.quantity * i.rate), 0);
  const cgstTotal = items.reduce((s, i) => {
    const taxable = i.quantity * i.rate;
    return s + (taxable * (i.gstRate / 100) / 2);
  }, 0);
  const sgstTotal = items.reduce((s, i) => {
    const taxable = i.quantity * i.rate;
    return s + (taxable * (i.gstRate / 100) / 2);
  }, 0);
  const totalDiscount = items.reduce((s, i) => s + (i.discount || 0), 0);
  const totalGst = cgstTotal + sgstTotal;
  const grandTotal = taxableAmount + totalGst - totalDiscount;
  const remainingBalance = grandTotal - paidAmount;

  const paymentStatus = paidAmount >= grandTotal && grandTotal > 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

  const bizLogo = settings?.logo ? `http://localhost:5000/${settings.logo}` : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="sticky top-24"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700/80 shadow-soft overflow-hidden">
        {/* Preview Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
              <Building className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Invoice Preview</h3>
          </div>
          <div className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider ${
            paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
            paymentStatus === 'partial' ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' :
            'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
          }`}>
            {paymentStatus === 'paid' ? 'PAID' : paymentStatus === 'partial' ? 'PARTIAL' : 'UNPAID'}
          </div>
        </div>

        {/* Company Info */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-100 dark:border-gray-700">
          <div className="flex items-start gap-3.5">
            {bizLogo ? (
              <img src={bizLogo} alt="Logo" className="w-11 h-11 object-contain rounded-xl border border-slate-100 dark:border-gray-700" />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                {settings?.businessName?.charAt(0) || 'B'}
              </div>
            )}
            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">{settings?.businessName || 'Your Business'}</h4>
              {settings?.gstNumber && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1">
                  <BadgePercent className="w-3 h-3" /> GST: {settings.gstNumber}
                </p>
              )}
            </div>
          </div>
          {settings?.address && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 flex items-start gap-1.5 leading-relaxed">
              <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" /> {settings.address}
            </p>
          )}
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400 dark:text-slate-500">
            {settings?.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{settings.phone}</span>}
            {settings?.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{settings.email}</span>}
          </div>
        </div>

        {/* Bill To */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700">
          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Bill To</p>
          <div className="bg-slate-50/50 dark:bg-gray-700/30 rounded-xl p-3.5 border border-slate-100 dark:border-gray-700">
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{customerName || 'Walk-in Customer'}</p>
            {customer?.phone && <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1"><Phone className="w-3 h-3" />{customer.phone}</p>}
            {customer?.email && <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1"><Mail className="w-3 h-3" />{customer.email}</p>}
            {customer?.address && <p className="text-[11px] text-slate-400 mt-0.5 flex items-start gap-1"><MapPin className="w-3 h-3 mt-0.5" />{customer.address}</p>}
          </div>
        </div>

        {/* Items Table */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700">
          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Items</p>
          {items.length === 0 ? (
            <div className="text-center py-6 text-slate-300 dark:text-slate-600">
              <p className="text-xs">No items added yet</p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-gray-700">
                    <th className="pb-2 text-left font-medium text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-wider">Item</th>
                    <th className="pb-2 text-right font-medium text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-wider">Qty</th>
                    <th className="pb-2 text-right font-medium text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-wider">Rate</th>
                    <th className="pb-2 text-right font-medium text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-wider">GST</th>
                    <th className="pb-2 text-right font-medium text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-gray-700/50">
                  {items.map((item, idx) => {
                    const lineTotal = item.quantity * item.rate;
                    const gstHalf = lineTotal * (item.gstRate / 100) / 2;
                    const amount = lineTotal + gstHalf + gstHalf - (item.discount || 0);
                    return (
                      <tr key={idx}>
                        <td className="py-2 pr-2">
                          <p className="font-medium text-slate-900 dark:text-slate-100">{item.productName || 'Item'}</p>
                          {item.discount > 0 && <p className="text-[10px] text-slate-400">Discount: -{formatCurrency(item.discount)}</p>}
                        </td>
                        <td className="py-2 text-right text-slate-600 dark:text-slate-400">{item.quantity}</td>
                        <td className="py-2 text-right text-slate-600 dark:text-slate-400">{formatCurrency(item.rate)}</td>
                        <td className="py-2 text-right text-blue-600 dark:text-blue-400">{item.gstRate > 0 ? `${item.gstRate}%` : '-'}</td>
                        <td className="py-2 text-right font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-gray-700">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 dark:text-slate-500">Subtotal</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(taxableAmount)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 dark:text-slate-500">CGST</span>
              <span className="font-medium text-blue-600 dark:text-blue-400">{formatCurrency(cgstTotal)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 dark:text-slate-500">SGST</span>
              <span className="font-medium text-blue-600 dark:text-blue-400">{formatCurrency(sgstTotal)}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 dark:text-slate-500">Discount</span>
                <span className="font-medium text-red-500">{formatCurrency(totalDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm pt-2 border-t border-slate-100 dark:border-gray-700">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Grand Total</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 text-base">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
          {grandTotal > 0 && (
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 italic leading-relaxed">
              {numberToWords(grandTotal)}
            </p>
          )}
        </div>

        {/* Payment Info */}
        <div className="px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-50/50 dark:bg-emerald-500/5 rounded-xl p-3 border border-emerald-100 dark:border-emerald-800/30">
              <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Paid</p>
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">{formatCurrency(paidAmount)}</p>
            </div>
            <div className="bg-amber-50/50 dark:bg-amber-500/5 rounded-xl p-3 border border-amber-100 dark:border-amber-800/30">
              <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">Balance</p>
              <p className="text-lg font-bold text-amber-700 dark:text-amber-300 mt-0.5">{formatCurrency(remainingBalance)}</p>
            </div>
          </div>
          {paymentMethod && paidAmount > 0 && (
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 text-right capitalize">via {paymentMethod}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default InvoicePreview;
