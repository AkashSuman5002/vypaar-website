const express = require('express');
const { getSuppliers, getSupplierById, createSupplier, updateSupplier, deleteSupplier } = require('../controllers/supplierController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.route('/')
  .get(authorize('suppliers:view'), getSuppliers)
  .post(authorize('suppliers:manage'), createSupplier);

router.route('/:id')
  .get(authorize('suppliers:view'), getSupplierById)
  .put(authorize('suppliers:manage'), updateSupplier)
  .delete(authorize('suppliers:manage'), deleteSupplier);

module.exports = router;
