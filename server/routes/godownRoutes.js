const express = require('express');
const { getGodowns, createGodown, updateGodown, deleteGodown } = require('../controllers/godownController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.route('/')
  .get(authorize('products:view'), getGodowns)
  .post(authorize('products:manage'), createGodown);

router.route('/:id')
  .put(authorize('products:manage'), updateGodown)
  .delete(authorize('products:manage'), deleteGodown);

module.exports = router;
