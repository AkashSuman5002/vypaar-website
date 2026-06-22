const express = require('express');
const {
  getManufacturingOrders, getManufacturingOrderById, getNextOrderNumber,
  createManufacturingOrder, updateManufacturingOrder, completeManufacturingOrder,
  deleteManufacturingOrder,
} = require('../controllers/manufacturingController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.route('/')
  .get(authorize('products:view'), getManufacturingOrders)
  .post(authorize('products:create'), createManufacturingOrder);

router.get('/next-order', authorize('products:view'), getNextOrderNumber);

router.route('/:id')
  .get(authorize('products:view'), getManufacturingOrderById)
  .put(authorize('products:manage'), updateManufacturingOrder)
  .delete(authorize('products:manage'), deleteManufacturingOrder);

router.post('/:id/complete', authorize('products:manage'), completeManufacturingOrder);

module.exports = router;
