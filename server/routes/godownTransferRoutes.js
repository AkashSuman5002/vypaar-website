const express = require('express');
const { getTransfers, getTransferById, createTransfer, deleteTransfer } = require('../controllers/godownTransferController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.route('/')
  .get(authorize('products:view'), getTransfers)
  .post(authorize('products:manage'), createTransfer);

router.route('/:id')
  .get(authorize('products:view'), getTransferById)
  .delete(authorize('products:manage'), deleteTransfer);

module.exports = router;
