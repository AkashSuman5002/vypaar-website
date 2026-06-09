const express = require('express');
const { getSalesReport, getPurchaseReport, getProfitReport } = require('../controllers/reportController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.get('/sales', authorize('reports:view'), getSalesReport);
router.get('/purchases', authorize('reports:view'), getPurchaseReport);
router.get('/profit', authorize('reports:view'), getProfitReport);

module.exports = router;
