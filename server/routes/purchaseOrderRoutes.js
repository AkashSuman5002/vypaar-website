const express = require('express');
const { getPurchaseOrders, getPurchaseOrderById, createPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder } = require('../controllers/purchaseOrderController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.route('/')
  .get(authorize('purchases:view'), getPurchaseOrders)
  .post(authorize('purchases:create'), createPurchaseOrder);

router.route('/:id')
  .get(authorize('purchases:view'), getPurchaseOrderById)
  .put(authorize('purchases:manage'), updatePurchaseOrder)
  .delete(authorize('purchases:manage'), deletePurchaseOrder);

module.exports = router;
