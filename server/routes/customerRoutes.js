const express = require('express');
const { getCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer } = require('../controllers/customerController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.route('/')
  .get(authorize('customers:view'), getCustomers)
  .post(authorize('customers:manage'), createCustomer);

router.route('/:id')
  .get(authorize('customers:view'), getCustomerById)
  .put(authorize('customers:manage'), updateCustomer)
  .delete(authorize('customers:manage'), deleteCustomer);

module.exports = router;
