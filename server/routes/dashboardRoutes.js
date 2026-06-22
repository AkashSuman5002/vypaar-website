const express = require('express');
const { getDashboardData } = require('../controllers/dashboardController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.get('/', authorize('dashboard:view'), getDashboardData);

module.exports = router;
