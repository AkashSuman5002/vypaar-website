const PDFDocument = require('pdfkit');
const Product = require('../models/Product');

const getUserId = (req) => req.user?._id || req.user?.id;

const generateBarcodeLabels = async (req, res) => {
  try {
    const { productIds, labelWidth = 50, labelHeight = 30, columns = 3 } = req.body;
    if (!productIds || !productIds.length) {
      return res.status(400).json({ message: 'No products selected' });
    }

    const userId = getUserId(req);
    const products = await Product.find({ _id: { $in: productIds }, user: userId })
      .select('name sku sellingPrice hsnCode barcodeNumber')
      .lean();
    if (!products.length) return res.status(404).json({ message: 'Products not found' });

    const doc = new PDFDocument({ size: 'A4', margin: 10 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="barcode-labels.pdf"');
    doc.pipe(res);

    const pageWidth = 595;
    const pageHeight = 842;
    const gapX = 5;
    const gapY = 5;
    const cellW = (pageWidth - 20 - (columns - 1) * gapX) / columns;
    const cellH = 80;
    const usableH = pageHeight - 20;

    let col = 0, row = 0;

    for (const product of products) {
      if (row * (cellH + gapY) + cellH > usableH) {
        doc.addPage();
        col = 0; row = 0;
      }
      const x = 10 + col * (cellW + gapX);
      const y = 10 + row * (cellH + gapY);

      doc.rect(x, y, cellW, cellH).lineWidth(0.5).stroke('#999');

      // Barcode text
      doc.fontSize(6).font('Helvetica-Bold');
      doc.text(product.name || 'Unknown', x + 2, y + 2, { width: cellW - 4, align: 'center' });

      // Simulated barcode (numeric lines using SKU or ID)
      const code = product.sku || product.hsnCode || product.barcodeNumber || product._id.toString().slice(-8);
      doc.fontSize(4).font('Helvetica');
      doc.text(code, x + 2, y + cellH - 14, { width: cellW - 4, align: 'center' });

      // Barcode lines
      const bcX = x + 4;
      const bcY = y + 16;
      const bcW = cellW - 8;
      const bcH = cellH - 34;
      const segments = Math.min(code.length, 16);
      const segW = bcW / segments;
      for (let i = 0; i < segments; i++) {
        const barW = segW * 0.6;
        if (i % 2 === 0) {
          doc.rect(bcX + i * segW, bcY, barW, bcH).fill('#000');
        }
      }

      doc.fontSize(7).font('Helvetica');
      doc.text(`₹${(product.sellingPrice || 0).toFixed(0)}`, x + 2, y + cellH - 28, { width: cellW - 4, align: 'center' });

      col++;
      if (col >= columns) { col = 0; row++; }
    }

    doc.end();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { generateBarcodeLabels };
