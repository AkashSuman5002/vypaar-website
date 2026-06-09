const express = require('express');
const { getPurchases, getPurchaseById, createPurchase, updatePurchase, deletePurchase } = require('../controllers/purchaseController');
const { generatePurchasePDF } = require('../controllers/pdfController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.route('/')
  .get(authorize('purchases:view'), getPurchases)
  .post(authorize('purchases:create'), createPurchase);

router.get('/:id/pdf', authorize('purchases:view'), generatePurchasePDF);

router.route('/:id')
  .get(authorize('purchases:view'), getPurchaseById)
  .put(authorize('purchases:manage'), updatePurchase)
  .delete(authorize('purchases:manage'), deletePurchase);

module.exports = router;
