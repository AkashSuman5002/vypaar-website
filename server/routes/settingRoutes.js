const express = require('express');
const { getSettings, updateSettings, getTheme, updateTheme, verifyPasscode, clearPasscode } = require('../controllers/settingController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.route('/')
  .get(authorize('settings:view'), getSettings)
  .put(authorize('settings:manage'), updateSettings);

router.get('/theme', authorize('settings:view'), getTheme);
router.put('/theme', authorize('settings:manage'), updateTheme);
router.post('/verify-passcode', authorize('settings:view'), verifyPasscode);
router.delete('/passcode', authorize('settings:manage'), clearPasscode);

module.exports = router;
