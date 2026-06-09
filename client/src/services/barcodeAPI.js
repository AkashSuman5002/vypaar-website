import API from './api';

const barcodeAPI = {
  scan: (data) => API.post('/imports/barcode/scan', data),
  lookup: (data) => API.post('/imports/barcode/lookup', data),
  uploadImage: (formData) => API.post('/imports/barcode/image', formData, {
    timeout: 60000,
  }),
  previewCSV: (formData) => API.post('/imports/barcode/csv/preview', formData, {
    timeout: 120000,
  }),
  executeCSV: (data) => API.post('/imports/barcode/csv/execute', data, { timeout: 300000 }),
  bulkImport: (data) => API.post('/imports/barcode/bulk', data, { timeout: 300000 }),
  createProduct: (data) => API.post('/imports/barcode/products', data),
  updateProduct: (id, data) => API.put(`/imports/barcode/products/${id}`, data),
  getHistory: (params) => API.get('/imports/barcode/history', { params }),
  getHistoryById: (id) => API.get(`/imports/barcode/history/${id}`),
  deleteHistory: (id) => API.delete(`/imports/barcode/history/${id}`),
  getScanHistory: (params) => API.get('/imports/barcode/scan-history', { params }),
  getDashboardStats: () => API.get('/imports/barcode/dashboard-stats'),
};

export default barcodeAPI;
