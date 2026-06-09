const express = require('express');
const { getCustomerLedger, getSupplierLedger } = require('../controllers/ledgerController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.get('/customer/:id', authorize('reports:view'), getCustomerLedger);
router.get('/supplier/:id', authorize('reports:view'), getSupplierLedger);

module.exports = router;
