const express = require('express');
const { getPurchaseReturns, getPurchaseReturnById, createPurchaseReturn, updatePurchaseReturn, deletePurchaseReturn } = require('../controllers/purchaseReturnController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.route('/')
  .get(authorize('purchases:view'), getPurchaseReturns)
  .post(authorize('purchases:manage'), createPurchaseReturn);

router.route('/:id')
  .get(authorize('purchases:view'), getPurchaseReturnById)
  .put(authorize('purchases:manage'), updatePurchaseReturn)
  .delete(authorize('purchases:manage'), deletePurchaseReturn);

module.exports = router;
