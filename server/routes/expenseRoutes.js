const express = require('express');
const { getExpenses, getExpenseById, createExpense, updateExpense, deleteExpense, approveExpense, rejectExpense } = require('../controllers/expenseController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.route('/')
  .get(authorize('expenses:view'), getExpenses)
  .post(authorize('expenses:create'), createExpense);

router.route('/:id')
  .get(authorize('expenses:view'), getExpenseById)
  .put(authorize('expenses:manage'), updateExpense)
  .delete(authorize('expenses:manage'), deleteExpense);

router.put('/:id/approve', authorize('expenses:manage'), approveExpense);
router.put('/:id/reject', authorize('expenses:manage'), rejectExpense);

module.exports = router;
