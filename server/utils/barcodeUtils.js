const validateBarcode = (barcode) => {
  if (!barcode || typeof barcode !== 'string') {
    return { valid: false, error: 'Barcode is required' };
  }
  const cleaned = barcode.trim();
  if (cleaned.length === 0) {
    return { valid: false, error: 'Barcode is empty' };
  }
  if (cleaned.length < 6 || cleaned.length > 16) {
    return { valid: false, error: `Invalid barcode length: ${cleaned.length} characters` };
  }
  if (!/^[0-9A-Za-z\-]+$/.test(cleaned)) {
    return { valid: false, error: 'Barcode contains invalid characters' };
  }
  if (/^[0-9]+$/.test(cleaned)) {
    const format = detectEANFormat(cleaned);
    if (format && !validateChecksum(cleaned, format)) {
      return { valid: false, error: `Invalid checksum for ${format} barcode` };
    }
  }
  return { valid: true, cleaned };
};

const detectEANFormat = (barcode) => {
  const len = barcode.length;
  if (len === 8) return 'EAN-8';
  if (len === 12) return 'UPC-A';
  if (len === 13) return 'EAN-13';
  if (len === 6) return 'UPC-E';
  return null;
};

const validateChecksum = (barcode, format) => {
  const digits = barcode.split('').map(Number);
  if (digits.some(isNaN)) return true;
  let sum = 0;
  const len = digits.length;
  if (format === 'UPC-E') return true;
  for (let i = 0; i < len - 1; i++) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === digits[len - 1];
};

const detectFormat = (barcode) => {
  const cleaned = barcode.trim();
  if (/^[0-9]+$/.test(cleaned)) {
    const len = cleaned.length;
    if (len === 8) return 'EAN-8';
    if (len === 12) return 'UPC-A';
    if (len === 13) return 'EAN-13';
    if (len === 6) return 'UPC-E';
  }
  if (/^[A-Za-z0-9\-]+$/.test(cleaned) && cleaned.length >= 6 && cleaned.length <= 20) {
    if (/^[A-Za-z]+[0-9]+$/.test(cleaned) || /^[0-9]+[A-Za-z]+$/.test(cleaned)) {
      return 'Code39';
    }
    return 'Code128';
  }
  if (cleaned.length > 20) return 'QR_CODE';
  return 'unknown';
};

const generateSKU = (name, category, barcode) => {
  if (barcode && barcode.length >= 6) {
    return `BR-${barcode.substring(0, 10)}`;
  }
  const prefix = category ? category.substring(0, 3).toUpperCase() : 'PRD';
  const namePart = name ? name.substring(0, 4).toUpperCase() : 'ITEM';
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${namePart}-${rand}`;
};

const parseBarcodeCSVRow = (row, headers, mapping) => {
  const mapped = {};
  for (const [csvCol, dbField] of Object.entries(mapping)) {
    const colIndex = headers.indexOf(csvCol);
    if (colIndex !== -1 && row[colIndex] !== undefined && row[colIndex] !== '') {
      mapped[dbField] = row[colIndex].toString().trim();
    }
  }
  return mapped;
};

const validateImportRow = (row) => {
  const errors = [];
  if (!row.barcode) {
    errors.push('Barcode is required');
  } else {
    const validation = validateBarcode(row.barcode);
    if (!validation.valid) {
      errors.push(validation.error);
    }
  }
  if (row.name && row.name.length > 200) {
    errors.push('Product name too long (max 200 chars)');
  }
  if (row.salePrice !== undefined && row.salePrice !== '') {
    const price = parseFloat(row.salePrice);
    if (isNaN(price) || price < 0) errors.push('Invalid sale price');
  }
  if (row.purchasePrice !== undefined && row.purchasePrice !== '') {
    const price = parseFloat(row.purchasePrice);
    if (isNaN(price) || price < 0) errors.push('Invalid purchase price');
  }
  if (row.stock !== undefined && row.stock !== '') {
    const stock = parseFloat(row.stock);
    if (isNaN(stock) || stock < 0) errors.push('Invalid stock quantity');
  }
  if (row.gstRate !== undefined && row.gstRate !== '') {
    const gst = parseFloat(row.gstRate);
    if (isNaN(gst) || gst < 0 || gst > 100) errors.push('GST rate must be 0-100');
  }
  return errors;
};

module.exports = {
  validateBarcode,
  detectEANFormat,
  validateChecksum,
  detectFormat,
  generateSKU,
  parseBarcodeCSVRow,
  validateImportRow,
};
