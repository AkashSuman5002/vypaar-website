const PDFDocument = require('pdfkit');
const Product = require('../models/Product');
const { getBaseFilter } = require('../utils/queryHelper');

// Canonical Code 128 bar/space module patterns, indexed by symbol value 0..106.
// Each pattern is 11 modules (the final Stop symbol 106 is 13 modules incl. the
// terminating bars). Source: ISO/IEC 15417 Code 128 specification.
// Using these with Start Code B (value 104) produces a real, scannable barcode.
const CODE128_PATTERNS = [
  '11011001100','11001101100','11001100110','10010011000','10010001100','10001001100',
  '10011001000','10011000100','10001100100','11001001000','11001000100','11000100100',
  '10110011100','10011011100','10011001110','10111001100','10011101100','10011100110',
  '11001110010','11001011100','11001001110','11011100100','11001110100','11101101110',
  '11101001100','11100101100','11100100110','11101100100','11100110100','11100110010',
  '11011011000','11011000110','11000110110','10100011000','10001011000','10001000110',
  '10110001000','10001101000','10001100010','11010001000','11000101000','11000100010',
  '10110111000','10110001110','10001101110','10111011000','10111000110','10001110110',
  '11101110110','11010001110','11000101110','11011101000','11011100010','11011101110',
  '11101011000','11101000110','11100010110','11101101000','11101100010','11100011010',
  '11101111010','11001000010','11110001010','10100110000','10100001100','10010110000',
  '10010000110','10000101100','10000100110','10110010000','10110000100','10011010000',
  '10011000010','10000110100','10000110010','11000010010','11001010000','11110111010',
  '11000010100','10001111010','10100111100','10010111100','10010011110','10111100100',
  '10011110100','10011110010','11110100100','11110010100','11110010010','11011011110',
  '11011110110','11110110110','10101111000','10100011110','10001011110','10111101000',
  '10111100010','11110101000','11110100010','10111011110','10111101110','11101011110',
  '11110101110','11010000100','11010010000','11010011100','1100011101011'
];

// Start Code B = value 104, Stop = value 106.
const CODE128_START_B = 104;
const CODE128_STOP = 106;

// Encode an ASCII string (printable 32..126) using Code 128 Set B and return a
// string of '1' (bar) / '0' (space) modules with the correct checksum + stop.
function encodeCode128B(text) {
  if (!text) text = '000000000000';
  // Restrict to the Set B value range (ASCII 32..126 -> values 0..94).
  const values = [];
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code < 32 || code > 126) code = 32; // substitute unsupported chars with space
    values.push(code - 32);
  }

  let checksum = CODE128_START_B;
  for (let i = 0; i < values.length; i++) {
    checksum += values[i] * (i + 1);
  }
  checksum = checksum % 103;

  let bits = CODE128_PATTERNS[CODE128_START_B];
  for (const v of values) bits += CODE128_PATTERNS[v];
  bits += CODE128_PATTERNS[checksum];
  bits += CODE128_PATTERNS[CODE128_STOP];
  return bits;
}

const generateBarcodeLabels = async (req, res) => {
  try {
    const { productIds, labels, columns = 3 } = req.body;

    if (!productIds?.length && !labels?.length) {
      return res.status(400).json({ message: 'No products selected' });
    }

    let productData = [];

    if (labels && labels.length > 0) {
      const ids = labels.map(l => l.productId).filter(Boolean);
      let products = [];
      if (ids.length) {
        products = await Product.find({ _id: { $in: ids }, ...getBaseFilter(req) })
          .select('name sku price sellingPrice hsnCode barcode stock')
          .lean();
      }
      productData = labels.map(label => {
        const product = products.find(p => p._id.toString() === label.productId);
        return {
          name: label.itemName || product?.name || 'Unknown',
          barcode: product?.barcode || product?.sku || label.itemCode || product?._id?.toString().slice(-12) || '000000000000',
          price: product?.sellingPrice || product?.price || 0,
          quantity: label.quantity || 1,
          header: label.header || '',
          line1: label.line1 || '',
          line2: label.line2 || '',
          line3: label.line3 || '',
          line4: label.line4 || '',
        };
      });
    } else {
      productData = await Product.find({ _id: { $in: productIds }, ...getBaseFilter(req) })
        .select('name sku price sellingPrice hsnCode barcode stock')
        .lean();
      productData = productData.map(p => ({
        name: p.name || 'Unknown',
        barcode: p.barcode || p.sku || p._id.toString().slice(-12),
        price: p.sellingPrice || p.price || 0,
        quantity: 1,
        header: '',
        line1: '', line2: '', line3: '', line4: '',
      }));
    }

    if (!productData.length) return res.status(404).json({ message: 'Products not found' });

    const doc = new PDFDocument({ size: 'A4', margin: 10 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="barcode-labels.pdf"');
    doc.pipe(res);

    const pageWidth = 595;
    const pageHeight = 842;
    const gapX = 5;
    const gapY = 5;
    const cellW = (pageWidth - 20 - (columns - 1) * gapX) / columns;
    const cellH = 90;
    const usableH = pageHeight - 20;

    let col = 0, row = 0;

    for (const product of productData) {
      const qty = product.quantity || 1;
      for (let q = 0; q < qty; q++) {
        if (row * (cellH + gapY) + cellH > usableH) {
          doc.addPage();
          col = 0; row = 0;
        }
        const x = 10 + col * (cellW + gapX);
        const y = 10 + row * (cellH + gapY);

        doc.rect(x, y, cellW, cellH).lineWidth(0.5).stroke('#999');

        // Header / Product Name
        const headerText = product.header || product.name || 'Unknown';
        doc.fontSize(7).font('Helvetica-Bold');
        doc.text(headerText, x + 3, y + 3, { width: cellW - 6, align: 'center' });

        // Generate Code128 barcode pattern
        const code = (product.barcode || '000000000000').replace(/[^\x20-\x7E]/g, '').slice(0, 30);
        const pattern = encodeCode128B(code);
        // Reserve a quiet zone (>=10 modules) on each side so scanners can lock on.
        const quietModules = 10;
        const totalModules = pattern.length + quietModules * 2;
        const bcY = y + 16;
        const bcH = 28;
        const bcW = cellW - 12;
        const moduleW = bcW / totalModules;
        const bcX = x + 6 + quietModules * moduleW; // start after left quiet zone

        // Merge consecutive '1' modules into single rectangles for crisp bars.
        let i = 0;
        while (i < pattern.length) {
          if (pattern[i] === '1') {
            let run = 1;
            while (i + run < pattern.length && pattern[i + run] === '1') run++;
            const bx = bcX + i * moduleW;
            doc.rect(bx, bcY, run * moduleW, bcH).fill('#000');
            i += run;
          } else {
            i++;
          }
        }

        // Barcode text below
        doc.fontSize(6).font('Helvetica');
        doc.text(code, x + 3, y + 48, { width: cellW - 6, align: 'center' });

        // Custom lines
        let lineY = y + 58;
        doc.fontSize(5).font('Helvetica');
        if (product.line1) { doc.text(product.line1, x + 3, lineY, { width: cellW - 6, align: 'center' }); lineY += 6; }
        if (product.line2) { doc.text(product.line2, x + 3, lineY, { width: cellW - 6, align: 'center' }); lineY += 6; }
        if (product.line3) { doc.text(product.line3, x + 3, lineY, { width: cellW - 6, align: 'center' }); lineY += 6; }
        if (product.line4) { doc.text(product.line4, x + 3, lineY, { width: cellW - 6, align: 'center' }); lineY += 6; }

        // Price
        doc.fontSize(8).font('Helvetica-Bold');
        doc.text(`₹${(product.price || 0).toFixed(0)}`, x + 3, y + cellH - 14, { width: cellW - 6, align: 'center' });

        col++;
        if (col >= columns) { col = 0; row++; }
      }
    }

    doc.end();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { generateBarcodeLabels };
