const express = require('express');
const { authorize } = require('../middleware/authorize');
const { sseAuthMiddleware } = require('../middleware/auth');
const {
  getStatus, connect, disconnect, qrStream, send, sendDocument,
  getMessages, getMessageStats, getTemplates, saveTemplates,
} = require('../controllers/whatsappController');

const router = express.Router();

router.get('/status', authorize('settings:view'), getStatus);
router.post('/connect', authorize('settings:manage'), connect);
router.post('/disconnect', authorize('settings:manage'), disconnect);
router.get('/qr', sseAuthMiddleware, qrStream);
router.post('/send', authorize('settings:manage'), send);
// Sending a document (invoice/receipt PDF) is part of the normal sales workflow,
// so it's available to any authenticated user (not gated behind settings:manage).
router.post('/send-document', sendDocument);
router.get('/messages', authorize('settings:view'), getMessages);
router.get('/messages/stats', authorize('settings:view'), getMessageStats);
router.get('/templates', authorize('settings:view'), getTemplates);
router.post('/templates', authorize('settings:manage'), saveTemplates);

module.exports = router;
