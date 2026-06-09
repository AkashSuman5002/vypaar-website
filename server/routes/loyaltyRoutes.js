const express = require('express');
const { getLoyaltyPoints, getCustomerBalance, earnPoints, redeemPoints, adjustPoints } = require('../controllers/loyaltyController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.get('/', authorize('customers:view'), getLoyaltyPoints);
router.get('/balance/:customerId', authorize('customers:view'), getCustomerBalance);
router.post('/earn', authorize('customers:manage'), earnPoints);
router.post('/redeem', authorize('customers:manage'), redeemPoints);
router.post('/adjust', authorize('customers:manage'), adjustPoints);

module.exports = router;
