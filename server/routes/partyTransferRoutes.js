const express = require('express');
const { getPartyTransfers, getPartyTransferById, createPartyTransfer, deletePartyTransfer } = require('../controllers/partyTransferController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.route('/')
  .get(authorize('cashbank:view'), getPartyTransfers)
  .post(authorize('cashbank:manage'), createPartyTransfer);

router.route('/:id')
  .get(authorize('cashbank:view'), getPartyTransferById)
  .delete(authorize('cashbank:manage'), deletePartyTransfer);

module.exports = router;
