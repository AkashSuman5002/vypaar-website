const express = require('express');
const {
  getSales, getSaleById, createSale, updateSale, deleteSale,
  getNextInvoiceNumber, duplicateSale, convertToReturn, convertToChallan, convertToEstimate,
  getSalesByCustomer, convertToInvoice, receivePayment,
} = require('../controllers/saleController');
const { generateInvoicePDF } = require('../controllers/pdfController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

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

router.get('/:id/pdf', authorize('sales:view'), generateInvoicePDF);

router.route('/:id')
  .get(authorize('sales:view'), getSaleById)
  .put(authorize('sales:manage'), updateSale)
  .delete(authorize('sales:manage'), deleteSale);

module.exports = router;
