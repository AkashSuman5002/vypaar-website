const express = require('express');
const router = express.Router();
const {
  getCounts, excelExport, backupExport, reportExport,
  getHistory, getHistoryById, deleteHistory, downloadHistory,
} = require('../controllers/exportController');
const { authorize } = require('../middleware/authorize');

// Data counts
router.get('/counts', authorize('reports:view'), getCounts);

// Excel export
router.post('/excel', authorize('reports:export'), excelExport);

// Full backup
router.post('/backup', authorize('settings:manage'), backupExport);

// Report export
router.post('/report', authorize('reports:export'), reportExport);

// Export history
router.get('/history', authorize('reports:view'), getHistory);
router.get('/history/:id', authorize('reports:view'), getHistoryById);
router.get('/history/:id/download', authorize('reports:export'), downloadHistory);
router.delete('/history/:id', authorize('settings:manage'), deleteHistory);

module.exports = router;
