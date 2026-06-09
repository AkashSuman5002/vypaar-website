const express = require('express');
const { getProducts, getProductById, getProductSales, createProduct, updateProduct, deleteProduct, getLastPurchasePrice } = require('../controllers/productController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.route('/')
  .get(authorize('products:view'), getProducts)
  .post(authorize('products:manage'), createProduct);

router.route('/:id')
  .get(authorize('products:view'), getProductById)
  .put(authorize('products:manage'), updateProduct)
  .delete(authorize('products:manage'), deleteProduct);

router.get('/:id/sales', authorize('products:view'), getProductSales);

router.get('/:id/last-purchase-price', authorize('products:view'), getLastPurchasePrice);

module.exports = router;
