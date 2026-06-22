const express = require('express');
const router = express.Router();
const { getStockMovements, getStockValuation, adjustStock, getValuationByMethod } = require('../controllers/stockController');
const { authorize } = require('../middleware/authorize');

router.get('/movements', authorize('products:view'), getStockMovements);
router.get('/valuation', authorize('products:view'), getStockValuation);
router.get('/valuation-method', authorize('products:view'), getValuationByMethod);
router.put('/adjust', authorize('products:manage'), adjustStock);

module.exports = router;
