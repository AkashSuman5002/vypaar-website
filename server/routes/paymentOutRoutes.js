const express = require('express');
const { getPaymentOuts, createPaymentOut, deletePaymentOut } = require('../controllers/paymentOutController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.route('/')
  .get(authorize('cashbank:view'), getPaymentOuts)
  .post(authorize('cashbank:manage'), createPaymentOut);

router.route('/:id')
  .delete(authorize('cashbank:manage'), deletePaymentOut);

module.exports = router;
