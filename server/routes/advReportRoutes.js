const express = require('express');
const { getCustomerReport, getProductReport, getPendingPaymentReport } = require('../controllers/advReportController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.get('/customers', authorize('reports:view'), getCustomerReport);
router.get('/products', authorize('reports:view'), getProductReport);
router.get('/pending-payments', authorize('reports:view'), getPendingPaymentReport);

module.exports = router;
