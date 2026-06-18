const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const Sale = require('../models/Sale');
const Setting = require('../models/Setting');
const path = require('path');
const fs = require('fs');
const { getBaseFilter, getSettingQuery } = require('../utils/queryHelper');

const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 37, g: 99, b: 235 };
};

const formatAmount = (amount, printPrefs, currency) => {
  const val = Number(amount) || 0;
  const decimals = printPrefs.showAmountDecimal === false
    ? 0
    : parseInt(printPrefs.amountDecimalPlaces) || parseInt(printPrefs._generalDecimalPlaces) || 2;
  if (printPrefs.printAmountWithGrouping === false) {
    return `${currency || '₹'}${val.toFixed(decimals)}`;
  }
  return `${currency || '₹'}${val.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
};

// Distinct accent/style per thermal theme so the choice has a real visual effect.
const thermalThemeStyles = {
  thermalTheme1: { accent: '#000000', bold: true, line: 'solid' },
  thermalTheme2: { accent: '#1a5276', bold: false, line: 'dashed' },
  thermalTheme3: { accent: '#000000', bold: false, line: 'dotted' },
  thermalTheme4: { accent: '#1B4332', bold: true, line: 'dashed' },
};

const getThermalThemeStyle = (printPrefs) => {
  if (printPrefs.thermalTheme2) return thermalThemeStyles.thermalTheme2;
  if (printPrefs.thermalTheme3) return thermalThemeStyles.thermalTheme3;
  if (printPrefs.thermalTheme4) return thermalThemeStyles.thermalTheme4;
  return thermalThemeStyles.thermalTheme1;
};

const getThemeColor = (printPrefs) => {
  const isThermal = (printPrefs.printerType === 'thermal') || (printPrefs.makeThermalDefault && !printPrefs.printerType);
  if (isThermal) return getThermalThemeStyle(printPrefs).accent;
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

const getThermalPageSize = (thermalPageSize, thermalCustomChars) => {
  if (thermalPageSize === 'custom') {
    // ~5pt per character column; matches the client preview's char->width mapping.
    const chars = parseInt(thermalCustomChars) || 48;
    return [Math.max(120, chars * 5), 500];
  }
  const sizeMap = {
    '2inch': [200, 500],
    '3inch': [250, 500],
    '4inch': [300, 500],
  };
  return sizeMap[thermalPageSize] || [250, 500];
};

// Number of monospace character columns for a thermal paper size.
const getThermalCharWidth = (printPrefs) => {
  if (printPrefs.thermalPageSize === 'custom') return parseInt(printPrefs.thermalCustomChars) || 48;
  const map = { '2inch': 32, '3inch': 42, '4inch': 56 };
  return map[printPrefs.thermalPageSize] || 42;
};

// ESC/POS control sequences. No-ops on plain paper but real on a thermal printer stream.
const ESC_POS = {
  cutPaper: Buffer.from([0x1d, 0x56, 0x00]),            // GS V 0  -> full cut
  openDrawer: Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]), // ESC p 0 25 250 -> kick drawer
  bold: (on) => Buffer.from([0x1b, 0x45, on ? 0x01 : 0x00]), // ESC E n
};

// Build a plain monospace (Text Printing) thermal receipt with optional ESC/POS controls.
const buildThermalTextReceipt = (sale, settings, printPrefs, currency) => {
  const width = getThermalCharWidth(printPrefs);
  const useStyling = printPrefs.useTextStyling === true;
  const parts = [];
  const line = (s = '') => parts.push(Buffer.from(s + '\n', 'utf8'));
  const center = (s) => line(s.length >= width ? s : ' '.repeat(Math.floor((width - s.length) / 2)) + s);
  const sep = (ch = '-') => line(ch.repeat(width));
  const lr = (l, r) => {
    const space = Math.max(1, width - l.length - r.length);
    return line(l + ' '.repeat(space) + r);
  };
  const bold = (on) => { if (useStyling) parts.push(ESC_POS.bold(on)); };

  bold(true);
  if (printPrefs.showCompanyName !== false) center(settings?.businessName || 'Your Business');
  bold(false);
  if (printPrefs.showAddress !== false && settings?.address) center(settings.address);
  if (printPrefs.showPhone !== false && settings?.phone) center(`Ph.No.: ${settings.phone}`);
  if (printPrefs.showEmail !== false && settings?.email) center(settings.email);
  const bizGst = settings?.preferences?.general?.gstin || settings?.gstNumber || '';
  if (printPrefs.showGSTIN !== false && bizGst) center(`GST: ${bizGst}`);
  sep('=');
  bold(true);
  center('TAX INVOICE');
  bold(false);
  sep();
  line(`Invoice: ${sale.invoiceNumber}`);
  line(`Date: ${new Date(sale.date).toLocaleDateString('en-IN')}`);
  line(`Customer: ${sale.customerName || 'Walk-in'}`);
  sep();

  const showSNo = printPrefs.showItemSNo !== false;
  const showHSN = printPrefs.showItemHSN !== false;
  const showUOM = printPrefs.showItemUOM !== false;
  bold(true);
  lr(`${showSNo ? '# ' : ''}Item`, 'Qty   Amount');
  bold(false);
  sale.items.forEach((item, idx) => {
    let name = `${showSNo ? (idx + 1) + ' ' : ''}${item.productName}`;
    if (showHSN && item.hsn) name += ` (${item.hsn})`;
    line(name);
    const qty = `${item.quantity}${showUOM && item.unit ? item.unit : ''}`;
    lr('  ', `${qty}  ${formatAmount(item.amount, printPrefs, currency)}`);
  });
  sep();
  bold(true);
  lr('Total', formatAmount(sale.totalAmount, printPrefs, currency));
  bold(false);
  if (printPrefs.receivedAmount !== false) lr('Received', formatAmount(sale.paidAmount || 0, printPrefs, currency));
  if (printPrefs.balanceAmount !== false) lr('Balance', formatAmount(sale.remainingBalance || 0, printPrefs, currency));
  sep('=');
  center('Thank you for your business!');

  const extraLines = parseInt(printPrefs.extraLinesAtEnd) || 0;
  for (let i = 0; i < extraLines; i++) line('');

  // Trailing ESC/POS device controls.
  if (printPrefs.autoCutPaper === true) parts.push(ESC_POS.cutPaper);
  if (printPrefs.openCashDrawer === true) parts.push(ESC_POS.openDrawer);

  return Buffer.concat(parts);
};

const generateInvoicePDF = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    // Preview mode (from the Settings → Print live preview) injects a sample sale and
    // the live (possibly unsaved) settings so the preview is rendered by THIS exact
    // engine — guaranteeing it matches the real printed invoice.
    let sale, settings;
    if (req.previewMode) {
      sale = req.previewSale;
      settings = req.previewSettings;
    } else {
      sale = await Sale.findOne({ _id: req.params.id, ...baseFilter });
      if (!sale) return res.status(404).json({ message: 'Sale not found' });
      settings = await Setting.findOne(getSettingQuery(req));
    }
    const printPrefs = settings?.preferences?.print || {};
    printPrefs._generalDecimalPlaces = settings?.preferences?.general?.amountDecimalPlaces;
    const showYouSaved = printPrefs.youSaved !== false;
    const accentColor = getThemeColor(printPrefs);
    const rgb = hexToRgb(accentColor);

    const paperSize = printPrefs.paperSize || 'A4';
    const orientation = printPrefs.orientation || 'Portrait';
    const topMargin = parseInt(printPrefs.topPDFMargin) || 40;
    const companyNameSize = parseInt(printPrefs.companyNameTextSize) || 20;
    const invoiceTextSize = parseInt(printPrefs.invoiceTextSize) || 14;
    // makeThermalDefault: when set and no explicit printerType chosen, default to thermal layout.
    const printerType = printPrefs.printerType || (printPrefs.makeThermalDefault ? 'thermal' : 'regular');
    const decimals = printPrefs.showAmountDecimal === false ? 0 : (parseInt(printPrefs.amountDecimalPlaces) || parseInt(printPrefs._generalDecimalPlaces) || 2);
    // Number of identical copies of the invoice to render (clamped to a sane 1-5 range).
    const numberOfCopies = Math.min(5, Math.max(1, parseInt(printPrefs.numberOfCopies) || 1));

    let pageWidth, pageHeight;
    if (printerType === 'thermal') {
      const thermalSize = getThermalPageSize(printPrefs.thermalPageSize, printPrefs.thermalCustomChars);
      pageWidth = thermalSize[0];
      pageHeight = thermalSize[1];
    } else {
      const sizeMap = { 'A4': [595, 842], 'A5': [420, 595], 'Letter': [612, 792], 'Legal': [612, 1008] };
      const baseSize = sizeMap[paperSize] || [595, 842];
      pageWidth = orientation === 'Landscape' ? baseSize[1] : baseSize[0];
      pageHeight = orientation === 'Landscape' ? baseSize[0] : baseSize[1];
    }
    const marginLeft = printerType === 'thermal' ? 15 : 40;
    const marginRight = printerType === 'thermal' ? 15 : 40;
    const contentWidth = pageWidth - marginLeft - marginRight;

    // Text Printing on a thermal printer: emit a raw monospace receipt with ESC/POS
    // device controls instead of a styled PDF (which is the Graphics Printing path below).
    const currencyEarly = settings?.preferences?.general?.businessCurrency || settings?.currency || '₹';
    if (printerType === 'thermal' && printPrefs.printingType === 'Text Printing') {
      const receipt = buildThermalTextReceipt(sale, settings, printPrefs, currencyEarly);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      const safeName = (sale.invoiceNumber || 'invoice').replace(/[^a-zA-Z0-9_-]/g, '_');
      res.setHeader('Content-Disposition', `${req.previewMode ? 'inline' : 'attachment'}; filename="${safeName}.txt"`);
      return res.send(receipt);
    }

    const doc = new PDFDocument({
      margin: topMargin,
      size: orientation === 'Landscape' ? [pageHeight, pageWidth] : [pageWidth, pageHeight],
      bufferPages: true,
    });

    res.setHeader('Content-Type', 'application/pdf');
    const safeInvoiceName = (sale.invoiceNumber || 'invoice').replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Disposition', `${req.previewMode ? 'inline' : 'attachment'}; filename="${safeInvoiceName}.pdf"`);
    doc.pipe(res);

    // Render the invoice once per requested copy. Each additional copy starts on a fresh
    // page so the printout contains numberOfCopies identical invoices.
    for (let copy = 0; copy < numberOfCopies; copy++) {
    if (copy > 0) doc.addPage();

    const bizName = settings?.businessName || 'Your Business';
    const bizAddr = settings?.address || '';
    const bizPhone = settings?.phone || '';
    const bizEmail = settings?.email || '';
    const bizGst = settings?.preferences?.general?.gstin || settings?.gstNumber || '';
    const currency = settings?.preferences?.general?.businessCurrency || settings?.currency || '₹';

    const isThermal = printerType === 'thermal';
    const showCompanyName = isThermal ? printPrefs.showCompanyName !== false : true;
    const showCompanyLogo = isThermal ? printPrefs.showCompanyLogo !== false : true;
    const showAddress = isThermal ? printPrefs.showAddress !== false : true;
    const showEmail = isThermal ? printPrefs.showEmail !== false : true;
    const showPhone = isThermal ? printPrefs.showPhone !== false : true;
    const showGSTIN = isThermal ? printPrefs.showGSTIN !== false : true;
    const thermalStyle = getThermalThemeStyle(printPrefs);
    const emphasizeThermal = isThermal && (printPrefs.useTextStyling === true || thermalStyle.bold);
    const showItemSNo = isThermal ? printPrefs.showItemSNo !== false : printPrefs.showItemSNo !== false;
    const showItemHSN = isThermal ? printPrefs.showItemHSN !== false : printPrefs.showItemHSN !== false;
    const showItemUOM = isThermal ? printPrefs.showItemUOM !== false : printPrefs.showItemUOM !== false;
    const showItemMRP = isThermal ? printPrefs.showItemMRP !== false : true;
    const showItemDescription = isThermal ? printPrefs.showItemDescription !== false : printPrefs.printDescription !== false;
    // Item-detail toggles are honored in both thermal and regular/A4 mode using the same
    // setting keys. In regular mode they are opt-in (default off) so the A4 layout stays
    // compact unless the user explicitly enables a column/field.
    const showBatchNo = isThermal ? printPrefs.showBatchNo !== false : printPrefs.showBatchNo === true;
    const showExpDate = isThermal ? printPrefs.showExpDate !== false : printPrefs.showExpDate === true;
    const showMfgDate = isThermal ? printPrefs.showMfgDate !== false : printPrefs.showMfgDate === true;
    const showSize = isThermal ? printPrefs.showSize !== false : printPrefs.showSize === true;
    const showModelNo = isThermal ? printPrefs.showModelNo !== false : printPrefs.showModelNo === true;
    const showSerialNo = isThermal ? printPrefs.showSerialNo !== false : printPrefs.showSerialNo === true;
    const showTotalItemQty = isThermal ? printPrefs.showTotalItemQty !== false : true;
    const showAmountDecimal = isThermal ? printPrefs.showAmountDecimal !== false : true;
    const showReceivedAmount = isThermal ? printPrefs.receivedAmount !== false : true;
    const showBalanceAmount = printPrefs.balanceAmount !== false;
    const showCurrentBalance = printPrefs.currentBalance !== false;
    const showBankDetails = printPrefs.showBankDetails !== false;
    const showQRCode = printPrefs.showQRCode !== false;
    const showPartyPhone = printPrefs.showPartyPhone !== false;
    const showPartyGSTIN = printPrefs.showPartyGSTIN !== false;
    const showPartyAddress = printPrefs.showPartyAddress !== false;
    const showTransportDetails = printPrefs.showTransportDetails !== false;

    let headerY = topMargin;

    if (showCompanyLogo && settings?.logo) {
      const logoRel = settings.logo.startsWith('/') ? settings.logo.substring(1) : settings.logo;
      const logoPath = path.join(__dirname, '..', logoRel);
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, marginLeft, headerY, { width: isThermal ? 40 : 60 });
        if (isThermal) {
          headerY += 45;
        }
      }
    }

    const companyNameX = marginLeft + (showCompanyLogo && settings?.logo && !isThermal ? 70 : 0);
    if (showCompanyName) {
      doc.fontSize(isThermal ? 12 : companyNameSize).font('Helvetica-Bold').fillColor(accentColor).text(bizName, companyNameX, headerY);
      headerY += isThermal ? 14 : companyNameSize + 6;
    }

    doc.fontSize(isThermal ? 8 : 9).font('Helvetica').fillColor('#000000');
    if (showAddress && bizAddr) { doc.text(bizAddr, companyNameX, headerY); headerY += isThermal ? 10 : 13; }
    if (showPhone && bizPhone) { doc.text(isThermal ? `Ph.No.: ${bizPhone}` : `Phone: ${bizPhone}`, companyNameX, headerY); headerY += isThermal ? 10 : 13; }
    if (showEmail && bizEmail) { doc.text(`Email: ${bizEmail}`, companyNameX, headerY); headerY += isThermal ? 10 : 13; }
    if (showGSTIN && bizGst) { doc.text(`GST: ${bizGst}`, companyNameX, headerY); headerY += isThermal ? 10 : 13; }

    if (!isThermal && settings?.invoiceNote) { doc.text(`Note: ${settings.invoiceNote}`, companyNameX, headerY); headerY += 13; }

    if (!isThermal && showBankDetails && (settings?.bankName || settings?.bankAccountNumber || settings?.upiId)) {
      headerY += 4;
      if (settings?.bankName) { doc.text(`Bank: ${settings.bankName}`, companyNameX, headerY); headerY += 12; }
      if (settings?.bankAccountNumber) { doc.text(`A/C: ${settings.bankAccountNumber}`, companyNameX, headerY); headerY += 12; }
      if (settings?.bankIfsc) { doc.text(`IFSC: ${settings.bankIfsc}`, companyNameX, headerY); headerY += 12; }
      if (settings?.bankBranch) { doc.text(`Branch: ${settings.bankBranch}`, companyNameX, headerY); headerY += 12; }
      if (settings?.upiId) { doc.text(`UPI: ${settings.upiId}`, companyNameX, headerY); headerY += 12; }
    }

    doc.moveTo(marginLeft, headerY + 4).lineTo(pageWidth - marginRight, headerY + 4).dash(3, { space: 3 }).stroke().undash();
    headerY += 10;

    const docTypeLabel = sale.type === 'invoice' ? 'TAX INVOICE' : sale.type === 'estimate' ? 'ESTIMATE' : sale.type === 'quotation' ? 'QUOTATION' : sale.type === 'proforma' ? 'PROFORMA INVOICE' : sale.type === 'order' ? 'SALE ORDER' : sale.type === 'challan' ? 'DELIVERY CHALLAN' : sale.type === 'credit_note' ? 'CREDIT NOTE' : 'DOCUMENT';
    doc.fontSize(isThermal ? 10 : invoiceTextSize).font('Helvetica-Bold').fillColor(accentColor).text(docTypeLabel, marginLeft, headerY, { align: 'center', width: contentWidth });
    headerY += (isThermal ? 12 : invoiceTextSize) + 6;

    if (!isThermal && printPrefs.printOriginalDuplicate && printPrefs.printOriginalDuplicate !== 'Original') {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000').text(printPrefs.printOriginalDuplicate.toUpperCase(), marginLeft, headerY, { align: 'right', width: contentWidth });
      headerY += 14;
    }

    doc.moveTo(marginLeft, headerY + 2).lineTo(pageWidth - marginRight, headerY + 2).dash(3, { space: 3 }).stroke().undash();
    headerY += 8;

    doc.fontSize(isThermal ? 8 : 10).font('Helvetica').fillColor('#000000');
    doc.text(`Invoice: ${sale.invoiceNumber}`, marginLeft, headerY);
    const saleDateStr = settings?.preferences?.transaction?.addTimeOnTransactions !== false
      ? new Date(sale.date).toLocaleString('en-IN')
      : new Date(sale.date).toLocaleDateString('en-IN');
    doc.text(`Date: ${saleDateStr}`, marginLeft, headerY + (isThermal ? 10 : 14));
    doc.text(`Customer: ${sale.customerName || 'Walk-in'}`, marginLeft, headerY + (isThermal ? 20 : 28));

    let partyInfoY = headerY + (isThermal ? 30 : 42);
    if (!isThermal) {
      if (showPartyPhone && sale.customerPhone) {
        doc.text(`Phone: ${sale.customerPhone}`, marginLeft, partyInfoY);
        partyInfoY += 13;
      }
      if (showPartyGSTIN && sale.customerGst) {
        doc.text(`GSTIN: ${sale.customerGst}`, marginLeft, partyInfoY);
        partyInfoY += 13;
      }
      if (showPartyAddress && sale.billingAddress) {
        doc.text(`Address: ${sale.billingAddress}`, marginLeft, partyInfoY, { width: contentWidth });
        partyInfoY += 13;
      }
    }

    if (!isThermal && settings?.preferences?.party?.printShippingAddress !== false && sale.shippingAddress) {
      doc.text(`Ship To: ${typeof sale.shippingAddress === 'string' ? sale.shippingAddress : sale.shippingAddress.address || sale.shippingAddress.fullAddress || ''}`, marginLeft, headerY + 42);
    }

    if (!isThermal && showTransportDetails && (sale.transportMode || sale.vehicleNo)) {
      let transportY = headerY + (isThermal ? 24 : 56);
      if (sale.transportMode) { doc.text(`Transport: ${sale.transportMode}`, marginLeft, transportY); transportY += 13; }
      if (sale.vehicleNo) { doc.text(`Vehicle: ${sale.vehicleNo}`, marginLeft, transportY); transportY += 13; }
    }

    let tableTop = headerY + (isThermal ? 32 : 55);
    const hasTax = printPrefs.taxDetails !== false;

    if (isThermal) {
      doc.fontSize(8).font('Helvetica-Bold').fillColor(accentColor);
      const colW = contentWidth;
      const nameX = showItemSNo ? marginLeft + 15 : marginLeft;
      if (showItemSNo) doc.text('#', marginLeft, tableTop, { width: 15 });
      doc.text(showItemHSN ? 'Item Name(HSN)' : 'Item Name', nameX, tableTop, { width: colW - 80 });
      doc.text('Qty', marginLeft + colW - 65, tableTop, { width: 25, align: 'right' });
      if (showItemMRP) doc.text('MRP', marginLeft + colW - 40, tableTop, { width: 25, align: 'right' });
      doc.text('Price', marginLeft + colW - 15, tableTop, { width: 25, align: 'right' });
      doc.text('Amount', marginLeft, tableTop + 10, { width: colW, align: 'right' });
      tableTop += 18;
    } else {
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
      tableTop += 18;
    }

    doc.font('Helvetica').fontSize(isThermal ? 8 : 9);
    let y = tableTop;
    const showAmount = sale.type !== 'challan' || settings?.preferences?.general?.printAmountOnDC !== false;
    sale.items.forEach((item, idx) => {
      if (y > pageHeight - 100) {
        doc.addPage();
        y = topMargin;
      }
      if (isThermal) {
        const snoPrefix = showItemSNo ? `${idx + 1}. ` : '';
        const hsnSuffix = (showItemHSN && item.hsn) ? ` (${item.hsn})` : '';
        const name = snoPrefix + item.productName + hsnSuffix + (item.gstRate ? ` (${item.gstRate}%)` : '') + ((showSerialNo && item.serialNo) ? ` [${item.serialNo}]` : '');
        const qtyText = String(item.quantity) + (showItemUOM && item.unit ? ` ${item.unit}` : '');
        doc.fillColor('#000000').text(name, marginLeft, y, { width: contentWidth - 80 });
        doc.text(qtyText, marginLeft + contentWidth - 65, y, { width: 25, align: 'right' });
        if (showItemMRP) doc.text(formatAmount(item.rate, printPrefs, currency), marginLeft + contentWidth - 40, y, { width: 25, align: 'right' });
        if (showAmount) {
          doc.text(formatAmount(item.rate, printPrefs, currency), marginLeft + contentWidth - 15, y, { width: 25, align: 'right' });
        }
        y += 10;
        if (showItemDescription && item.description) {
          doc.fontSize(7).font('Helvetica-Oblique').fillColor('#666666').text(item.description, marginLeft + 5, y, { width: contentWidth - 10 });
          y += 9;
          doc.font('Helvetica').fillColor('#000000');
        }
        const metaParts = [];
        if (showSerialNo && item.serialNo) metaParts.push(`S/N: ${item.serialNo}`);
        if (item.discountType && item.discountType !== 'none' && item.discountAmount) {
          metaParts.push(`Disc: ${formatAmount(item.discountAmount, printPrefs, currency)}`);
        }
        if (showBatchNo && item.batchNumber) metaParts.push(`Batch: ${item.batchNumber}`);
        if (showModelNo && item.modelNumber) metaParts.push(`Model: ${item.modelNumber}`);
        if (showExpDate && item.expiryDate) metaParts.push(`Exp: ${new Date(item.expiryDate).toLocaleDateString('en-IN')}`);
        if (showMfgDate && item.manufacturingDate) metaParts.push(`Mfg: ${new Date(item.manufacturingDate).toLocaleDateString('en-IN')}`);
        if (showSize && item.size) metaParts.push(`Size: ${item.size}`);
        if (metaParts.length > 0) {
          doc.fontSize(7).fillColor('#666666').text(metaParts.join(', '), marginLeft + 5, y, { width: contentWidth - 10 });
          y += 9;
          doc.fillColor('#000000');
        }
        doc.fontSize(8);
      } else {
        const snoPrefix = showItemSNo ? `${idx + 1}. ` : '';
        const hsnSuffix = (showItemHSN && item.hsn) ? ` HSN:${item.hsn}` : '';
        const name = snoPrefix + item.productName + (item.gstRate ? ` (${item.gstRate}%)` : '') + hsnSuffix;
        const serialInfo = (showSerialNo && item.serialNo) ? ` [${item.serialNo}]` : '';
        doc.fillColor('#000000').text(name + serialInfo, marginLeft, y, { width: 120 });
        const qtyText = String(item.quantity) + (showItemUOM && item.unit ? ` ${item.unit}` : '');
        doc.text(qtyText, (hasTax ? marginLeft + 210 : marginLeft + 180), y, { width: 70, align: 'right' });
        if (showAmount) {
          doc.text(formatAmount(item.rate, printPrefs, currency), (hasTax ? marginLeft + 275 : marginLeft + 280), y, { width: 60, align: 'right' });
          if (item.discountType && item.discountType !== 'none' && item.discountAmount) {
            doc.text(`-${formatAmount(item.discountAmount, printPrefs, currency)}`, (hasTax ? marginLeft + 275 : marginLeft + 280), y + 10, { width: 60, align: 'right' });
          }
          if (hasTax) {
            doc.text(formatAmount(item.taxableAmount || item.amount, printPrefs, currency), marginLeft + 340, y, { width: 50, align: 'right' });
            doc.text(formatAmount(item.cgst || 0, printPrefs, currency), marginLeft + 395, y, { width: 50, align: 'right' });
            doc.text(formatAmount(item.sgst || 0, printPrefs, currency), marginLeft + 450, y, { width: 50, align: 'right' });
          }
          doc.text(formatAmount(item.amount, printPrefs, currency), marginLeft + (hasTax ? 500 : 360), y, { width: 60, align: 'right' });
        }
        // Optional per-item details (batch/model/exp/mfg/size) shown as a sub-line under
        // the product name when their respective toggles are enabled.
        const metaParts = [];
        if (showBatchNo && item.batchNumber) metaParts.push(`Batch: ${item.batchNumber}`);
        if (showModelNo && item.modelNumber) metaParts.push(`Model: ${item.modelNumber}`);
        if (showExpDate && item.expiryDate) metaParts.push(`Exp: ${new Date(item.expiryDate).toLocaleDateString('en-IN')}`);
        if (showMfgDate && item.manufacturingDate) metaParts.push(`Mfg: ${new Date(item.manufacturingDate).toLocaleDateString('en-IN')}`);
        if (showSize && item.size) metaParts.push(`Size: ${item.size}`);
        if (metaParts.length > 0) {
          y += 11;
          doc.font('Helvetica-Oblique').fontSize(7).fillColor('#666666').text(metaParts.join(', '), marginLeft, y, { width: 120 });
          doc.font('Helvetica').fontSize(9).fillColor('#000000');
        }
      }
      y += isThermal ? 4 : 16;
    });

    y += 6;
    doc.moveTo(marginLeft, y).lineTo(pageWidth - marginRight, y).dash(3, { space: 3 }).stroke().undash();
    y += 6;

    if (sale.additionalField1 || sale.additionalField2) {
      y += 10;
      doc.fontSize(9).fillColor('#374151');
      const label1 = printPrefs.additionalField1Label || 'Additional Field 1';
      const label2 = printPrefs.additionalField2Label || 'Additional Field 2';
      if (sale.additionalField1) {
        doc.text(`${label1}: ${sale.additionalField1}`, marginLeft, y);
        y += 15;
      }
      if (sale.additionalField2) {
        doc.text(`${label2}: ${sale.additionalField2}`, marginLeft, y);
        y += 15;
      }
    }

    if (isThermal) {
      const totalQty = sale.items.reduce((s, i) => s + (i.quantity || 0), 0);
      if (showTotalItemQty) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000');
        doc.text(`Qty: ${totalQty} + ${sale.items.length}`, marginLeft, y, { width: contentWidth / 2 });
        doc.text(formatAmount(sale.totalAmount, printPrefs, currency), marginLeft, y, { width: contentWidth, align: 'right' });
        y += 12;
      }

      doc.font('Helvetica').fontSize(8).fillColor('#000000');
      if (sale.discountOnInvoice) {
        doc.text(`Disc.(${sale.discountOnInvoice}%):`, marginLeft, y, { width: contentWidth / 2 });
        doc.text(`-${formatAmount(sale.discountOnInvoice, printPrefs, currency)}`, marginLeft, y, { width: contentWidth, align: 'right' });
        y += 10;
      }
      const taxTotal = (sale.cgstTotal || 0) + (sale.sgstTotal || 0) + (sale.igstTotal || 0);
      if (hasTax && taxTotal > 0) {
        doc.text(`Tax(${sale.cgstTotal ? 'CGST+SGST' : 'IGST'}):`, marginLeft, y, { width: contentWidth / 2 });
        doc.text(formatAmount(taxTotal, printPrefs, currency), marginLeft, y, { width: contentWidth, align: 'right' });
        y += 10;
      }

      doc.moveTo(marginLeft, y).lineTo(pageWidth - marginRight, y).dash(3, { space: 3 }).stroke().undash();
      y += 6;
      doc.font(emphasizeThermal ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor(accentColor);
      doc.text('Total', marginLeft, y, { width: contentWidth / 2 });
      doc.text(formatAmount(sale.totalAmount, printPrefs, currency), marginLeft, y, { width: contentWidth, align: 'right' });
      y += 14;

      if (showReceivedAmount) {
        doc.font('Helvetica').fontSize(8).fillColor('#000000');
        doc.text('Received', marginLeft, y, { width: contentWidth / 2 });
        doc.text(formatAmount(sale.paidAmount || 0, printPrefs, currency), marginLeft, y, { width: contentWidth, align: 'right' });
        y += 10;
      }
      if (showBalanceAmount) {
        doc.text('Balance', marginLeft, y, { width: contentWidth / 2 });
        doc.text(formatAmount(sale.remainingBalance || 0, printPrefs, currency), marginLeft, y, { width: contentWidth, align: 'right' });
        y += 10;
      }
      if (showCurrentBalance && sale.customer) {
        doc.text(`Status: ${sale.paymentStatus.toUpperCase()}`, marginLeft, y, { width: contentWidth });
        y += 10;
      }
    } else {
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

      if (showReceivedAmount) {
        doc.font('Helvetica').fontSize(10).fillColor('#000000');
        doc.text(`Paid: ${formatAmount(sale.paidAmount, printPrefs, currency)}`, marginLeft, y);
        y += 14;
      }
      if (showBalanceAmount) {
        doc.text(`Balance: ${formatAmount(sale.remainingBalance, printPrefs, currency)}`, marginLeft, y);
        y += 14;
      }
      if (showCurrentBalance && sale.customer) {
        doc.text(`Status: ${sale.paymentStatus.toUpperCase()}`, marginLeft, y);
        y += 14;
      }
    }

    const discountAmount = sale.discountOnInvoice || 0;
    if (showYouSaved && discountAmount > 0) {
      y += isThermal ? 4 : 20;
      doc.fontSize(isThermal ? 8 : 11).fillColor('#16a34a')
        .text(`You saved: ${currency}${discountAmount.toFixed(decimals)}`, marginLeft, y, { align: isThermal ? 'left' : 'right', width: contentWidth });
      y += isThermal ? 10 : 10;
    }

    if (printPrefs.amountInWords !== false) {
      doc.font('Helvetica-Oblique').fontSize(isThermal ? 7 : 9).fillColor('#666666');
      const wordsFormat = printPrefs.amountInWordsFormat || 'Indian';
      const amountWords = wordsFormat === 'Indian' ? `Rupees ${numberToWords(sale.totalAmount)}` : `Total: ${currency}${sale.totalAmount.toFixed(decimals)}`;
      doc.text(amountWords, marginLeft, y, { width: contentWidth });
      y += isThermal ? 10 : 14;
    }

    if (!isThermal && printPrefs.paymentMode !== false && sale.payments && sale.payments.length > 0) {
      const modes = [...new Set(sale.payments.map(p => p.mode).filter(Boolean))].join(', ');
      if (modes) {
        doc.font('Helvetica').fontSize(10).fillColor('#000000');
        doc.text(`Payment Mode: ${modes}`, marginLeft, y);
        y += 14;
      }
    }

    if (!isThermal && printPrefs.termsConditions !== false && sale.termsConditions) {
      y += 6;
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000').text('Terms & Conditions:', marginLeft, y);
      y += 12;
      doc.font('Helvetica').fontSize(8).fillColor('#444444').text(sale.termsConditions, marginLeft, y, { width: contentWidth });
      y += Math.ceil(sale.termsConditions.length / 80) * 12 + 6;
    }

    if (!isThermal && settings?.invoiceNote) {
      y += 6;
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000').text('Note:', marginLeft, y);
      y += 12;
      doc.font('Helvetica').fontSize(8).fillColor('#444444').text(settings.invoiceNote, marginLeft, y, { width: contentWidth });
      y += Math.ceil(settings.invoiceNote.length / 80) * 12 + 6;
    }

    if (isThermal) {
      doc.moveTo(marginLeft, y).lineTo(pageWidth - marginRight, y).dash(3, { space: 3 }).stroke().undash();
      y += 6;

      if (printPrefs.termsConditions !== false) {
        doc.font('Helvetica').fontSize(7).fillColor('#666666').text('Terms & Conditions apply', marginLeft, y, { width: contentWidth, align: 'center' });
        y += 10;
      }
      if (printPrefs.printDescription !== false) {
        doc.fontSize(7).fillColor('#666666').text('Thank you for your business!', marginLeft, y, { width: contentWidth, align: 'center' });
        y += 10;
      }

      const extraLines = parseInt(printPrefs.extraLinesAtEnd) || 0;
      for (let i = 0; i < extraLines; i++) {
        doc.text('', marginLeft, y);
        y += 10;
      }
    } else {
      if (printPrefs.footerSettings && printPrefs.footerSettings !== '') {
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
              const sigRel = settings.signature.startsWith('/') ? settings.signature.substring(1) : settings.signature;
              const sigPath = path.join(__dirname, '..', sigRel);
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
        if (printPrefs.footerSettings && typeof printPrefs.footerSettings === 'string' && printPrefs.footerSettings.length > 0) {
          doc.font('Helvetica-Oblique').fontSize(8).fillColor('#666666')
            .text(printPrefs.footerSettings, marginLeft, y, { width: contentWidth, align: 'center' });
          y += 12;
        }
      }
    }

    if (showQRCode) {
      try {
        const qrData = JSON.stringify({
          gstin: bizGst,
          invoiceNo: sale.invoiceNumber,
          date: new Date(sale.date).toISOString().split('T')[0],
          totalGST: (sale.cgstTotal || 0) + (sale.sgstTotal || 0) + (sale.igstTotal || 0),
          totalAmount: sale.totalAmount || 0,
        });
        const qrBuffer = await QRCode.toBuffer(qrData, { width: 100, margin: 2 });
        doc.image(qrBuffer, marginLeft, y + 10, { width: isThermal ? 50 : 70 });
      } catch (qrErr) {}
    }

    } // end per-copy render loop

    doc.end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const generatePurchasePDF = async (req, res) => {
  try {
    const Purchase = require('../models/Purchase');
    const baseFilter = getBaseFilter(req);
    const purchase = await Purchase.findOne({ _id: req.params.id, ...baseFilter });
    if (!purchase) return res.status(404).json({ message: 'Purchase not found' });

    const settings = await Setting.findOne(getSettingQuery(req));
    const printPrefs = settings?.preferences?.print || {};
    const accentColor = getThemeColor(printPrefs);
    const rgb = hexToRgb(accentColor);

    const paperSize = printPrefs.paperSize || 'A4';
    const orientation = printPrefs.orientation || 'Portrait';
    const topMargin = parseInt(printPrefs.topPDFMargin) || 40;
    const companyNameSize = parseInt(printPrefs.companyNameTextSize) || 20;
    const invoiceTextSize = parseInt(printPrefs.invoiceTextSize) || 14;
    const printerType = printPrefs.printerType || (printPrefs.makeThermalDefault ? 'thermal' : 'regular');
    const decimals = printPrefs.showAmountDecimal === false ? 0 : (parseInt(printPrefs.amountDecimalPlaces) || parseInt(printPrefs._generalDecimalPlaces) || 2);

    let pageWidth, pageHeight;
    if (printerType === 'thermal') {
      const thermalSize = getThermalPageSize(printPrefs.thermalPageSize, printPrefs.thermalCustomChars);
      pageWidth = thermalSize[0];
      pageHeight = thermalSize[1];
    } else {
      const paperSizeMap = { 'A4': [595, 842], 'A5': [420, 595], 'Letter': [612, 792], 'Legal': [612, 1008] };
      const baseSize = paperSizeMap[paperSize] || [595, 842];
      pageWidth = orientation === 'Landscape' ? baseSize[1] : baseSize[0];
      pageHeight = orientation === 'Landscape' ? baseSize[0] : baseSize[1];
    }
    const marginLeft = printerType === 'thermal' ? 15 : 40;
    const marginRight = printerType === 'thermal' ? 15 : 40;
    const contentWidth = pageWidth - marginLeft - marginRight;

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
    const currency = settings?.preferences?.general?.businessCurrency || settings?.currency || '₹';

    const isThermal = printerType === 'thermal';
    const showCompanyName = isThermal ? printPrefs.showCompanyName !== false : true;
    const showCompanyLogo = isThermal ? printPrefs.showCompanyLogo !== false : true;
    const showAddress = isThermal ? printPrefs.showAddress !== false : true;
    const showEmail = isThermal ? printPrefs.showEmail !== false : true;
    const showPhone = isThermal ? printPrefs.showPhone !== false : true;
    const showGSTIN = isThermal ? printPrefs.showGSTIN !== false : true;
    const showItemSNo = isThermal ? printPrefs.showItemSNo !== false : printPrefs.showItemSNo !== false;
    const showItemDescription = isThermal ? printPrefs.showItemDescription !== false : printPrefs.printDescription !== false;
    const showSerialNo = isThermal ? printPrefs.showSerialNo !== false : printPrefs.showSerialNo === true;
    const showTotalItemQty = isThermal ? printPrefs.showTotalItemQty !== false : true;
    const showBankDetails = printPrefs.showBankDetails !== false;
    const showQRCode = printPrefs.showQRCode !== false;

    let headerY = topMargin;

    if (showCompanyLogo && settings?.logo) {
      const logoRel = settings.logo.startsWith('/') ? settings.logo.substring(1) : settings.logo;
      const logoPath = path.join(__dirname, '..', logoRel);
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, marginLeft, headerY, { width: isThermal ? 40 : 60 });
        if (isThermal) headerY += 45;
      }
    }

    const companyNameX = marginLeft + (showCompanyLogo && settings?.logo && !isThermal ? 70 : 0);
    if (showCompanyName) {
      doc.fontSize(isThermal ? 12 : companyNameSize).font('Helvetica-Bold').fillColor(accentColor).text(bizName, companyNameX, headerY);
      headerY += isThermal ? 14 : companyNameSize + 6;
    }

    doc.fontSize(isThermal ? 8 : 9).font('Helvetica').fillColor('#000000');
    if (showAddress && bizAddr) { doc.text(bizAddr, companyNameX, headerY); headerY += isThermal ? 10 : 13; }
    if (showPhone && bizPhone) { doc.text(isThermal ? `Ph.No.: ${bizPhone}` : `Phone: ${bizPhone}`, companyNameX, headerY); headerY += isThermal ? 10 : 13; }
    if (showEmail && bizEmail) { doc.text(`Email: ${bizEmail}`, companyNameX, headerY); headerY += isThermal ? 10 : 13; }
    if (showGSTIN && bizGst) { doc.text(`GST: ${bizGst}`, companyNameX, headerY); headerY += isThermal ? 10 : 13; }

    if (!isThermal && settings?.invoiceNote) { doc.text(`Note: ${settings.invoiceNote}`, companyNameX, headerY); headerY += 13; }

    if (!isThermal && showBankDetails && (settings?.bankName || settings?.bankAccountNumber || settings?.upiId)) {
      headerY += 4;
      if (settings?.bankName) { doc.text(`Bank: ${settings.bankName}`, companyNameX, headerY); headerY += 12; }
      if (settings?.bankAccountNumber) { doc.text(`A/C: ${settings.bankAccountNumber}`, companyNameX, headerY); headerY += 12; }
      if (settings?.bankIfsc) { doc.text(`IFSC: ${settings.bankIfsc}`, companyNameX, headerY); headerY += 12; }
      if (settings?.bankBranch) { doc.text(`Branch: ${settings.bankBranch}`, companyNameX, headerY); headerY += 12; }
      if (settings?.upiId) { doc.text(`UPI: ${settings.upiId}`, companyNameX, headerY); headerY += 12; }
    }

    doc.moveTo(marginLeft, headerY + 4).lineTo(pageWidth - marginRight, headerY + 4).dash(3, { space: 3 }).stroke().undash();
    headerY += 10;

    doc.fontSize(isThermal ? 10 : invoiceTextSize).font('Helvetica-Bold').fillColor(accentColor).text('PURCHASE BILL', marginLeft, headerY, { align: 'center', width: contentWidth });
    headerY += (isThermal ? 12 : invoiceTextSize) + 6;

    doc.moveTo(marginLeft, headerY + 2).lineTo(pageWidth - marginRight, headerY + 2).dash(3, { space: 3 }).stroke().undash();
    headerY += 8;

    doc.fontSize(isThermal ? 8 : 10).font('Helvetica').fillColor('#000000');
    doc.text(`Bill: ${purchase.billNumber || 'N/A'}`, marginLeft, headerY);
    const purchaseDateStr = settings?.preferences?.transaction?.addTimeOnTransactions !== false
      ? new Date(purchase.date).toLocaleString('en-IN')
      : new Date(purchase.date).toLocaleDateString('en-IN');
    doc.text(`Date: ${purchaseDateStr}`, marginLeft, headerY + (isThermal ? 10 : 14));
    doc.text(`Supplier: ${purchase.supplierName || 'Unknown'}`, marginLeft, headerY + (isThermal ? 20 : 28));
    if (!isThermal && purchase.supplierGstin) doc.text(`GSTIN: ${purchase.supplierGstin}`, marginLeft, headerY + 42);

    let tableTop = headerY + (isThermal ? 32 : 60);
    const hasTax = printPrefs.taxDetails !== false;

    if (isThermal) {
      doc.fontSize(8).font('Helvetica-Bold').fillColor(accentColor);
      if (showItemSNo) doc.text('#', marginLeft, tableTop, { width: 15 });
      doc.text('Product', (showItemSNo ? marginLeft + 15 : marginLeft), tableTop, { width: contentWidth - 65 });
      doc.text('Qty', marginLeft + contentWidth - 50, tableTop, { width: 20, align: 'right' });
      doc.text('Amount', marginLeft + contentWidth - 25, tableTop, { width: 25, align: 'right' });
      tableTop += 14;
    } else {
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
      tableTop += 18;
    }

    doc.font('Helvetica').fontSize(isThermal ? 8 : 9);
    let y = tableTop;
    (purchase.items || []).forEach((item, idx) => {
      if (y > pageHeight - 100) { doc.addPage(); y = topMargin; }
      if (isThermal) {
        const thermalName = (showItemSNo ? `${idx + 1}. ` : '') + item.productName + ((showSerialNo && item.serialNo) ? ` [${item.serialNo}]` : '');
        doc.fillColor('#000000').text(thermalName, marginLeft, y, { width: contentWidth - 50 });
        doc.text(String(item.quantity), marginLeft + contentWidth - 50, y, { width: 20, align: 'right' });
        doc.text(formatAmount(item.amount, printPrefs, currency), marginLeft + contentWidth - 25, y, { width: 25, align: 'right' });
        y += 10;
        if (showItemDescription && item.description) {
          doc.fontSize(7).font('Helvetica-Oblique').fillColor('#666666').text(item.description, marginLeft + 5, y, { width: contentWidth - 10 });
          y += 9;
          doc.font('Helvetica').fillColor('#000000').fontSize(8);
        }
      } else {
        const name = item.productName + (item.gstRate ? ` (${item.gstRate}%)` : '');
        const serialInfo = (showSerialNo && item.serialNo) ? ` [${item.serialNo}]` : '';
        doc.fillColor('#000000').text(name + serialInfo, marginLeft, y, { width: 120 });
        doc.text(String(item.quantity), (hasTax ? marginLeft + 210 : marginLeft + 180), y, { width: 70, align: 'right' });
        doc.text(formatAmount(item.rate, printPrefs, currency), (hasTax ? marginLeft + 275 : marginLeft + 280), y, { width: 60, align: 'right' });
        if (hasTax) {
          doc.text(formatAmount(item.taxableAmount || item.rate * item.quantity, printPrefs, currency), marginLeft + 340, y, { width: 60, align: 'right' });
          doc.text(formatAmount(item.cgst || 0, printPrefs, currency), marginLeft + 395, y, { width: 50, align: 'right' });
          doc.text(formatAmount(item.sgst || 0, printPrefs, currency), marginLeft + 450, y, { width: 50, align: 'right' });
        }
        doc.text(formatAmount(item.amount, printPrefs, currency), marginLeft + (hasTax ? 500 : 360), y, { width: 60, align: 'right' });
        y += 16;
      }
    });

    y += 6;
    doc.moveTo(marginLeft, y).lineTo(pageWidth - marginRight, y).dash(3, { space: 3 }).stroke().undash();
    y += 6;

    if (isThermal) {
      const totalQty = (purchase.items || []).reduce((s, i) => s + (i.quantity || 0), 0);
      if (showTotalItemQty) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000');
        doc.text(`Qty: ${totalQty} + ${(purchase.items || []).length}`, marginLeft, y, { width: contentWidth / 2 });
        doc.text(formatAmount(purchase.totalAmount, printPrefs, currency), marginLeft, y, { width: contentWidth, align: 'right' });
        y += 12;
      }
      doc.moveTo(marginLeft, y).lineTo(pageWidth - marginRight, y).dash(3, { space: 3 }).stroke().undash();
      y += 6;
      doc.font('Helvetica-Bold').fontSize(10).fillColor(accentColor);
      doc.text('Total', marginLeft, y, { width: contentWidth / 2 });
      doc.text(formatAmount(purchase.totalAmount, printPrefs, currency), marginLeft, y, { width: contentWidth, align: 'right' });
      y += 14;
      doc.font('Helvetica').fontSize(8).fillColor('#000000');
      doc.text('Received', marginLeft, y, { width: contentWidth / 2 });
      doc.text(formatAmount(purchase.paidAmount || 0, printPrefs, currency), marginLeft, y, { width: contentWidth, align: 'right' });
      y += 10;
      if (printPrefs.balanceAmount !== false) {
        doc.text('Balance', marginLeft, y, { width: contentWidth / 2 });
        doc.text(formatAmount(purchase.remainingBalance || purchase.totalAmount, printPrefs, currency), marginLeft, y, { width: contentWidth, align: 'right' });
        y += 10;
      }
      doc.text(`Status: ${(purchase.paymentStatus || 'unpaid').toUpperCase()}`, marginLeft, y, { width: contentWidth });
      y += 10;
    } else {
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

      doc.font('Helvetica').fontSize(10).fillColor('#000000');
      doc.text(`Paid: ${formatAmount(purchase.paidAmount || 0, printPrefs, currency)}`, marginLeft, y);
      y += 14;
      if (printPrefs.balanceAmount !== false) {
        doc.text(`Balance: ${formatAmount(purchase.remainingBalance || purchase.totalAmount, printPrefs, currency)}`, marginLeft, y);
        y += 14;
      }
      doc.text(`Status: ${(purchase.paymentStatus || 'unpaid').toUpperCase()}`, marginLeft, y);
      y += 14;
    }

    if (printPrefs.amountInWords !== false) {
      doc.font('Helvetica-Oblique').fontSize(isThermal ? 7 : 9).fillColor('#666666');
      const wordsFormat = printPrefs.amountInWordsFormat || 'Indian';
      const amountWords = wordsFormat === 'Indian' ? `Rupees ${numberToWords(purchase.totalAmount)}` : `Total: ${currency}${purchase.totalAmount.toFixed(decimals)}`;
      doc.text(amountWords, marginLeft, y, { width: contentWidth });
      y += isThermal ? 10 : 14;
    }

    if (isThermal) {
      const extraLines = parseInt(printPrefs.extraLinesAtEnd) || 0;
      for (let i = 0; i < extraLines; i++) {
        doc.text('', marginLeft, y);
        y += 10;
      }
    } else {
      if (printPrefs.footerSettings && printPrefs.footerSettings !== '') {
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
              const sigRel = settings.signature.startsWith('/') ? settings.signature.substring(1) : settings.signature;
              const sigPath = path.join(__dirname, '..', sigRel);
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
        if (printPrefs.footerSettings && typeof printPrefs.footerSettings === 'string' && printPrefs.footerSettings.length > 0) {
          doc.font('Helvetica-Oblique').fontSize(8).fillColor('#666666')
            .text(printPrefs.footerSettings, marginLeft, y, { width: contentWidth, align: 'center' });
          y += 12;
        }
      }
    }

    if (showQRCode) {
      try {
        const qrData = JSON.stringify({
          gstin: bizGst,
          billNo: purchase.billNumber || purchase._id,
          date: new Date(purchase.date).toISOString().split('T')[0],
          totalAmount: purchase.totalAmount || 0,
        });
        const qrBuffer = await QRCode.toBuffer(qrData, { width: 100, margin: 2 });
        doc.image(qrBuffer, marginLeft, y + 10, { width: isThermal ? 50 : 70 });
      } catch (qrErr) {}
    }

    doc.end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Sample invoice used by the Settings → Print live preview so it renders through the
// exact same engine as a real printed invoice.
const buildSamplePreviewSale = () => ({
  invoiceNumber: 'INV-001',
  date: new Date(),
  type: 'invoice',
  customerName: 'Walk-in Customer',
  customerPhone: '7878650749',
  customerGst: '29AAACC1206D2ZB',
  billingAddress: 'Kota, Rajasthan, 324005',
  shippingAddress: 'Kota, Rajasthan, 324005',
  transportMode: 'Road',
  vehicleNo: 'RJ-20-AB-1234',
  additionalField1: '',
  additionalField2: '',
  items: [
    { productName: 'Brittania Choclate Cake', hsn: '12345678', quantity: 100, unit: 'Box', rate: 100, amount: 10000, gstRate: 0, description: 'Brittania Choclate Cake description', batchNumber: 'N1234', modelNumber: 'A12345', expiryDate: '06/2027', manufacturingDate: '10/06/2026', size: 'Med/32', mrp: 100, taxableAmount: 10000, cgst: 0, sgst: 0, serialNo: '', discountType: '', discountAmount: 0 },
    { productName: 'Cadbury Chocolate', hsn: '34567890', quantity: 50, unit: 'Pac', rate: 150, amount: 7500, gstRate: 0, description: 'Cadbury cake description', batchNumber: 'N5678', modelNumber: 'B67890', expiryDate: '06/2027', manufacturingDate: '10/06/2026', size: 'Med/32', mrp: 150, taxableAmount: 7500, cgst: 0, sgst: 0, serialNo: '', discountType: '', discountAmount: 0 },
  ],
  taxableAmount: 17500,
  discountOnInvoice: 0,
  cgstTotal: 0,
  sgstTotal: 0,
  igstTotal: 0,
  totalAmount: 17500,
  paidAmount: 15000,
  remainingBalance: 2500,
  customer: { openingBalance: 2500 },
  paymentStatus: 'partial',
});

const generateInvoicePreviewPDF = async (req, res) => {
  try {
    const settingsDoc = await Setting.findOne(getSettingQuery(req));
    const settings = settingsDoc ? settingsDoc.toObject() : { preferences: {} };
    settings.preferences = settings.preferences || {};
    // Merge the live (possibly unsaved) print preferences sent from the Settings tab so
    // the preview reflects toggles before they are saved.
    if (req.body && req.body.print && typeof req.body.print === 'object') {
      settings.preferences.print = { ...(settings.preferences.print || {}), ...req.body.print };
    }
    req.previewMode = true;
    req.previewSale = buildSamplePreviewSale();
    req.previewSettings = settings;
    return generateInvoicePDF(req, res);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { generateInvoicePDF, generatePurchasePDF, generateInvoicePreviewPDF };
