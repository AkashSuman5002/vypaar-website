import axios from 'axios';

const API = axios.create({ baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api', withCredentials: true });

const getCsrfToken = () => {
  const match = document.cookie.match(/(?:^|;\s*)vyapar-csrf=([^;]*)/);
  return match ? match[1] : '';
};

API.interceptors.request.use((req) => {
  const user = JSON.parse(localStorage.getItem('user'));
  if (user?.token) {
    req.headers.Authorization = `Bearer ${user.token}`;
  }
  const activeBusiness = localStorage.getItem('activeBusiness');
  if (activeBusiness) {
    req.headers['x-business-id'] = activeBusiness;
  }
  if (['post', 'put', 'delete', 'patch'].includes(req.method) && !req.headers['x-csrf-token']) {
    req.headers['x-csrf-token'] = getCsrfToken();
  }
  return req;
});

export const fetchCsrfToken = () => API.get('/auth/csrf-token');

export const authAPI = {
  login: (data) => API.post('/auth/login', data),
  register: (data) => API.post('/auth/register', data),
  getProfile: () => API.get('/auth/profile'),
  logout: () => API.post('/auth/logout'),
};

export const userAPI = {
  getAll: (params) => API.get('/users', { params }),
  getById: (id) => API.get(`/users/${id}`),
  create: (data) => API.post('/users', data),
  update: (id, data) => API.put(`/users/${id}`, data),
  delete: (id) => API.delete(`/users/${id}`),
  getRoles: () => API.get('/users/roles'),
  createRole: (data) => API.post('/users/roles', data),
  deleteRole: (id) => API.delete(`/users/roles/${id}`),
};

export const customerAPI = {
  getAll: (params) => API.get('/customers', { params }),
  getById: (id) => API.get(`/customers/${id}`),
  create: (data) => API.post('/customers', data),
  update: (id, data) => API.put(`/customers/${id}`, data),
  delete: (id) => API.delete(`/customers/${id}`),
};

export const productAPI = {
  getAll: (params) => API.get('/products', { params }),
  getById: (id) => API.get(`/products/${id}`),
  getSales: (id) => API.get(`/products/${id}/sales`),
  getLastPurchasePrice: (id) => API.get(`/products/${id}/last-purchase-price`),
  create: (data) => API.post('/products', data),
  update: (id, data) => API.put(`/products/${id}`, data),
  delete: (id) => API.delete(`/products/${id}`),
};

export const saleAPI = {
  getAll: (params) => API.get('/sales', { params }),
  getById: (id) => API.get(`/sales/${id}`),
  create: (data) => API.post('/sales', data),
  update: (id, data) => API.put(`/sales/${id}`, data),
  delete: (id) => API.delete(`/sales/${id}`),
  getNextInvoice: () => API.get('/sales/next-invoice'),
  getPDF: (id) => API.get(`/sales/${id}/pdf`, { responseType: 'blob' }),
  duplicate: (id) => API.post(`/sales/${id}/duplicate`),
  convertToReturn: (id) => API.post(`/sales/${id}/convert-to-return`),
  convertToChallan: (id) => API.post(`/sales/${id}/convert-to-challan`),
  convertToEstimate: (id) => API.post(`/sales/${id}/convert-to-estimate`),
  convertToInvoice: (id) => API.post(`/sales/${id}/convert-to-invoice`),
  receivePayment: (id, data) => API.post(`/sales/${id}/receive-payment`, data),
  getByCustomer: (customerId) => API.get(`/sales/customer/${customerId}`),
};

export const purchaseAPI = {
  getAll: (params) => API.get('/purchases', { params }),
  getById: (id) => API.get(`/purchases/${id}`),
  create: (data) => API.post('/purchases', data),
  update: (id, data) => API.put(`/purchases/${id}`, data),
  delete: (id) => API.delete(`/purchases/${id}`),
};

export const supplierAPI = {
  getAll: () => API.get('/suppliers'),
  getById: (id) => API.get(`/suppliers/${id}`),
  create: (data) => API.post('/suppliers', data),
  update: (id, data) => API.put(`/suppliers/${id}`, data),
  delete: (id) => API.delete(`/suppliers/${id}`),
};

export const purchaseReturnAPI = {
  getAll: (params) => API.get('/purchase-returns', { params }),
  getById: (id) => API.get(`/purchase-returns/${id}`),
  create: (data) => API.post('/purchase-returns', data),
  update: (id, data) => API.put(`/purchase-returns/${id}`, data),
  delete: (id) => API.delete(`/purchase-returns/${id}`),
};

export const purchaseOrderAPI = {
  getAll: (params) => API.get('/purchase-orders', { params }),
  getById: (id) => API.get(`/purchase-orders/${id}`),
  create: (data) => API.post('/purchase-orders', data),
  update: (id, data) => API.put(`/purchase-orders/${id}`, data),
  delete: (id) => API.delete(`/purchase-orders/${id}`),
};

export const paymentOutAPI = {
  getAll: (params) => API.get('/payment-out', { params }),
  create: (data) => API.post('/payment-out', data),
  delete: (id) => API.delete(`/payment-out/${id}`),
};

export const transactionAPI = {
  getAll: (params) => API.get('/transactions', { params }),
  create: (data) => API.post('/transactions', data),
  getBalance: () => API.get('/transactions/balance'),
};

export const dashboardAPI = {
  getData: () => API.get('/dashboard'),
};

export const reportAPI = {
  getSales: (params) => API.get('/accounting/reports/sales', { params }),
  getPurchases: (params) => API.get('/accounting/reports/purchases', { params }),
  getProfit: (params) => API.get('/accounting/reports/profit', { params }),
  getPartyStatement: (params) => API.get('/accounting/reports/party-statement', { params }),
  getPartyWiseProfitLoss: (params) => API.get('/accounting/reports/party-wise-profit-loss', { params }),
  getPartyReportByItem: (params) => API.get('/accounting/reports/party-report-by-item', { params }),
  getSalePurchaseByParty: (params) => API.get('/accounting/reports/sale-purchase-by-party', { params }),
  getSalePurchaseByPartyGroup: (params) => API.get('/accounting/reports/sale-purchase-by-party-group', { params }),
  getGST: (params) => API.get('/accounting/reports/gst', { params }),
  getGSTR1: (params) => API.get('/accounting/reports/gstr1', { params }),
  getGSTR3B: (params) => API.get('/accounting/reports/gstr3b', { params }),
  getGSTR9: (params) => API.get('/accounting/reports/gstr9', { params }),
  getHSN: (params) => API.get('/accounting/reports/hsn', { params }),
  getParties: (params) => API.get('/accounting/reports/parties', { params }),
  getCashFlow: (params) => API.get('/accounting/reports/cashflow', { params }),
  getDayBook: (params) => API.get('/accounting/reports/daybook', { params }),
  getOutstanding: (params) => API.get('/accounting/reports/outstanding', { params }),
  getTrialBalance: (params) => API.get('/accounting/trial-balance', { params }),
  getProfitLoss: (params) => API.get('/accounting/profit-loss', { params }),
  getBalanceSheet: (params) => API.get('/accounting/balance-sheet', { params }),
  getJournal: (params) => API.get('/accounting/journal', { params }),
  getAccounts: () => API.get('/accounting/accounts'),
  getGSTR2: (params) => API.get('/accounting/reports/gstr2', { params }),
  getSAC: (params) => API.get('/accounting/reports/sac', { params }),
  getTDSReceivable: (params) => API.get('/accounting/reports/tds-receivable', { params }),
  getTDSPayable: (params) => API.get('/accounting/reports/tds-payable', { params }),
  getTCSReceivable: (params) => API.get('/accounting/reports/tcs-receivable', { params }),
  getForm27EQ: (params) => API.get('/accounting/reports/form27eq', { params }),
  getBankStatement: (params) => API.get('/accounting/reports/bank-statement', { params }),
  getExpenseReport: (params) => API.get('/accounting/reports/expense', { params }),
  getExpenseCategoryReport: (params) => API.get('/accounting/reports/expense-category', { params }),
  getExpenseItemReport: (params) => API.get('/accounting/reports/expense-item', { params }),
  getSaleOrders: (params) => API.get('/accounting/reports/sale-orders', { params }),
  getSaleOrderItem: (params) => API.get('/accounting/reports/sale-order-item', { params }),
  getItemDetail: (params) => API.get('/accounting/reports/item-detail', { params }),
  getStockDetail: (params) => API.get('/accounting/reports/stock-detail', { params }),
  getItemWiseProfitLoss: (params) => API.get('/accounting/reports/item-wise-profit-loss', { params }),
  getItemCategoryProfitLoss: (params) => API.get('/accounting/reports/item-category-profit-loss', { params }),
  getItemReportByParty: (params) => API.get('/accounting/reports/item-report-by-party', { params }),
  getDiscountReport: (params) => API.get('/accounting/reports/discount', { params }),
  getLoanStatement: (params) => API.get('/accounting/reports/loan-statement', { params }),
  getBillWiseProfit: (params) => API.get('/accounting/reports/bill-wise-profit', { params }),
  getPendingOrders: (params) => API.get('/accounting/reports/pending-orders', { params }),
  getEMISchedule: (params) => API.get('/accounting/reports/emi-schedule', { params }),
  getLoanSummary: (params) => API.get('/accounting/reports/loan-summary', { params }),
  getStockAging: (params) => API.get('/accounting/reports/stock-aging', { params }),
  getLowStock: (params) => API.get('/accounting/reports/low-stock', { params }),
  getPaymentReminders: (params) => API.get('/accounting/reports/payment-reminders', { params }),
  getGSTR2AReconciliation: (params) => API.get('/accounting/reports/gstr2a-reconciliation', { params }),
};

export const bankAccountAPI = {
  getAll: () => API.get('/accounting/accounts/bank'),
  create: (data) => API.post('/accounting/accounts/bank', data),
  update: (id, data) => API.put(`/accounting/accounts/${id}`, data),
  delete: (id) => API.delete(`/accounting/accounts/${id}`),
};

export const loanAccountAPI = {
  getAll: () => API.get('/accounting/accounts/loan'),
  create: (data) => API.post('/accounting/accounts/loan', data),
  update: (id, data) => API.put(`/accounting/accounts/${id}`, data),
  delete: (id) => API.delete(`/accounting/accounts/${id}`),
};

export const chequeAPI = {
  getAll: () => API.get('/accounting/cheques'),
};

export const advReportAPI = {
  getCustomers: () => API.get('/adv-reports/customers'),
  getProducts: () => API.get('/adv-reports/products'),
  getPendingPayments: () => API.get('/adv-reports/pending-payments'),
};

export const ledgerAPI = {
  getCustomer: (id) => API.get(`/ledger/customer/${id}`),
  getSupplier: (id) => API.get(`/ledger/supplier/${id}`),
};

export const importAPI = {
  excelUpload: (data) => API.post('/import/excel/upload', data),
  excelPreview: (data) => API.post('/import/excel/preview', data),
  excelExecute: (data) => API.post('/import/excel/execute', data),
  backupUpload: (formData) => API.post('/import/backup/upload', formData, { timeout: 600000 }),
  backupAnalyze: (historyId) => API.get(`/import/backup/analyze/${historyId}`),
  backupExecute: (data) => API.post('/import/backup/execute', data, { timeout: 600000 }),
  getHistory: (params) => API.get('/import/history', { params }),
  getHistoryById: (id) => API.get(`/import/history/${id}`),
  getHistoryLog: (id) => API.get(`/import/history/${id}/log`, { responseType: 'blob' }),
  deleteHistory: (id) => API.delete(`/import/history/${id}`),
};

export const settingAPI = {
  get: () => API.get('/settings'),
  update: (data) => API.put('/settings', data),
  updateWithLogo: (formData) => API.put('/settings', formData),
  verifyPasscode: (passcode) => API.post('/settings/verify-passcode', { passcode }),
  clearPasscode: () => API.delete('/settings/passcode'),
};

export const stockAPI = {
  getMovements: (params) => API.get('/stock/movements', { params }),
  getValuation: () => API.get('/stock/valuation'),
  adjustStock: (data) => API.put('/stock/adjust', data),
};

export const exportAPI = {
  getCounts: () => API.get('/export/counts'),
  excelExport: (data) => API.post('/export/excel', data, { timeout: 120000, responseType: 'blob' }),
  backupExport: () => API.post('/export/backup', {}, { timeout: 120000, responseType: 'blob' }),
  reportExport: (data) => API.post('/export/report', data, { timeout: 120000, responseType: 'blob' }),
  getHistory: (params) => API.get('/export/history', { params }),
  getHistoryById: (id) => API.get(`/export/history/${id}`),
  downloadHistory: (id) => API.get(`/export/history/${id}/download`, { responseType: 'blob' }),
  deleteHistory: (id) => API.delete(`/export/history/${id}`),
};

export const expenseAPI = {
  getAll: (params) => API.get('/expenses', { params }),
  getById: (id) => API.get(`/expenses/${id}`),
  create: (data) => API.post('/expenses', data),
  update: (id, data) => API.put(`/expenses/${id}`, data),
  delete: (id) => API.delete(`/expenses/${id}`),
};

export const journalAPI = {
  getAll: (params) => API.get('/accounting/journal', { params }),
  create: (data) => API.post('/accounting/journal', data),
  getAccounts: () => API.get('/accounting/accounts'),
};

export const chartOfAccountsAPI = {
  getAll: () => API.get('/accounting/accounts'),
  create: (data) => API.post('/accounting/accounts', data),
  update: (id, data) => API.put(`/accounting/accounts/${id}`, data),
  delete: (id) => API.delete(`/accounting/accounts/${id}`),
  getStatement: (id, params) => API.get(`/accounting/accounts/${id}/statement`, { params }),
};

export const receiptAPI = {
  getAll: (params) => API.get('/receipts', { params }),
  getById: (id) => API.get(`/receipts/${id}`),
  getPDF: (id) => API.get(`/receipts/${id}/pdf`, { responseType: 'blob' }),
};

export const notificationAPI = {
  getAll: () => API.get('/notifications'),
  getUnreadCount: () => API.get('/notifications/unread-count'),
  markAsRead: (id) => API.put(`/notifications/${id}/read`),
  markAllAsRead: () => API.put('/notifications/read-all'),
  delete: (id) => API.delete(`/notifications/${id}`),
};

export const ledgerNoteAPI = {
  get: (partyType, partyId) => API.get(`/ledger-notes/${partyType}/${partyId}`),
  save: (partyType, partyId, note) => API.put(`/ledger-notes/${partyType}/${partyId}`, { note }),
};

export const businessAPI = {
  getStatus: () => API.get('/business/status'),
  getAll: () => API.get('/business/all'),
  create: (data) => API.post('/business', data),
  setup: (data) => API.post('/business/setup', data),
  updateProfile: (formData) => API.put('/business/profile', formData),
  update: (id, data) => API.put(`/business/${id}`, data),
  delete: (id) => API.delete(`/business/${id}`),
  switch: (businessId) => API.post(`/business/${businessId}/switch`),
};

export const themeAPI = {
  get: () => API.get('/settings/theme'),
  update: (darkMode) => API.put('/settings/theme', { darkMode }),
};

export const barcodeLabelAPI = {
  generate: (data) => API.post('/barcode-labels/labels', data, { responseType: 'blob' }),
};

export const godownAPI = {
  getAll: () => API.get('/godowns'),
  create: (data) => API.post('/godowns', data),
  update: (id, data) => API.put(`/godowns/${id}`, data),
  delete: (id) => API.delete(`/godowns/${id}`),
};

export const auditAPI = {
  getAll: (params) => API.get('/audit', { params }),
  getStats: () => API.get('/audit/stats'),
};

export const partyRateAPI = {
  getAll: (params) => API.get('/party-rates', { params }),
  getByParty: (partyId) => API.get(`/party-rates/party/${partyId}`),
  getForProduct: (partyId, productId) => API.get(`/party-rates/party/${partyId}/product/${productId}`),
  create: (data) => API.post('/party-rates', data),
  update: (id, data) => API.put(`/party-rates/${id}`, data),
  delete: (id) => API.delete(`/party-rates/${id}`),
  bulkCreate: (rates) => API.post('/party-rates/bulk', { rates }),
};

export const loyaltyAPI = {
  getAll: (params) => API.get('/loyalty-points', { params }),
  getBalance: (customerId) => API.get(`/loyalty-points/balance/${customerId}`),
  earn: (data) => API.post('/loyalty-points/earn', data),
  redeem: (data) => API.post('/loyalty-points/redeem', data),
  adjust: (data) => API.post('/loyalty-points/adjust', data),
};

export const backupAPI = {
  getHistory: () => API.get('/backup/history'),
  create: () => API.post('/backup/create'),
  download: (filename) => API.get(`/backup/download/${filename}`, { responseType: 'blob' }),
};

export const utilityAPI = {
  verifyData: (params) => API.get('/utilities/verify', { params }),
  closeFinancialYear: (data) => API.post('/utilities/close-financial-year', data),
  getFinancialYearStatus: () => API.get('/utilities/financial-year-status'),
  exportToTally: (data) => API.post('/utilities/export-tally', data, { timeout: 120000, responseType: 'blob' }),
  importFromTally: (data) => API.post('/utilities/import-tally', data),
  getAccountantAccess: () => API.get('/utilities/accountant-access'),
  inviteAccountant: (data) => API.post('/utilities/accountant-access/invite', data),
  removeAccountantAccess: (id) => API.delete(`/utilities/accountant-access/${id}`),
  getSalesmenTracking: (params) => API.get('/utilities/track-salesmen', { params }),
  bulkUpdateItems: (data) => API.post('/utilities/bulk-update-items', data),
};

export const supportAPI = {
  create: (data) => API.post('/support', data),
  getMyTickets: () => API.get('/support'),
  getById: (id) => API.get(`/support/${id}`),
};

export const whatsappAPI = {
  getStatus: () => API.get('/whatsapp/status'),
  connect: () => API.post('/whatsapp/connect'),
  disconnect: () => API.post('/whatsapp/disconnect'),
  getQRStream: () => {
    const user = JSON.parse(localStorage.getItem('user'));
    const token = user?.token || '';
    return `${API.defaults.baseURL}/whatsapp/qr?token=${encodeURIComponent(token)}`;
  },
  send: (data) => API.post('/whatsapp/send', data),
  getMessages: (params) => API.get('/whatsapp/messages', { params }),
  getMessageStats: () => API.get('/whatsapp/messages/stats'),
  getTemplates: () => API.get('/whatsapp/templates'),
  saveTemplates: (templates) => API.post('/whatsapp/templates', { templates }),
};

export const staffAPI = {
  getAll: (params) => API.get('/staff', { params }),
  create: (data) => API.post('/staff', data),
  update: (id, data) => API.put(`/staff/${id}`, data),
  delete: (id) => API.delete(`/staff/${id}`),
  getStats: (id, params) => API.get(`/staff/${id}/stats`, { params }),
};

export default API;
