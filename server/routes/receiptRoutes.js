const express = require('express');
const { getReceipts, getReceiptById, generateReceiptPDF } = require('../controllers/receiptController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.route('/')
  .get(authorize('sales:view'), getReceipts);

router.get('/:id/pdf', authorize('sales:view'), generateReceiptPDF);

router.route('/:id')
  .get(authorize('sales:view'), getReceiptById);

module.exports = router;
