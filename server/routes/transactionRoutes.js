const express = require('express');
const { getTransactions, createTransaction, getCashBankBalance } = require('../controllers/transactionController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.route('/')
  .get(authorize('cashbank:view'), getTransactions)
  .post(authorize('cashbank:manage'), createTransaction);

router.get('/balance', authorize('cashbank:view'), getCashBankBalance);

module.exports = router;
