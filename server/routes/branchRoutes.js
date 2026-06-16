const express = require('express');
const { getAll, getById, create, update, remove } = require('../controllers/branchController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.route('/')
  .get(authorize('settings:view'), getAll)
  .post(authorize('settings:manage'), create);

router.route('/:id')
  .get(authorize('settings:view'), getById)
  .put(authorize('settings:manage'), update)
  .delete(authorize('settings:manage'), remove);

module.exports = router;
