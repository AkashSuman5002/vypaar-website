const express = require('express');
const { authorize } = require('../middleware/authorize');
const {
  getReminders,
  getReminder,
  createReminder,
  updateReminder,
  deleteReminder,
  getItemsForReminder,
} = require('../controllers/serviceReminderController');

const router = express.Router();

router.get('/items', authorize('settings:view'), getItemsForReminder);

router.route('/')
  .get(authorize('settings:view'), getReminders)
  .post(authorize('settings:manage'), createReminder);

router.route('/:id')
  .get(authorize('settings:view'), getReminder)
  .put(authorize('settings:manage'), updateReminder)
  .delete(authorize('settings:manage'), deleteReminder);

module.exports = router;
