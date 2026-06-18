const express = require('express');
const { getNotifications, markAsRead, markAllAsRead, deleteNotification, clearAllNotifications, getUnreadCount, getVapidPublicKey, subscribePush, unsubscribePush } = require('../controllers/notificationController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.route('/').get(authorize('notifications:view'), getNotifications);
router.get('/unread-count', authorize('notifications:view'), getUnreadCount);
router.get('/push/vapid-public-key', authorize('notifications:view'), getVapidPublicKey);
router.post('/push/subscribe', authorize('notifications:view'), subscribePush);
router.post('/push/unsubscribe', authorize('notifications:view'), unsubscribePush);
router.put('/read-all', authorize('notifications:manage'), markAllAsRead);
router.put('/:id/read', authorize('notifications:manage'), markAsRead);
router.delete('/clear-all', authorize('notifications:manage'), clearAllNotifications);
router.delete('/:id', authorize('notifications:manage'), deleteNotification);

module.exports = router;
