const express = require('express');
const { getPaymentOuts, createPaymentOut, updatePaymentOut, deletePaymentOut } = require('../controllers/paymentOutController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.route('/')
  .get(authorize('cashbank:view'), getPaymentOuts)
  .post(authorize('cashbank:manage'), createPaymentOut);

router.route('/:id')
  .put(authorize('cashbank:manage'), updatePaymentOut)
  .delete(authorize('cashbank:manage'), deletePaymentOut);

module.exports = router;
