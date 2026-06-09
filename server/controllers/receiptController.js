const Receipt = require('../models/Receipt');
const Sale = require('../models/Sale');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');

const getReceipts = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { page = 1, limit = 50, customer, mode, dateFrom, dateTo, search } = req.query;
    const filter = { ...baseFilter };

    if (customer) filter.customer = customer;
    if (mode) filter.mode = mode;
    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom);
      if (dateTo) filter.date.$lte = new Date(dateTo + 'T23:59:59.999Z');
    }
    if (search) {
      filter.$or = [
        { receiptNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { invoiceNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Receipt.countDocuments(filter);
    const receipts = await Receipt.find(filter)
      .populate('customer', 'name phone')
      .sort({ date: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    res.json({ receipts, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getReceiptById = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const receipt = await Receipt.findById(req.params.id).populate('customer', 'name phone email');
    if (!receipt) return res.status(404).json({ message: 'Receipt not found' });
    res.json(receipt);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const generateReceiptPDF = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const receipt = await Receipt.findById(req.params.id);
    if (!receipt) return res.status(404).json({ message: 'Receipt not found' });
    if (receipt.user.toString() !== req.user._id.toString()) return res.status(401).json({ message: 'Not authorized' });

    const Setting = require('../models/Setting');
    const settings = await Setting.findOne(baseFilter);
    const PDFDocument = require('pdfkit');

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    const safeReceiptName = (receipt.receiptNumber || 'receipt').replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="${safeReceiptName}.pdf"`);
    doc.pipe(res);

    const bizName = settings?.businessName || 'Your Business';
    const bizAddr = settings?.address || '';
    const bizPhone = settings?.phone || '';

    doc.fontSize(20).font('Helvetica-Bold').text(bizName, 40, 40);
    doc.fontSize(9).font('Helvetica');
    if (bizAddr) doc.text(bizAddr, 40, 65);
    if (bizPhone) doc.text(`Phone: ${bizPhone}`, 40, bizAddr ? 78 : 65);

    doc.fontSize(16).font('Helvetica-Bold').text('PAYMENT RECEIPT', 40, 110);
    doc.fontSize(10).font('Helvetica');

    const topRight = 110;
    doc.text(`Receipt: ${receipt.receiptNumber}`, 350, topRight, { align: 'right' });
    doc.text(`Date: ${receipt.date ? new Date(receipt.date).toLocaleDateString() : '-'}`, 350, topRight + 14, { align: 'right' });

    doc.moveTo(40, 150).lineTo(550, 150).stroke();

    doc.fontSize(11).font('Helvetica-Bold').text('Received From:', 40, 165);
    doc.fontSize(10).font('Helvetica').text(receipt.customerName || 'Walk-in', 40, 180);

    doc.fontSize(11).font('Helvetica-Bold').text('Amount:', 40, 210);
    doc.fontSize(14).font('Helvetica-Bold').text(`₹${(receipt.amount || 0).toLocaleString()}`, 40, 225);

    doc.fontSize(11).font('Helvetica-Bold').text('Payment Mode:', 40, 255);
    doc.fontSize(10).font('Helvetica').text((receipt.mode || '').toUpperCase(), 40, 270);
    if (receipt.transactionNo) doc.text(`Transaction No: ${receipt.transactionNo}`, 40, 285);
    if (receipt.bankName) doc.text(`Bank: ${receipt.bankName}`, 40, 300);
    if (receipt.chequeNo) doc.text(`Cheque No: ${receipt.chequeNo}`, 40, 315);

    if (receipt.invoiceNumber) {
      doc.fontSize(11).font('Helvetica-Bold').text('Against Invoice:', 40, 345);
      doc.fontSize(10).font('Helvetica').text(receipt.invoiceNumber, 40, 360);
    }

    doc.moveTo(40, 400).lineTo(550, 400).stroke();
    doc.fontSize(9).font('Helvetica').text('This is a computer-generated receipt.', 40, 415);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 40, 430);

    doc.end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getReceipts, getReceiptById, generateReceiptPDF };
