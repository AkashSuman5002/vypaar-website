const express = require('express');
const {
  getPurchaseOrders, getPurchaseOrderById, createPurchaseOrder, updatePurchaseOrder,
  approvePurchaseOrder, cancelPurchaseOrder, receivePurchaseOrder, deletePurchaseOrder,
} = require('../controllers/purchaseOrderController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.route('/')
  .get(authorize('purchases:view'), getPurchaseOrders)
  .post(authorize('purchases:create'), createPurchaseOrder);

router.route('/:id')
  .get(authorize('purchases:view'), getPurchaseOrderById)
  .put(authorize('purchases:manage'), updatePurchaseOrder)
  .delete(authorize('purchases:manage'), deletePurchaseOrder);

router.put('/:id/approve', authorize('purchases:manage'), approvePurchaseOrder);
router.put('/:id/cancel', authorize('purchases:manage'), cancelPurchaseOrder);
router.put('/:id/receive', authorize('purchases:manage'), receivePurchaseOrder);

module.exports = router;
