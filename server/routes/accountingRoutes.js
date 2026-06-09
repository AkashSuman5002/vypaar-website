const express = require('express');
const router = express.Router();
const {
  getAccounts, getJournalEntries, createJournalEntry, getTrialBalance, getProfitLoss, getBalanceSheet,
  getBankAccounts, createBankAccount, getLoanAccounts, createLoanAccount, getCheques,
  createAccount, updateAccount, deleteAccount, getAccountStatement,
} = require('../controllers/accountingController');
const reportCtrl = require('../controllers/reportController');
const { authorize } = require('../middleware/authorize');

// Chart of Accounts
router.get('/accounts', authorize('accounting:view'), getAccounts);
router.post('/accounts', authorize('accounting:manage'), createAccount);

// Bank Accounts (must be before :id routes)
router.get('/accounts/bank', authorize('accounting:view'), getBankAccounts);
router.post('/accounts/bank', authorize('accounting:manage'), createBankAccount);

// Loan Accounts (must be before :id routes)
router.get('/accounts/loan', authorize('accounting:view'), getLoanAccounts);
router.post('/accounts/loan', authorize('accounting:manage'), createLoanAccount);

// Account CRUD & Statement (must be after static routes)
router.put('/accounts/:id', authorize('accounting:manage'), updateAccount);
router.delete('/accounts/:id', authorize('accounting:manage'), deleteAccount);
router.get('/accounts/:id/statement', authorize('accounting:view'), getAccountStatement);

// Cheques
router.get('/cheques', authorize('accounting:view'), getCheques);

// Journal Entries
router.get('/journal', authorize('accounting:view'), getJournalEntries);
router.post('/journal', authorize('accounting:manage'), createJournalEntry);

// Financial Reports
router.get('/trial-balance', authorize('accounting:view'), getTrialBalance);
router.get('/profit-loss', authorize('accounting:view'), getProfitLoss);
router.get('/balance-sheet', authorize('accounting:view'), getBalanceSheet);

// Report routes
router.get('/reports/sales', authorize('reports:view'), reportCtrl.getSalesReport);
router.get('/reports/purchases', authorize('reports:view'), reportCtrl.getPurchaseReport);
router.get('/reports/profit', authorize('reports:view'), reportCtrl.getProfitReport);

// GST Reports
router.get('/reports/gst', authorize('reports:view'), reportCtrl.getGSTReport);
router.get('/reports/gstr1', authorize('reports:view'), reportCtrl.getGSTR1);
router.get('/reports/gstr3b', authorize('reports:view'), reportCtrl.getGSTR3B);
router.get('/reports/gstr9', authorize('reports:view'), reportCtrl.getGSTR9Report);
router.get('/reports/hsn', authorize('reports:view'), reportCtrl.getHSNSummary);

// Party Reports
router.get('/reports/parties', authorize('reports:view'), reportCtrl.getPartyReport);
router.get('/reports/party-statement', authorize('reports:view'), reportCtrl.getPartyStatement);
router.get('/reports/party-wise-profit-loss', authorize('reports:view'), reportCtrl.getPartyWiseProfitLoss);
router.get('/reports/party-report-by-item', authorize('reports:view'), reportCtrl.getPartyReportByItem);
router.get('/reports/sale-purchase-by-party', authorize('reports:view'), reportCtrl.getSalePurchaseByParty);
router.get('/reports/sale-purchase-by-party-group', authorize('reports:view'), reportCtrl.getSalePurchaseByPartyGroup);

// Cash Flow & Day Book
router.get('/reports/cashflow', authorize('reports:view'), reportCtrl.getCashFlow);
router.get('/reports/daybook', authorize('reports:view'), reportCtrl.getDayBook);

// Outstanding Report
router.get('/reports/outstanding', authorize('reports:view'), reportCtrl.getOutstandingReport);

// GSTR2 - Purchase-side GSTR
router.get('/reports/gstr2', authorize('reports:view'), reportCtrl.getGSTR2);
router.get('/reports/sac', authorize('reports:view'), reportCtrl.getSAC);

// TDS / TCS Reports
router.get('/reports/tds-receivable', authorize('reports:view'), reportCtrl.getTDSReceivable);
router.get('/reports/tds-payable', authorize('reports:view'), reportCtrl.getTDSPayable);
router.get('/reports/tcs-receivable', authorize('reports:view'), reportCtrl.getTCSReceivable);
router.get('/reports/form27eq', authorize('reports:view'), reportCtrl.getForm27EQ);

// Bank Statement
router.get('/reports/bank-statement', authorize('reports:view'), reportCtrl.getBankStatement);

// Expense Reports
router.get('/reports/expense', authorize('reports:view'), reportCtrl.getExpenseReport);
router.get('/reports/expense-category', authorize('reports:view'), reportCtrl.getExpenseCategoryReport);
router.get('/reports/expense-item', authorize('reports:view'), reportCtrl.getExpenseItemReport);

// Sale Orders & Discount
router.get('/reports/sale-orders', authorize('reports:view'), reportCtrl.getSaleOrders);
router.get('/reports/sale-order-item', authorize('reports:view'), reportCtrl.getSaleOrderItem);
router.get('/reports/item-detail', authorize('reports:view'), reportCtrl.getItemDetail);
router.get('/reports/stock-detail', authorize('reports:view'), reportCtrl.getStockDetail);
router.get('/reports/item-wise-profit-loss', authorize('reports:view'), reportCtrl.getItemWiseProfitLoss);
router.get('/reports/item-category-profit-loss', authorize('reports:view'), reportCtrl.getItemCategoryProfitLoss);
router.get('/reports/item-report-by-party', authorize('reports:view'), reportCtrl.getItemReportByParty);
router.get('/reports/discount', authorize('reports:view'), reportCtrl.getDiscountReport);

// Loan Statement
router.get('/reports/loan-statement', authorize('reports:view'), reportCtrl.getLoanStatement);

// Bill Wise Profit
router.get('/reports/bill-wise-profit', authorize('reports:view'), reportCtrl.getBillWiseProfit);

// Pending Orders
router.get('/reports/pending-orders', authorize('reports:view'), reportCtrl.getPendingOrders);

// EMI Schedule
router.get('/reports/emi-schedule', authorize('reports:view'), reportCtrl.getEMISchedule);

// Loan Summary
router.get('/reports/loan-summary', authorize('reports:view'), reportCtrl.getLoanSummary);

// Stock Aging Report
router.get('/reports/stock-aging', authorize('reports:view'), reportCtrl.getStockAging);

// Low Stock Report
router.get('/reports/low-stock', authorize('reports:view'), reportCtrl.getLowStockReport);

// Payment Reminders
router.get('/reports/payment-reminders', authorize('reports:view'), reportCtrl.getPaymentReminders);

// GSTR-2A Reconciliation
router.get('/reports/gstr2a-reconciliation', authorize('reports:view'), reportCtrl.getGSTR2AReconciliation);

module.exports = router;
