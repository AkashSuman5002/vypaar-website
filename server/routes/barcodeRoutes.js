const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  scanBarcode,
  lookupBarcode,
  uploadBarcodeImage,
  previewCSV,
  executeCSV,
  getHistory,
  getHistoryById,
  deleteImport,
  getScanHistory,
  getDashboardStats,
  createProduct,
  updateProduct,
  bulkImport,
} = require('../controllers/barcodeController');
const { authorize } = require('../middleware/authorize');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'barcodes');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `barcode-${Date.now()}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.csv', '.xls', '.xlsx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Allowed: ${allowed.join(', ')}`));
    }
  },
});

router.post('/scan', authorize('products:view'), scanBarcode);
router.post('/lookup', authorize('products:view'), lookupBarcode);
router.post('/image', authorize('products:manage'), upload.single('image'), uploadBarcodeImage);
router.post('/csv/preview', authorize('products:manage'), upload.single('file'), previewCSV);
router.post('/csv/execute', authorize('products:manage'), executeCSV);
router.post('/bulk', authorize('products:manage'), bulkImport);
router.post('/products', authorize('products:manage'), createProduct);
router.put('/products/:id', authorize('products:manage'), updateProduct);
router.get('/history', authorize('products:view'), getHistory);
router.get('/history/:id', authorize('products:view'), getHistoryById);
router.delete('/history/:id', authorize('products:manage'), deleteImport);
router.get('/scan-history', authorize('products:view'), getScanHistory);
router.get('/dashboard-stats', authorize('products:view'), getDashboardStats);

module.exports = router;
