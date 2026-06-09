const express = require('express');
const { getPartyRates, getRatesForParty, getRateForProduct, createPartyRate, updatePartyRate, deletePartyRate, bulkCreatePartyRates } = require('../controllers/partyRateController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.route('/')
  .get(authorize('products:view'), getPartyRates)
  .post(authorize('products:manage'), createPartyRate);

router.post('/bulk', authorize('products:manage'), bulkCreatePartyRates);
router.get('/party/:partyId', authorize('products:view'), getRatesForParty);
router.get('/party/:partyId/product/:productId', authorize('products:view'), getRateForProduct);

router.route('/:id')
  .put(authorize('products:manage'), updatePartyRate)
  .delete(authorize('products:manage'), deletePartyRate);

module.exports = router;
