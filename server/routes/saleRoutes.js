const express = require('express');
const {
  getSales, getSaleById, createSale, updateSale, deleteSale,
  getNextInvoiceNumber, duplicateSale, convertToReturn, convertToChallan, convertToEstimate,
  getSalesByCustomer, convertToInvoice, receivePayment, generateEWayBill, updateDelivery,
  generateEInvoice,
} = require('../controllers/saleController');
const { generateInvoicePDF, generateInvoicePreviewPDF } = require('../controllers/pdfController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

// Live print-settings preview: renders a sample invoice through the real PDF engine.
// GET variant exists so the Settings preview can point an <iframe> straight at this URL
// (the httpOnly auth cookie rides along automatically). Loading the PDF over http:// lets
// Chromium's PDF viewer render it inline — unlike a blob: URL, which stays blank in Electron.
router.get('/preview-pdf', authorize('sales:view'), generateInvoicePreviewPDF);
router.post('/preview-pdf', authorize('sales:view'), generateInvoicePreviewPDF);

router.route('/')
  .get(authorize('sales:view'), getSales)
  .post(authorize('sales:create'), createSale);

router.get('/next-invoice', authorize('sales:view'), getNextInvoiceNumber);
router.get('/customer/:customerId', authorize('sales:view'), getSalesByCustomer);

router.post('/:id/duplicate', authorize('sales:create'), duplicateSale);
router.post('/:id/convert-to-return', authorize('sales:manage'), convertToReturn);
router.post('/:id/convert-to-challan', authorize('sales:manage'), convertToChallan);
router.post('/:id/convert-to-estimate', authorize('sales:manage'), convertToEstimate);
router.post('/:id/convert-to-invoice', authorize('sales:manage'), convertToInvoice);
router.post('/:id/receive-payment', authorize('sales:manage'), receivePayment);
router.post('/:id/generate-eway-bill', authorize('sales:manage'), generateEWayBill);
router.post('/:id/generate-einvoice', authorize('sales:manage'), generateEInvoice);
router.put('/:id/deliver', authorize('sales:manage'), updateDelivery);

router.get('/:id/pdf', authorize('sales:view'), generateInvoicePDF);

router.route('/:id')
  .get(authorize('sales:view'), getSaleById)
  .put(authorize('sales:manage'), updateSale)
  .delete(authorize('sales:manage'), deleteSale);

module.exports = router;
