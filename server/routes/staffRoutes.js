const express = require('express');
const { getStaff, createStaff, updateStaff, deleteStaff, getStaffStats } = require('../controllers/staffController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.route('/')
  .get(authorize('staff:view'), getStaff)
  .post(authorize('staff:create'), createStaff);

router.route('/:id')
  .put(authorize('staff:manage'), updateStaff)
  .delete(authorize('staff:manage'), deleteStaff);

router.get('/:id/stats', authorize('staff:view'), getStaffStats);

module.exports = router;
