const express = require('express');
const { authorize } = require('../middleware/authorize');
const { sseAuthMiddleware } = require('../middleware/auth');
const {
  getStatus, connect, disconnect, qrStream, send,
  getMessages, getMessageStats, getTemplates, saveTemplates,
} = require('../controllers/whatsappController');

const router = express.Router();

router.get('/status', authorize('settings:view'), getStatus);
router.post('/connect', authorize('settings:manage'), connect);
router.post('/disconnect', authorize('settings:manage'), disconnect);
router.get('/qr', sseAuthMiddleware, qrStream);
router.post('/send', authorize('settings:manage'), send);
router.get('/messages', authorize('settings:view'), getMessages);
router.get('/messages/stats', authorize('settings:view'), getMessageStats);
router.get('/templates', authorize('settings:view'), getTemplates);
router.post('/templates', authorize('settings:manage'), saveTemplates);

module.exports = router;
