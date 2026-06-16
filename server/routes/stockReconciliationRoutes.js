const express = require('express');
const { getReconciliations, getReconciliationById, getStockForCount, createReconciliation, applyReconciliation, deleteReconciliation } = require('../controllers/stockReconciliationController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.get('/stock-for-count', authorize('products:view'), getStockForCount);

router.route('/')
  .get(authorize('products:view'), getReconciliations)
  .post(authorize('products:manage'), createReconciliation);

router.route('/:id')
  .get(authorize('products:view'), getReconciliationById)
  .delete(authorize('products:manage'), deleteReconciliation);

router.put('/:id/apply', authorize('products:manage'), applyReconciliation);

module.exports = router;
