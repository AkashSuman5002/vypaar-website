const express = require('express');
const { getBudgets, createBudget, updateBudget, deleteBudget, getBudgetVsActual, getBudgetAlerts } = require('../controllers/budgetController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.get('/actual', authorize('expenses:view'), getBudgetVsActual);
router.get('/alerts', authorize('expenses:view'), getBudgetAlerts);

router.route('/')
  .get(authorize('expenses:view'), getBudgets)
  .post(authorize('expenses:create'), createBudget);

router.route('/:id')
  .put(authorize('expenses:manage'), updateBudget)
  .delete(authorize('expenses:manage'), deleteBudget);

module.exports = router;
