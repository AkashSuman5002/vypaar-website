const express = require('express');
const { authorize } = require('../middleware/authorize');
const { getConfig, saveConfig, createLink, getStatus, refundPayment } = require('../controllers/paymentLinkController');

const router = express.Router();

// Razorpay payment configuration (keys).
router.get('/config', authorize('settings:view'), getConfig);
router.post('/config', authorize('settings:manage'), saveConfig);

// Create a payment link for an invoice and poll its status.
router.post('/link', authorize('sales:create'), createLink);
router.get('/link/:invoiceId/status', authorize('sales:view'), getStatus);

// Refund a completed online payment (reverses the books).
router.post('/refund', authorize('sales:manage'), refundPayment);

module.exports = router;
