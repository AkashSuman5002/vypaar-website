const express = require('express');
const router = express.Router();
const { generateBarcodeLabels } = require('../controllers/barcodeLabelController');
const { authorize } = require('../middleware/authorize');

router.post('/labels', authorize('products:manage'), generateBarcodeLabels);

module.exports = router;
