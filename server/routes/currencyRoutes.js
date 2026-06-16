const express = require('express');
const { getCurrencies, createCurrency, updateCurrency, deleteCurrency, getExchangeRate } = require('../controllers/currencyController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.get('/exchange-rate/:from/:to', getExchangeRate);
router.route('/')
  .get(getCurrencies)
  .post(authorize('settings:manage'), createCurrency);

router.route('/:id')
  .put(authorize('settings:manage'), updateCurrency)
  .delete(authorize('settings:manage'), deleteCurrency);

module.exports = router;
