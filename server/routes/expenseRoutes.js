const express = require('express');
const { getExpenses, getExpenseById, createExpense, updateExpense, deleteExpense } = require('../controllers/expenseController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.route('/')
  .get(authorize('expenses:view'), getExpenses)
  .post(authorize('expenses:create'), createExpense);

router.route('/:id')
  .get(authorize('expenses:view'), getExpenseById)
  .put(authorize('expenses:manage'), updateExpense)
  .delete(authorize('expenses:manage'), deleteExpense);

module.exports = router;
