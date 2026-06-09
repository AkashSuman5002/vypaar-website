import React, { useState, useEffect } from 'react';
import ReportHeader from '../../components/reports/common/ReportHeader';
import ReportTable from '../../components/reports/common/ReportTable';
import ReportSummary from '../../components/reports/common/ReportSummary';
import EmptyState from '../../components/reports/common/EmptyState';
import { reportAPI, stockAPI, customerAPI, supplierAPI, productAPI } from '../../services/api';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import { exportToExcel, printReport } from '../../utils/exportUtils';

const reportConfig = {
  'Party Statement': { columns: [
    { key: 'date', label: 'Date' }, { key: 'voucher', label: 'Voucher' },
    { key: 'particular', label: 'Particulars' }, { key: 'debit', label: 'Debit', align: 'right', render: (v) => v ? `₹${v.toLocaleString()}` : '-' },
    { key: 'credit', label: 'Credit', align: 'right', render: (v) => v ? `₹${v.toLocaleString()}` : '-' },
    { key: 'balance', label: 'Balance', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'statement' },
  'Party Wise Profit & Loss': { columns: [
    { key: 'party', label: 'Party' }, { key: 'sales', label: 'Sales', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'purchases', label: 'Purchases', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'profit', label: 'Profit/Loss', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'statement' },
  'All Parties': { columns: [
    { key: 'name', label: 'Name' }, { key: 'type', label: 'Type', render: (v) => <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">{v}</span> },
    { key: 'balance', label: 'Balance', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'phone', label: 'Phone' },
  ], icon: 'statement' },
  'Party Report By Item': { columns: [
    { key: 'party', label: 'Party' }, { key: 'item', label: 'Item' },
    { key: 'qty', label: 'Qty', align: 'right' }, { key: 'amount', label: 'Amount', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'statement' },
  'Sale Purchase By Party': { columns: [
    { key: 'party', label: 'Party' }, { key: 'sales', label: 'Sales', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'purchases', label: 'Purchases', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'statement' },
  'Sale Purchase By Party Group': { columns: [
    { key: 'group', label: 'Group' }, { key: 'sales', label: 'Sales', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'purchases', label: 'Purchases', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'statement' },
  'GSTR 1': { columns: [
    { key: 'gstin', label: 'GSTIN' }, { key: 'invoice', label: 'Invoice No' }, { key: 'date', label: 'Date' },
    { key: 'value', label: 'Taxable Value', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'tax', label: 'Tax', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'gst' },
  'GSTR 2': { columns: [
    { key: 'gstin', label: 'GSTIN' }, { key: 'invoice', label: 'Invoice No' }, { key: 'date', label: 'Date' },
    { key: 'value', label: 'Taxable Value', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'tax', label: 'Tax', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'gst' },
  'GSTR 3B': { columns: [
    { key: 'supply', label: 'Supply Type' }, { key: 'value', label: 'Taxable Value', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'cgst', label: 'CGST', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'sgst', label: 'SGST', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'igst', label: 'IGST', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'gst' },
  'GSTR 9': { columns: [
    { key: 'section', label: 'Section' }, { key: 'value', label: 'Value', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'tax', label: 'Tax Paid', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'gst' },
  'Sale Summary By HSN': { columns: [
    { key: 'hsn', label: 'HSN/SAC' }, { key: 'description', label: 'Description' },
    { key: 'qty', label: 'Qty', align: 'right' }, { key: 'value', label: 'Taxable Value', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'tax', label: 'Tax', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'gst' },
  'SAC Report': { columns: [
    { key: 'sac', label: 'SAC Code' }, { key: 'description', label: 'Description' },
    { key: 'value', label: 'Value', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'gst' },
  'Stock Summary': { columns: [
    { key: 'item', label: 'Item' }, { key: 'sku', label: 'SKU' }, { key: 'category', label: 'Category' },
    { key: 'qty', label: 'Qty', align: 'right' }, { key: 'value', label: 'Value', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'stock' },
  'Item Report By Party': { columns: [
    { key: 'party', label: 'Party' }, { key: 'item', label: 'Item' },
    { key: 'qty', label: 'Qty', align: 'right' }, { key: 'amount', label: 'Amount', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'stock' },
  'Item Wise Profit And Loss': { columns: [
    { key: 'item', label: 'Item' }, { key: 'sales', label: 'Sales', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'cost', label: 'Cost', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'profit', label: 'Profit/Loss', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'stock' },
  'Item Category Wise Profit And Loss': { columns: [
    { key: 'category', label: 'Category' }, { key: 'sales', label: 'Sales', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'cost', label: 'Cost', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'profit', label: 'Profit/Loss', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'stock' },
  'Low Stock Summary': { columns: [
    { key: 'item', label: 'Item' }, { key: 'sku', label: 'SKU' },
    { key: 'current', label: 'Current Stock', align: 'right' }, { key: 'min', label: 'Min Stock', align: 'right' },
  ], icon: 'stock' },
  'Stock Detail': { columns: [
    { key: 'date', label: 'Date' }, { key: 'item', label: 'Item' },
    { key: 'type', label: 'Type', render: (v) => <span className={`px-2 py-0.5 rounded text-xs font-medium ${v === 'In' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{v}</span> },
    { key: 'qty', label: 'Qty', align: 'right' }, { key: 'balance', label: 'Balance', align: 'right' },
  ], icon: 'stock' },
  'Item Detail': { columns: [
    { key: 'item', label: 'Item' }, { key: 'sku', label: 'SKU' }, { key: 'category', label: 'Category' },
    { key: 'unit', label: 'Unit' }, { key: 'price', label: 'Price', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'stock', label: 'Stock', align: 'right' },
  ], icon: 'stock' },
  'Sale/Purchase Report By Item Category': { columns: [
    { key: 'category', label: 'Category' }, { key: 'sales', label: 'Sales', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'purchases', label: 'Purchases', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'stock' },
  'Stock Summary Report By Item Category': { columns: [
    { key: 'category', label: 'Category' }, { key: 'items', label: 'Items', align: 'right' },
    { key: 'qty', label: 'Qty', align: 'right' }, { key: 'value', label: 'Value', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'stock' },
  'Item Wise Discount': { columns: [
    { key: 'item', label: 'Item' }, { key: 'rate', label: 'Discount Rate', align: 'right', render: (v) => `${v || 0}%` },
    { key: 'amount', label: 'Discount Amount', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'stock' },
  'Business Status': { columns: [
    { key: 'metric', label: 'Metric' }, { key: 'value', label: 'Value', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'business' },
  'Bank Statement': { columns: [
    { key: 'date', label: 'Date' }, { key: 'particular', label: 'Particulars' },
    { key: 'deposit', label: 'Deposit', align: 'right', render: (v) => v ? `₹${v.toLocaleString()}` : '-' },
    { key: 'withdrawal', label: 'Withdrawal', align: 'right', render: (v) => v ? `₹${v.toLocaleString()}` : '-' },
    { key: 'balance', label: 'Balance', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'business' },
  'Discount Report': { columns: [
    { key: 'invoice', label: 'Invoice No' }, { key: 'customer', label: 'Customer' },
    { key: 'discount', label: 'Discount', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'net', label: 'Net Amount', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'business' },
  'Expense': { columns: [
    { key: 'date', label: 'Date' }, { key: 'category', label: 'Category', render: (v) => <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">{v}</span> },
    { key: 'description', label: 'Description' }, { key: 'amount', label: 'Amount', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'expense' },
  'Expense Category Report': { columns: [
    { key: 'category', label: 'Category' }, { key: 'count', label: 'Entries', align: 'right' },
    { key: 'total', label: 'Total', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'expense' },
  'Expense Item Report': { columns: [
    { key: 'item', label: 'Item' }, { key: 'category', label: 'Category' },
    { key: 'total', label: 'Total', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'expense' },
  'Sale Orders': { columns: [
    { key: 'date', label: 'Date' }, { key: 'order', label: 'Order No' }, { key: 'customer', label: 'Customer' },
    { key: 'amount', label: 'Amount', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'status', label: 'Status', render: (v) => <span className={`px-2 py-0.5 rounded text-xs font-medium ${v === 'Completed' ? 'bg-green-50 text-green-700' : v === 'Pending' ? 'bg-yellow-50 text-yellow-700' : 'bg-blue-50 text-blue-700'}`}>{v || 'Draft'}</span> },
  ], icon: 'orders' },
  'Sale Order Item': { columns: [
    { key: 'order', label: 'Order No' }, { key: 'item', label: 'Item' },
    { key: 'qty', label: 'Qty', align: 'right' }, { key: 'amount', label: 'Amount', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'orders' },
  'Loan Statement': { columns: [
    { key: 'date', label: 'Date' }, { key: 'particular', label: 'Particulars' },
    { key: 'payment', label: 'Payment', align: 'right', render: (v) => v ? `₹${v.toLocaleString()}` : '-' },
    { key: 'balance', label: 'Balance', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'loan' },
  'Bill Wise Profit': { columns: [
    { key: 'invoice', label: 'Invoice No' }, { key: 'customer', label: 'Customer' },
    { key: 'sales', label: 'Sales Amount', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'cost', label: 'Cost Amount', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'profit', label: 'Profit', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'transaction' },
  'Pending Orders': { columns: [
    { key: 'date', label: 'Date' }, { key: 'orderNo', label: 'Order No' }, { key: 'customer', label: 'Customer' },
    { key: 'amount', label: 'Amount', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'status', label: 'Status', render: (v) => <span className={`px-2 py-0.5 rounded text-xs font-medium ${v === 'Pending' ? 'bg-yellow-50 text-yellow-700' : v === 'Delivered' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{v || 'Pending'}</span> },
  ], icon: 'orders' },
  'EMI Schedule': { columns: [
    { key: 'date', label: 'Date' }, { key: 'account', label: 'Loan Account' },
    { key: 'emiNo', label: 'EMI No', align: 'right' }, { key: 'amount', label: 'Amount', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'balance', label: 'Balance', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'loan' },
  'Loan Summary': { columns: [
    { key: 'account', label: 'Loan Account' }, { key: 'type', label: 'Type', render: (v) => <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">{v}</span> },
    { key: 'totalGiven', label: 'Total Given', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'totalPaid', label: 'Total Paid', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'balance', label: 'Outstanding', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'loan' },
  'GST Report': { columns: [
    { key: 'gstin', label: 'GSTIN' }, { key: 'party', label: 'Party' },
    { key: 'value', label: 'Taxable Value', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'tax', label: 'Tax', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'gst' },
  'GST Rate Report': { columns: [
    { key: 'rate', label: 'GST Rate' }, { key: 'value', label: 'Taxable Value', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'cgst', label: 'CGST', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'sgst', label: 'SGST', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'igst', label: 'IGST', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'gst' },
  'Form No. 27EQ': { columns: [
    { key: 'pan', label: 'PAN' }, { key: 'name', label: 'Name' },
    { key: 'amount', label: 'Amount', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'tax', label: 'Tax', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
  ], icon: 'gst' },
  'TCS Receivable': { columns: [
    { key: 'party', label: 'Party' }, { key: 'pan', label: 'PAN' },
    { key: 'amount', label: 'TCS Amount', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'rate', label: 'Rate', align: 'right', render: (v) => `${v || 0}%` },
  ], icon: 'gst' },
  'TDS Payable': { columns: [
    { key: 'party', label: 'Party' }, { key: 'pan', label: 'PAN' },
    { key: 'amount', label: 'TDS Amount', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'rate', label: 'Rate', align: 'right', render: (v) => `${v || 0}%` },
  ], icon: 'gst' },
  'TDS Receivable': { columns: [
    { key: 'party', label: 'Party' }, { key: 'pan', label: 'PAN' },
    { key: 'amount', label: 'TDS Amount', align: 'right', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'rate', label: 'Rate', align: 'right', render: (v) => `${v || 0}%` },
  ], icon: 'gst' },
};

const icons = {
  statement: <svg width="80" height="60" viewBox="0 0 80 60" fill="none"><rect x="10" y="10" width="60" height="45" rx="4" fill="#F3F4F6" stroke="#E5E7EB" strokeWidth="1"/><rect x="18" y="18" width="44" height="4" rx="2" fill="#E5E7EB"/><rect x="18" y="26" width="30" height="3" rx="1.5" fill="#E5E7EB"/><rect x="18" y="32" width="35" height="3" rx="1.5" fill="#E5E7EB"/><rect x="18" y="38" width="20" height="3" rx="1.5" fill="#E5E7EB"/></svg>,
  gst: <svg width="80" height="60" viewBox="0 0 80 60" fill="none"><rect x="10" y="10" width="60" height="45" rx="4" fill="#F3F4F6" stroke="#E5E7EB" strokeWidth="1"/><rect x="18" y="18" width="44" height="4" rx="2" fill="#E5E7EB"/><rect x="18" y="26" width="20" height="3" rx="1.5" fill="#E5E7EB"/><rect x="42" y="26" width="20" height="3" rx="1.5" fill="#E5E7EB"/><rect x="18" y="32" width="15" height="3" rx="1.5" fill="#E5E7EB"/><rect x="38" y="32" width="24" height="3" rx="1.5" fill="#E5E7EB"/><rect x="18" y="38" width="44" height="2" rx="1" fill="#E5E7EB"/></svg>,
  stock: <svg width="80" height="60" viewBox="0 0 80 60" fill="none"><rect x="10" y="10" width="60" height="45" rx="4" fill="#F3F4F6" stroke="#E5E7EB" strokeWidth="1"/><rect x="18" y="18" width="44" height="4" rx="2" fill="#E5E7EB"/><rect x="18" y="26" width="15" height="3" rx="1.5" fill="#E5E7EB"/><rect x="38" y="26" width="24" height="3" rx="1.5" fill="#E5E7EB"/><rect x="18" y="32" width="25" height="3" rx="1.5" fill="#E5E7EB"/><rect x="18" y="38" width="10" height="3" rx="1.5" fill="#E5E7EB"/><rect x="33" y="38" width="29" height="3" rx="1.5" fill="#E5E7EB"/></svg>,
  business: <svg width="80" height="60" viewBox="0 0 80 60" fill="none"><rect x="10" y="10" width="60" height="45" rx="4" fill="#F3F4F6" stroke="#E5E7EB" strokeWidth="1"/><rect x="18" y="18" width="44" height="4" rx="2" fill="#E5E7EB"/><rect x="18" y="26" width="20" height="3" rx="1.5" fill="#E5E7EB"/><rect x="43" y="26" width="19" height="3" rx="1.5" fill="#E5E7EB"/><rect x="18" y="32" width="15" height="3" rx="1.5" fill="#E5E7EB"/><rect x="38" y="32" width="24" height="3" rx="1.5" fill="#E5E7EB"/></svg>,
  expense: <svg width="80" height="60" viewBox="0 0 80 60" fill="none"><rect x="10" y="10" width="60" height="45" rx="4" fill="#F3F4F6" stroke="#E5E7EB" strokeWidth="1"/><rect x="18" y="18" width="44" height="4" rx="2" fill="#E5E7EB"/><rect x="18" y="26" width="35" height="3" rx="1.5" fill="#E5E7EB"/><rect x="18" y="32" width="25" height="3" rx="1.5" fill="#E5E7EB"/><rect x="18" y="38" width="30" height="3" rx="1.5" fill="#E5E7EB"/></svg>,
  orders: <svg width="80" height="60" viewBox="0 0 80 60" fill="none"><rect x="10" y="10" width="60" height="45" rx="4" fill="#F3F4F6" stroke="#E5E7EB" strokeWidth="1"/><rect x="18" y="18" width="44" height="4" rx="2" fill="#E5E7EB"/><rect x="18" y="26" width="15" height="3" rx="1.5" fill="#E5E7EB"/><rect x="38" y="26" width="24" height="3" rx="1.5" fill="#E5E7EB"/><rect x="18" y="32" width="10" height="3" rx="1.5" fill="#E5E7EB"/><rect x="33" y="32" width="29" height="3" rx="1.5" fill="#E5E7EB"/></svg>,
  loan: <svg width="80" height="60" viewBox="0 0 80 60" fill="none"><rect x="10" y="10" width="60" height="45" rx="4" fill="#F3F4F6" stroke="#E5E7EB" strokeWidth="1"/><rect x="18" y="18" width="44" height="4" rx="2" fill="#E5E7EB"/><rect x="18" y="26" width="20" height="3" rx="1.5" fill="#E5E7EB"/><rect x="43" y="26" width="19" height="3" rx="1.5" fill="#E5E7EB"/><rect x="18" y="32" width="44" height="2" rx="1" fill="#E5E7EB"/></svg>,
  transaction: <svg width="80" height="60" viewBox="0 0 80 60" fill="none"><rect x="10" y="10" width="60" height="45" rx="4" fill="#F3F4F6" stroke="#E5E7EB" strokeWidth="1"/><rect x="18" y="18" width="44" height="4" rx="2" fill="#E5E7EB"/><rect x="18" y="26" width="30" height="3" rx="1.5" fill="#E5E7EB"/><rect x="18" y="32" width="20" height="3" rx="1.5" fill="#E5E7EB"/><rect x="43" y="32" width="19" height="3" rx="1.5" fill="#E5E7EB"/></svg>,
};

const apiMap = {
  'Party Statement': (params) => customerAPI.getAll(params).then(r => r.data),
  'All Parties': (params) => customerAPI.getAll(params).then(r => (r.data.customers||r.data).map(c => ({name:c.name,type:'Customer',balance:c.openingBalance||0,phone:c.phone||'-'}))),
  'GSTR 1': (params) => reportAPI.getGSTR1(params).then(r => r.data.invoices.map(i => ({gstin:i.customer?.gstNumber||'-',invoice:i.invoiceNo||i._id?.slice(-6),date:i.date?new Date(i.date).toLocaleDateString('en-IN'):'-',value:i.taxableAmount||0,tax:(i.cgstTotal||0)+(i.sgstTotal||0)+(i.igstTotal||0)}))),
  'GSTR 2': (params) => reportAPI.getGSTR2(params).then(r => r.data.invoices.map(i => ({gstin:i.supplier?.gstNumber||'-',invoice:i.invoiceNo||i._id?.slice(-6),date:i.date?new Date(i.date).toLocaleDateString('en-IN'):'-',value:i.taxableAmount||0,tax:(i.cgstTotal||0)+(i.sgstTotal||0)+(i.igstTotal||0)}))),
  'GSTR 3B': (params) => reportAPI.getGSTR3B(params).then(r => {
    const d = r.data.gstr3b;
    return [
      {supply:'Taxable Supply',value:d.supply.taxableValue,cgst:d.supply.centralTax,sgst:d.supply.stateTax,igst:0},
      {supply:'ITC Claimed',value:d.itc.eligible,cgst:d.itc.centralTax,sgst:d.itc.stateTax,igst:0},
    ];
  }),
  'GSTR 9': (params) => reportAPI.getGSTR9(params).then(r => {
    const s = r.data.summary || {};
    return [{section:'Taxable Turnover',value:s.taxableTurnover||0,tax:s.totalGSTCollected||0}];
  }),
  'Sale Summary By HSN': (params) => reportAPI.getHSN(params).then(r => (r.data.hsnSummary||[]).map(h => ({hsn:h.hsn,description:'-',qty:h.quantity,value:h.taxableAmount,tax:h.gstAmount}))),
  'SAC Report': (params) => reportAPI.getSAC(params).then(r => (r.data.sacSummary||[]).map(s => ({sac:s.sac,description:s.description||'-',value:s.taxableAmount||s.value}))),
  'Stock Summary': (params) => stockAPI.getValuation().then(r => (r.data.valuation||[]).map(s => ({item:s.name||s.product,sku:s.sku||'-',category:s.category||'-',qty:s.quantity||0,value:s.value||0}))),
  'Low Stock Summary': (params) => productAPI.getAll({lowStock:true}).then(r => (r.data.products||r.data||[]).filter(p => p.stock <= (p.minStock||5)).map(p => ({item:p.name,sku:p.sku||'-',current:p.stock,min:p.minStock||5}))),
  'Bank Statement': (params) => reportAPI.getBankStatement(params).then(r => (r.data.entries||[]).map(e => ({date:e.date?new Date(e.date).toLocaleDateString('en-IN'):'-',particular:e.description||e.partyName||'-',deposit:e.credit||0,withdrawal:e.debit||0,balance:e.balance||0}))),
  'Discount Report': (params) => reportAPI.getDiscountReport(params).then(r => (r.data.entries||[]).map(d => ({invoice:d.invoiceNo||'-',customer:d.partyName||'-',discount:d.discountAmount||0,net:d.netAmount||0}))),
  'Expense': (params) => reportAPI.getExpenseReport(params).then(r => (r.data.entries||[]).map(e => ({date:e.date?new Date(e.date).toLocaleDateString('en-IN'):'-',category:e.category||'General',description:e.description||'-',amount:e.totalAmount||0}))),
  'Expense Category Report': (params) => reportAPI.getExpenseCategoryReport(params).then(r => (r.data.categories||[]).map(c => ({category:c.categoryName,count:c.totalTransactions,cgst:0,total:c.totalAmount}))),
  'Expense Item Report': (params) => reportAPI.getExpenseItemReport(params).then(r => (r.data.entries||[]).map(e => ({item:e.description||'-',category:e.category||'-',total:e.totalAmount||0}))),
  'Sale Orders': (params) => reportAPI.getSaleOrders(params).then(r => (r.data.orders||[]).map(o => ({date:o.date?new Date(o.date).toLocaleDateString('en-IN'):'-',order:o.orderNo||o._id?.slice(-6),customer:o.customerName||'-',amount:o.totalAmount||0,status:o.status||'Draft'}))),
  'Loan Statement': (params) => reportAPI.getLoanStatement(params).then(r => (r.data.entries||[]).map(l => ({date:l.date?new Date(l.date).toLocaleDateString('en-IN'):'-',particular:l.description||'-',payment:l.credit||0,balance:l.balance||0}))),
  'GST Report': (params) => reportAPI.getGST(params).then(r => (r.data.gstSummary||[]).map(g => ({gstin:'-',party:'-',value:g.taxableAmount,tax:(g.cgst||0)+(g.sgst||0)+(g.igst||0)}))),
  'GST Rate Report': (params) => reportAPI.getGST(params).then(r => (r.data.gstSummary||[]).map(g => ({rate:`${g.rate}%`,value:g.taxableAmount,cgst:g.cgst||0,sgst:g.sgst||0,igst:g.igst||0}))),
  'Form No. 27EQ': (params) => reportAPI.getForm27EQ(params).then(r => (r.data.sections||[]).map(f => ({pan:f.pan||'-',name:f.partyName||'-',amount:f.transactionAmount||0,tax:f.tcsAmount||f.tdsAmount||0}))),
  'TCS Receivable': (params) => reportAPI.getTCSReceivable(params).then(r => (r.data.entries||[]).map(t => ({party:t.partyName||'-',pan:t.pan||'-',amount:t.tcsAmount||0,rate:t.tcsPct||0}))),
  'TDS Payable': (params) => reportAPI.getTDSPayable(params).then(r => (r.data.entries||[]).map(t => ({party:t.vendorName||t.partyName||'-',pan:t.pan||'-',amount:t.tdsAmount||0,rate:t.tdsPct||0}))),
  'TDS Receivable': (params) => reportAPI.getTDSReceivable(params).then(r => (r.data.entries||[]).map(t => ({party:t.partyName||'-',pan:t.pan||'-',amount:t.tdsAmount||0,rate:t.tdsPct||0}))),
  'Bill Wise Profit': (params) => reportAPI.getBillWiseProfit(params).then(r => (r.data.entries||[]).map(b => ({invoice:b.invoiceNo||b._id?.slice(-6),customer:b.customerName||'-',sales:b.salesAmount||0,cost:b.costAmount||0,profit:b.profit||0}))),
  'Pending Orders': (params) => reportAPI.getPendingOrders(params).then(r => (r.data.orders||[]).map(o => ({date:o.date?new Date(o.date).toLocaleDateString('en-IN'):'-',orderNo:o.invoiceNumber||o._id?.slice(-6),customer:o.customerName||'-',amount:o.totalAmount||0,status:o.deliveryStatus==='delivered'?'Delivered':o.deliveryStatus==='cancelled'?'Cancelled':'Pending'}))),
  'EMI Schedule': (params) => reportAPI.getEMISchedule(params).then(r => (r.data.entries||[]).map(e => ({date:e.date?new Date(e.date).toLocaleDateString('en-IN'):'-',account:e.accountName||'-',emiNo:e.emiNo||'-',amount:e.amount||0,balance:e.balance||0}))),
  'Loan Summary': (params) => reportAPI.getLoanSummary(params).then(r => (r.data.loans||[]).map(l => ({account:l.accountName||'-',type:l.loanType||'Loan',totalGiven:l.totalGiven||0,totalPaid:l.totalPaid||0,balance:l.outstanding||0}))),
};

const GenericReport = ({ reportName }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const filteredData = data.filter(d => !search || Object.values(d).some(v => String(v).toLowerCase().includes(search.toLowerCase())));
  const [dates, setDates] = useState({ start: '', end: '' });
  const config = reportConfig[reportName];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = {};
        if (dates.start && dates.end) { params.startDate = dates.start; params.endDate = dates.end; }
        const fetcher = apiMap[reportName];
        const result = fetcher ? await fetcher(params) : [];
        setData(Array.isArray(result) ? result : []);
      } catch (err) { console.error(`Failed to load ${reportName}`, err); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [reportName, dates]);

  if (!config) return <div className="flex items-center justify-center text-sm text-[#64748B] p-12">Report configuration not found</div>;
  if (loading) return <div className="bg-white dark:bg-[#0F172A] min-h-full"><LoadingSpinner /></div>;

  return (
    <div>
      <ReportHeader title={reportName} onDateChange={(t, v) => setDates({...dates,[t]:v})} startDate={dates.start} endDate={dates.end} search={search} onSearchChange={setSearch} onDownload={() => exportToExcel(data, config.columns, reportName)} onPrint={printReport} />
      <div className="p-6">
        <ReportTable columns={config.columns} data={filteredData} emptyState={`No ${reportName.toLowerCase()} data available`} />
      </div>
    </div>
  );
};

export default GenericReport;
