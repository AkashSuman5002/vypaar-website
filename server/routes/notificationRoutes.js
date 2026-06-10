const express = require('express');
const { getNotifications, markAsRead, markAllAsRead, deleteNotification, getUnreadCount } = require('../controllers/notificationController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.route('/').get(authorize('notifications:view'), getNotifications);
router.get('/unread-count', authorize('notifications:view'), getUnreadCount);
router.put('/:id/read', authorize('notifications:manage'), markAsRead);
router.put('/read-all', authorize('notifications:manage'), markAllAsRead);
router.delete('/:id', authorize('notifications:manage'), deleteNotification);

module.exports = router;
