const express = require('express');
const { getPartyGroups, createPartyGroup, updatePartyGroup, deletePartyGroup, getPartyGroupSummary } = require('../controllers/partyGroupController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.get('/summary', authorize('suppliers:view'), getPartyGroupSummary);

router.route('/')
  .get(authorize('suppliers:view'), getPartyGroups)
  .post(authorize('suppliers:manage'), createPartyGroup);

router.route('/:id')
  .put(authorize('suppliers:manage'), updatePartyGroup)
  .delete(authorize('suppliers:manage'), deletePartyGroup);

module.exports = router;
