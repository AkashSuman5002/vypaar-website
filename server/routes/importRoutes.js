const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  excelUpload, excelPreview, excelExecute,
  backupUpload, backupAnalyze, backupExecute,
  getHistory, getHistoryById, deleteHistory, getHistoryLog,
} = require('../controllers/importController');
const { authorize } = require('../middleware/authorize');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'imports');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `backup-${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });

// Excel import
router.post('/excel/upload', authorize('settings:manage'), excelUpload);
router.post('/excel/preview', authorize('settings:manage'), excelPreview);
router.post('/excel/execute', authorize('settings:manage'), excelExecute);

// Vyapar backup import
router.post('/backup/upload', authorize('settings:manage'), upload.single('backup'), backupUpload);
router.get('/backup/analyze/:historyId', authorize('settings:view'), backupAnalyze);
router.post('/backup/execute', authorize('settings:manage'), backupExecute);

// Import history
router.get('/history', authorize('settings:view'), getHistory);
router.get('/history/:id', authorize('settings:view'), getHistoryById);
router.get('/history/:id/log', authorize('settings:view'), getHistoryLog);
router.delete('/history/:id', authorize('settings:manage'), deleteHistory);

module.exports = router;
