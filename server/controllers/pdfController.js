const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const Sale = require('../models/Sale');
const Setting = require('../models/Setting');
const path = require('path');
const fs = require('fs');
const { getBaseFilter } = require('../utils/queryHelper');

const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 37, g: 99, b: 235 };
};

const formatAmount = (amount, printPrefs, currency) => {
  const val = Number(amount) || 0;
  const decimals = parseInt(printPrefs.amountDecimalPlaces) || 2;
  if (printPrefs.printAmountWithGrouping === false) {
    return `${currency || '₹'}${val.toFixed(decimals)}`;
  }
  return `${currency || '₹'}${val.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
};

const getThemeColor = (printPrefs) => {
  if (printPrefs.accentColor) return printPrefs.accentColor;
  if (printPrefs.gstTheme) return '#7C3AED';
  if (printPrefs.tallyTheme) return '#2563EB';
  if (printPrefs.landscapeTheme1) return '#059669';
  if (printPrefs.landscapeTheme2) return '#D97706';
  return '#2563EB';
};

const numberToWords = (num) => {
  if (num === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const convert = (n) => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  };
  const intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);
  let result = convert(intPart);
  if (decPart > 0) result += ' and ' + convert(decPart) + ' Paise';
  return result + ' Only';
};

const generateInvoicePDF = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: 'Sale not found' });
    if (sale.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const baseFilter = getBaseFilter(req);
    const settings = await Setting.findOne({ ...baseFilter });
    const printPrefs = settings?.preferences?.print || {};
    const showYouSaved = printPrefs.youSaved !== false;
    const accentColor = getThemeColor(printPrefs);
    const rgb = hexToRgb(accentColor);

    const paperSize = printPrefs.paperSize || 'A4';
    const orientation = printPrefs.orientation || 'Portrait';
    const topMargin = parseInt(printPrefs.topPDFMargin) || 40;
    const companyNameSize = parseInt(printPrefs.companyNameTextSize) || 20;
    const invoiceTextSize = parseInt(printPrefs.invoiceTextSize) || 14;
    const printerType = printPrefs.printerType || 'regular';

    let docSize;
    if (printerType === 'thermal') {
      docSize = [226, 500];
    } else {
      const sizeMap = { 'A4': 'A4', 'A5': [148, 210], 'Letter': [215.9, 279.4], 'Legal': [215.9, 355.6] };
      docSize = sizeMap[paperSize] || 'A4';
    }
    const effectiveWidth = Array.isArray(docSize) ? docSize[0] : (orientation === 'Landscape' ? 842 : 595);
    const effectiveHeight = Array.isArray(docSize) ? docSize[1] : (orientation === 'Landscape' ? 595 : 842);
    const pageWidth = printerType === 'thermal' ? 226 : effectiveWidth;
    const pageHeight = printerType === 'thermal' ? 500 : effectiveHeight;
    const marginLeft = 40;
    const marginRight = 40;
    const contentWidth = pageWidth - marginLeft - marginRight;

    const doc = new PDFDocument({
      margin: topMargin,
      size: orientation === 'Landscape' ? [pageHeight, pageWidth] : [pageWidth, pageHeight],
      bufferPages: true,
    });

    res.setHeader('Content-Type', 'application/pdf');
    const safeInvoiceName = (sale.invoiceNumber || 'invoice').replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="${safeInvoiceName}.pdf"`);
    doc.pipe(res);

    const bizName = settings?.businessName || 'Your Business';
    const bizAddr = settings?.address || '';
    const bizPhone = settings?.phone || '';
    const bizEmail = settings?.email || '';
    const bizGst = settings?.preferences?.general?.gstin || settings?.gstNumber || '';
    const currency = settings?.currency || '₹';

    let headerY = topMargin;

    if (settings?.logo) {
      const logoPath = path.join(__dirname, '..', settings.logo);
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, marginLeft, headerY, { width: 60 });
      }
    }

    doc.fontSize(companyNameSize).font('Helvetica-Bold').fillColor(accentColor).text(bizName, marginLeft + (settings?.logo ? 70 : 0), headerY);
    doc.fontSize(9).font('Helvetica').fillColor('#000000');
    let detailY = headerY + companyNameSize + 6;
    if (bizAddr) { doc.text(bizAddr, marginLeft + (settings?.logo ? 70 : 0), detailY); detailY += 13; }
    if (bizPhone) { doc.text(`Phone: ${bizPhone}`, marginLeft + (settings?.logo ? 70 : 0), detailY); detailY += 13; }
    if (bizEmail) { doc.text(`Email: ${bizEmail}`, marginLeft + (settings?.logo ? 70 : 0), detailY); detailY += 13; }
    if (bizGst) { doc.text(`GST: ${bizGst}`, marginLeft + (settings?.logo ? 70 : 0), detailY); detailY += 13; }

    if (settings?.invoiceNote) { doc.text(`Note: ${settings.invoiceNote}`, marginLeft + (settings?.logo ? 70 : 0), detailY); detailY += 13; }

    if (settings?.bankName || settings?.bankAccountNumber || settings?.upiId) {
      detailY += 4;
      if (settings?.bankName) { doc.text(`Bank: ${settings.bankName}`, marginLeft + (settings?.logo ? 70 : 0), detailY); detailY += 12; }
      if (settings?.bankAccountNumber) { doc.text(`A/C: ${settings.bankAccountNumber}`, marginLeft + (settings?.logo ? 70 : 0), detailY); detailY += 12; }
      if (settings?.bankIfsc) { doc.text(`IFSC: ${settings.bankIfsc}`, marginLeft + (settings?.logo ? 70 : 0), detailY); detailY += 12; }
      if (settings?.bankBranch) { doc.text(`Branch: ${settings.bankBranch}`, marginLeft + (settings?.logo ? 70 : 0), detailY); detailY += 12; }
      if (settings?.upiId) { doc.text(`UPI: ${settings.upiId}`, marginLeft + (settings?.logo ? 70 : 0), detailY); detailY += 12; }
    }

    const docTypeLabel = sale.type === 'invoice' ? 'TAX INVOICE' : sale.type === 'estimate' ? 'ESTIMATE' : sale.type === 'quotation' ? 'QUOTATION' : sale.type === 'proforma' ? 'PROFORMA INVOICE' : sale.type === 'order' ? 'SALE ORDER' : sale.type === 'challan' ? 'DELIVERY CHALLAN' : sale.type === 'credit_note' ? 'CREDIT NOTE' : 'DOCUMENT';
    doc.fontSize(invoiceTextSize).font('Helvetica-Bold').fillColor(accentColor).text(docTypeLabel, marginLeft, detailY + 8);
    doc.fontSize(10).font('Helvetica').fillColor('#000000');

    if (printPrefs.printOriginalDuplicate && printPrefs.printOriginalDuplicate !== 'Original') {
      doc.fontSize(10).font('Helvetica-Bold').text(printPrefs.printOriginalDuplicate.toUpperCase(), marginLeft, detailY + 8 + invoiceTextSize + 4, { align: 'right', width: contentWidth });
    }

    const infoY = detailY + 8 + invoiceTextSize + 20;
    doc.fontSize(10).font('Helvetica').fillColor('#000000');
    doc.text(`Invoice: ${sale.invoiceNumber}`, marginLeft, infoY);
    const saleDateStr = settings?.preferences?.transaction?.addTimeOnTransactions !== false
      ? new Date(sale.date).toLocaleString('en-IN')
      : new Date(sale.date).toLocaleDateString('en-IN');
    doc.text(`Date: ${saleDateStr}`, marginLeft, infoY + 14);
    doc.text(`Customer: ${sale.customerName || 'Walk-in'}`, marginLeft, infoY + 28);

    if (settings?.preferences?.party?.printShippingAddress !== false && sale.shippingAddress) {
      doc.text(`Ship To: ${typeof sale.shippingAddress === 'string' ? sale.shippingAddress : sale.shippingAddress.address || sale.shippingAddress.fullAddress || ''}`, marginLeft, infoY + 42);
    }

    let tableTop = infoY + 55;
    const hasTax = printPrefs.taxDetails !== false;
    const hasDescription = printPrefs.printDescription !== false;

    let colPositions, headers;
    if (hasTax) {
      colPositions = [marginLeft, marginLeft + 130, marginLeft + 210, marginLeft + 275, marginLeft + 340, marginLeft + 395, marginLeft + 450];
      headers = ['Product', 'Qty', 'Rate', 'Taxable', 'CGST', 'SGST', 'Total'];
    } else {
      colPositions = [marginLeft, marginLeft + 180, marginLeft + 280, marginLeft + 360, marginLeft + 440];
      headers = ['Product', 'Qty', 'Rate', 'Amount', 'Total'];
    }

    doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000');
    doc.rect(marginLeft - 5, tableTop - 6, contentWidth + 10, 18).fill('#f3f4f6');
    doc.fill('#000000');
    headers.forEach((h, i) => {
      const w = colPositions[i + 1] ? colPositions[i + 1] - colPositions[i] - 5 : 80;
      doc.text(h, colPositions[i], tableTop, { width: w, align: i === 0 ? 'left' : 'right' });
    });

    doc.font('Helvetica').fontSize(9);
    let y = tableTop + 20;
    const showAmount = sale.type !== 'challan' || settings?.preferences?.general?.printAmountOnDC !== false;
    sale.items.forEach((item) => {
      if (y > pageHeight - 100) {
        doc.addPage();
        y = topMargin;
      }
      const name = item.productName + (item.gstRate ? ` (${item.gstRate}%)` : '');
      doc.fillColor('#000000').text(name, marginLeft, y, { width: 120 });
      doc.text(String(item.quantity), colPositions[1], y, { width: 70, align: 'right' });
      if (showAmount) {
        doc.text(formatAmount(item.rate, printPrefs, currency), colPositions[2], y, { width: 70, align: 'right' });
        if (hasTax) {
          doc.text(formatAmount(item.taxableAmount || item.amount, printPrefs, currency), colPositions[3], y, { width: 60, align: 'right' });
          doc.text(formatAmount(item.cgst || 0, printPrefs, currency), colPositions[4], y, { width: 50, align: 'right' });
          doc.text(formatAmount(item.sgst || 0, printPrefs, currency), colPositions[5], y, { width: 50, align: 'right' });
        }
        doc.text(formatAmount(item.amount, printPrefs, currency), colPositions[hasTax ? 6 : 4], y, { width: 60, align: 'right' });
      }
      y += 16;
    });

    y += 8;
    doc.moveTo(marginLeft - 5, y).lineTo(marginLeft + contentWidth + 5, y).stroke();
    y += 6;

    const totals = [];
    totals.push({ label: 'Taxable Amount', value: sale.taxableAmount || sale.totalAmount });
    if (hasTax) {
      if (sale.cgstTotal) totals.push({ label: 'CGST', value: sale.cgstTotal });
      if (sale.sgstTotal) totals.push({ label: 'SGST', value: sale.sgstTotal });
      if (sale.igstTotal) totals.push({ label: 'IGST', value: sale.igstTotal });
      if (sale.cessTotal) totals.push({ label: 'Cess', value: sale.cessTotal });
    }
    if (sale.discountOnInvoice) totals.push({ label: 'Discount', value: -sale.discountOnInvoice });

    totals.forEach((t) => {
      doc.font('Helvetica').fontSize(10).fillColor('#000000');
      doc.text(t.label, marginLeft + 310, y);
      doc.text(formatAmount(t.value, printPrefs, currency), marginLeft + contentWidth - 50, y, { width: 60, align: 'right' });
      y += 16;
    });

    doc.moveTo(marginLeft + 310, y).lineTo(marginLeft + contentWidth + 5, y).stroke();
    y += 6;
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#000000');
    doc.text('Grand Total:', marginLeft + 310, y);
    doc.text(formatAmount(sale.totalAmount, printPrefs, currency), marginLeft + contentWidth - 50, y, { width: 60, align: 'right' });
    y += 20;

    const discountAmount = sale.discountOnInvoice || 0;
    if (showYouSaved && discountAmount > 0) {
      y += 20;
      doc.fontSize(11).fillColor('#16a34a')
        .text(`You saved: ${currency}${discountAmount.toFixed(2)}`, marginLeft, y, { align: 'right', width: contentWidth });
      y += 10;
    }

    if (printPrefs.amountInWords !== false) {
      doc.font('Helvetica').fontSize(9).font('Helvetica-Oblique').fillColor('#666666');
      doc.text(`Rupees ${numberToWords(sale.totalAmount)}`, marginLeft, y, { width: contentWidth });
      y += 14;
    }

    doc.font('Helvetica').fontSize(10).fillColor('#000000');
    doc.text(`Paid: ${formatAmount(sale.paidAmount, printPrefs, currency)}`, marginLeft, y);
    y += 14;

    if (printPrefs.balanceAmount !== false) {
      doc.text(`Balance: ${formatAmount(sale.remainingBalance, printPrefs, currency)}`, marginLeft, y);
      y += 14;
    }

    if (printPrefs.currentBalance !== false && sale.customer) {
      doc.text(`Status: ${sale.paymentStatus.toUpperCase()}`, marginLeft, y);
      y += 14;
    }

    if (printPrefs.paymentMode !== false && sale.payments && sale.payments.length > 0) {
      const modes = [...new Set(sale.payments.map(p => p.mode).filter(Boolean))].join(', ');
      if (modes) {
        doc.text(`Payment Mode: ${modes}`, marginLeft, y);
        y += 14;
      }
    }

    if (printPrefs.termsConditions !== false && sale.termsConditions) {
      y += 6;
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000').text('Terms & Conditions:', marginLeft, y);
      y += 12;
      doc.font('Helvetica').fontSize(8).fillColor('#444444').text(sale.termsConditions, marginLeft, y, { width: contentWidth });
      y += Math.ceil(sale.termsConditions.length / 80) * 12 + 6;
    }

    if (settings?.invoiceNote) {
      y += 6;
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000').text('Note:', marginLeft, y);
      y += 12;
      doc.font('Helvetica').fontSize(8).fillColor('#444444').text(settings.invoiceNote, marginLeft, y, { width: contentWidth });
      y += Math.ceil(settings.invoiceNote.length / 80) * 12 + 6;
    }

    if (printPrefs.footerSettings !== false) {
      if (printPrefs.receivedBy !== false || printPrefs.deliveredBy !== false || printPrefs.signature !== false) {
        y += 10;
        const footerY = y;
        if (printPrefs.receivedBy !== false) {
          doc.font('Helvetica').fontSize(9).fillColor('#000000').text('Received By: _________________', marginLeft, footerY);
        }
        if (printPrefs.deliveredBy !== false) {
          doc.text('Delivered By: _________________', marginLeft + 200, footerY);
        }
        if (printPrefs.signature !== false) {
          const sigY = footerY - 5;
          if (settings?.signature) {
            const sigPath = path.join(__dirname, '..', settings.signature);
            if (fs.existsSync(sigPath)) {
              doc.image(sigPath, marginLeft + 420, sigY, { width: 80, height: 30 });
              doc.text('Authorized Signature', marginLeft + 420, sigY + 35, { width: 120, align: 'right' });
            } else {
              doc.text('Authorized Signature', marginLeft + 420, footerY, { width: 120, align: 'right' });
            }
          } else {
            doc.text('Authorized Signature', marginLeft + 420, footerY, { width: 120, align: 'right' });
          }
        }
        y = footerY + 30;
      }
      if (printPrefs.acknowledgement !== false) {
        doc.font('Helvetica-Oblique').fontSize(8).fillColor('#888888').text('Acknowledgement: This is a computer-generated invoice.', marginLeft, y, { width: contentWidth });
      }
    }

    try {
      const qrData = JSON.stringify({
        gstin: bizGst,
        invoiceNo: sale.invoiceNumber,
        date: new Date(sale.date).toISOString().split('T')[0],
        totalGST: (sale.cgstTotal || 0) + (sale.sgstTotal || 0) + (sale.igstTotal || 0),
        totalAmount: sale.totalAmount || 0,
      });
      const qrBuffer = await QRCode.toBuffer(qrData, { width: 100, margin: 2 });
      doc.image(qrBuffer, marginLeft, infoY, { width: 70 });
    } catch (qrErr) {}

    doc.end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const generatePurchasePDF = async (req, res) => {
  try {
    const Purchase = require('../models/Purchase');
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) return res.status(404).json({ message: 'Purchase not found' });
    if (purchase.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const baseFilter = getBaseFilter(req);
    const settings = await Setting.findOne({ ...baseFilter });
    const printPrefs = settings?.preferences?.print || {};
    const accentColor = getThemeColor(printPrefs);
    const rgb = hexToRgb(accentColor);

    const paperSize = printPrefs.paperSize || 'A4';
    const orientation = printPrefs.orientation || 'Portrait';
    const topMargin = parseInt(printPrefs.topPDFMargin) || 40;
    const companyNameSize = parseInt(printPrefs.companyNameTextSize) || 20;
    const invoiceTextSize = parseInt(printPrefs.invoiceTextSize) || 14;

    const paperSizeMap = { 'A4': [595, 842], 'A5': [420, 595], 'Letter': [612, 792], 'Legal': [612, 1008] };
    const baseSize = paperSizeMap[paperSize] || [595, 842];
    const pageWidth = orientation === 'Landscape' ? baseSize[1] : baseSize[0];
    const pageHeight = orientation === 'Landscape' ? baseSize[0] : baseSize[1];
    const marginLeft = 40;
    const contentWidth = pageWidth - marginLeft - 40;

    const doc = new PDFDocument({
      margin: topMargin,
      size: orientation === 'Landscape' ? [pageHeight, pageWidth] : [pageWidth, pageHeight],
      bufferPages: true,
    });

    res.setHeader('Content-Type', 'application/pdf');
    const safeBillName = (purchase.billNumber || 'purchase').replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="purchase-${safeBillName}.pdf"`);
    doc.pipe(res);

    const bizName = settings?.businessName || 'Your Business';
    const bizAddr = settings?.address || '';
    const bizPhone = settings?.phone || '';
    const bizEmail = settings?.email || '';
    const bizGst = settings?.preferences?.general?.gstin || settings?.gstNumber || '';
    const currency = settings?.currency || '₹';

    let headerY = topMargin;

    if (settings?.logo) {
      const logoPath = path.join(__dirname, '..', settings.logo);
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, marginLeft, headerY, { width: 60 });
      }
    }

    doc.fontSize(companyNameSize).font('Helvetica-Bold').fillColor(accentColor).text(bizName, marginLeft + (settings?.logo ? 70 : 0), headerY);
    doc.fontSize(9).font('Helvetica').fillColor('#000000');
    let detailY = headerY + companyNameSize + 6;
    if (bizAddr) { doc.text(bizAddr, marginLeft + (settings?.logo ? 70 : 0), detailY); detailY += 13; }
    if (bizPhone) { doc.text(`Phone: ${bizPhone}`, marginLeft + (settings?.logo ? 70 : 0), detailY); detailY += 13; }
    if (bizEmail) { doc.text(`Email: ${bizEmail}`, marginLeft + (settings?.logo ? 70 : 0), detailY); detailY += 13; }
    if (bizGst) { doc.text(`GST: ${bizGst}`, marginLeft + (settings?.logo ? 70 : 0), detailY); detailY += 13; }

    if (settings?.invoiceNote) { doc.text(`Note: ${settings.invoiceNote}`, marginLeft + (settings?.logo ? 70 : 0), detailY); detailY += 13; }

    if (settings?.bankName || settings?.bankAccountNumber || settings?.upiId) {
      detailY += 4;
      if (settings?.bankName) { doc.text(`Bank: ${settings.bankName}`, marginLeft + (settings?.logo ? 70 : 0), detailY); detailY += 12; }
      if (settings?.bankAccountNumber) { doc.text(`A/C: ${settings.bankAccountNumber}`, marginLeft + (settings?.logo ? 70 : 0), detailY); detailY += 12; }
      if (settings?.bankIfsc) { doc.text(`IFSC: ${settings.bankIfsc}`, marginLeft + (settings?.logo ? 70 : 0), detailY); detailY += 12; }
      if (settings?.bankBranch) { doc.text(`Branch: ${settings.bankBranch}`, marginLeft + (settings?.logo ? 70 : 0), detailY); detailY += 12; }
      if (settings?.upiId) { doc.text(`UPI: ${settings.upiId}`, marginLeft + (settings?.logo ? 70 : 0), detailY); detailY += 12; }
    }

    doc.fontSize(invoiceTextSize).font('Helvetica-Bold').fillColor(accentColor).text('PURCHASE BILL', marginLeft, detailY + 8);
    doc.fontSize(10).font('Helvetica').fillColor('#000000');

    const infoY = detailY + 8 + invoiceTextSize + 20;
    doc.text(`Bill: ${purchase.billNumber || 'N/A'}`, marginLeft, infoY);
    const purchaseDateStr = settings?.preferences?.transaction?.addTimeOnTransactions !== false
      ? new Date(purchase.date).toLocaleString('en-IN')
      : new Date(purchase.date).toLocaleDateString('en-IN');
    doc.text(`Date: ${purchaseDateStr}`, marginLeft, infoY + 14);
    doc.text(`Supplier: ${purchase.supplierName || 'Unknown'}`, marginLeft, infoY + 28);
    if (purchase.supplierGstin) doc.text(`GSTIN: ${purchase.supplierGstin}`, marginLeft, infoY + 42);

    const hasTax = printPrefs.taxDetails !== false;
    let tableTop = infoY + 60;
    let colPositions, headers;
    if (hasTax) {
      colPositions = [marginLeft, marginLeft + 130, marginLeft + 210, marginLeft + 275, marginLeft + 340, marginLeft + 395, marginLeft + 450];
      headers = ['Product', 'Qty', 'Rate', 'Taxable', 'CGST', 'SGST', 'Total'];
    } else {
      colPositions = [marginLeft, marginLeft + 180, marginLeft + 280, marginLeft + 360, marginLeft + 440];
      headers = ['Product', 'Qty', 'Rate', 'Amount', 'Total'];
    }

    doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000');
    doc.rect(marginLeft - 5, tableTop - 6, contentWidth + 10, 18).fill('#f3f4f6');
    doc.fill('#000000');
    headers.forEach((h, i) => {
      const w = colPositions[i + 1] ? colPositions[i + 1] - colPositions[i] - 5 : 80;
      doc.text(h, colPositions[i], tableTop, { width: w, align: i === 0 ? 'left' : 'right' });
    });

    doc.font('Helvetica').fontSize(9);
    let y = tableTop + 20;
    (purchase.items || []).forEach((item) => {
      if (y > pageHeight - 100) { doc.addPage(); y = topMargin; }
      const name = item.productName + (item.gstRate ? ` (${item.gstRate}%)` : '');
      doc.fillColor('#000000').text(name, marginLeft, y, { width: 120 });
      doc.text(String(item.quantity), colPositions[1], y, { width: 70, align: 'right' });
      doc.text(formatAmount(item.rate, printPrefs, currency), colPositions[2], y, { width: 70, align: 'right' });
      if (hasTax) {
        doc.text(formatAmount(item.taxableAmount || item.rate * item.quantity, printPrefs, currency), colPositions[3], y, { width: 60, align: 'right' });
        doc.text(formatAmount(item.cgst || 0, printPrefs, currency), colPositions[4], y, { width: 50, align: 'right' });
        doc.text(formatAmount(item.sgst || 0, printPrefs, currency), colPositions[5], y, { width: 50, align: 'right' });
      }
      doc.text(formatAmount(item.amount, printPrefs, currency), colPositions[hasTax ? 6 : 4], y, { width: 60, align: 'right' });
      y += 16;
    });

    y += 8;
    doc.moveTo(marginLeft - 5, y).lineTo(marginLeft + contentWidth + 5, y).stroke();
    y += 6;

    const totals = [];
    totals.push({ label: 'Taxable Amount', value: purchase.taxableAmount || purchase.totalAmount });
    if (hasTax) {
      if (purchase.cgstTotal) totals.push({ label: 'CGST', value: purchase.cgstTotal });
      if (purchase.sgstTotal) totals.push({ label: 'SGST', value: purchase.sgstTotal });
      if (purchase.igstTotal) totals.push({ label: 'IGST', value: purchase.igstTotal });
    }

    totals.forEach((t) => {
      doc.font('Helvetica').fontSize(10).fillColor('#000000');
      doc.text(t.label, marginLeft + 310, y);
      doc.text(formatAmount(t.value, printPrefs, currency), marginLeft + contentWidth - 50, y, { width: 60, align: 'right' });
      y += 16;
    });

    doc.moveTo(marginLeft + 310, y).lineTo(marginLeft + contentWidth + 5, y).stroke();
    y += 6;
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#000000');
    doc.text('Grand Total:', marginLeft + 310, y);
    doc.text(formatAmount(purchase.totalAmount, printPrefs, currency), marginLeft + contentWidth - 50, y, { width: 60, align: 'right' });
    y += 20;

    if (printPrefs.amountInWords !== false) {
      doc.font('Helvetica-Oblique').fontSize(9).fillColor('#666666');
      doc.text(`Rupees ${numberToWords(purchase.totalAmount)}`, marginLeft, y, { width: contentWidth });
      y += 14;
    }

    doc.font('Helvetica').fontSize(10).fillColor('#000000');
    doc.text(`Paid: ${formatAmount(purchase.paidAmount || 0, printPrefs, currency)}`, marginLeft, y);
    y += 14;

    if (printPrefs.balanceAmount !== false) {
      doc.text(`Balance: ${formatAmount(purchase.remainingBalance || purchase.totalAmount, printPrefs, currency)}`, marginLeft, y);
      y += 14;
    }

    doc.text(`Status: ${(purchase.paymentStatus || 'unpaid').toUpperCase()}`, marginLeft, y);
    y += 14;

    if (printPrefs.footerSettings !== false) {
      if (printPrefs.receivedBy !== false || printPrefs.deliveredBy !== false || printPrefs.signature !== false) {
        y += 10;
        const footerY = y;
        if (printPrefs.receivedBy !== false) {
          doc.font('Helvetica').fontSize(9).fillColor('#000000').text('Received By: _________________', marginLeft, footerY);
        }
        if (printPrefs.deliveredBy !== false) {
          doc.text('Delivered By: _________________', marginLeft + 200, footerY);
        }
        if (printPrefs.signature !== false) {
          const sigY = footerY - 5;
          if (settings?.signature) {
            const sigPath = path.join(__dirname, '..', settings.signature);
            if (fs.existsSync(sigPath)) {
              doc.image(sigPath, marginLeft + 420, sigY, { width: 80, height: 30 });
              doc.text('Authorized Signature', marginLeft + 420, sigY + 35, { width: 120, align: 'right' });
            } else {
              doc.text('Authorized Signature', marginLeft + 420, footerY, { width: 120, align: 'right' });
            }
          } else {
            doc.text('Authorized Signature', marginLeft + 420, footerY, { width: 120, align: 'right' });
          }
        }
        y = footerY + 30;
      }
      if (printPrefs.acknowledgement !== false) {
        doc.font('Helvetica-Oblique').fontSize(8).fillColor('#888888').text('Acknowledgement: This is a computer-generated purchase bill.', marginLeft, y, { width: contentWidth });
      }
    }

    try {
      const qrData = JSON.stringify({
        gstin: bizGst,
        billNo: purchase.billNumber || purchase._id,
        date: new Date(purchase.date).toISOString().split('T')[0],
        totalAmount: purchase.totalAmount || 0,
      });
      const qrBuffer = await QRCode.toBuffer(qrData, { width: 100, margin: 2 });
      doc.image(qrBuffer, marginLeft, y + 10, { width: 70 });
    } catch (qrErr) {}

    doc.end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { generateInvoicePDF, generatePurchasePDF };
