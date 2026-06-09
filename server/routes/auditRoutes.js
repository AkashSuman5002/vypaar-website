const express = require('express');
const { getAuditLogs, getAuditStats } = require('../controllers/auditController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.get('/', authorize('settings:view'), getAuditLogs);
router.get('/stats', authorize('settings:view'), getAuditStats);

module.exports = router;
