const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getSettings, updateSettings, getTheme, updateTheme, verifyPasscode, clearPasscode } = require('../controllers/settingController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

// Multer for logo/signature uploads on PUT /settings. Without this middleware
// req.files is never populated, so logo/signature uploads silently no-op.
// Reuses the shared server uploads dir (same as the global logo storage).
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype);
    if (extOk && mimeOk) cb(null, true);
    else cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed'));
  },
});

// .fields() accepts logo/signature/file uploads but also passes plain JSON-body
// PUTs through untouched (req.files is simply empty), preserving non-file saves.
const settingsUpload = upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'signature', maxCount: 1 },
  { name: 'file', maxCount: 1 },
]);

router.route('/')
  .get(authorize('settings:view'), getSettings)
  .put(authorize('settings:manage'), settingsUpload, updateSettings);

router.get('/theme', authorize('settings:view'), getTheme);
router.put('/theme', authorize('settings:manage'), updateTheme);
router.post('/verify-passcode', authorize('settings:view'), verifyPasscode);
router.delete('/passcode', authorize('settings:manage'), clearPasscode);

module.exports = router;
