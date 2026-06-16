const express = require('express');
const { getGSTR1Data, getGSTR2Data, getGSTR3BData, prepareGSTR1JSON, getFilings, markFiled } = require('../controllers/gstFilingController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.get('/gstr1', authorize('reports:view'), getGSTR1Data);
router.get('/gstr2', authorize('reports:view'), getGSTR2Data);
router.get('/gstr3b', authorize('reports:view'), getGSTR3BData);
router.get('/prepare-gstr1', authorize('reports:manage'), prepareGSTR1JSON);
router.get('/filings', authorize('reports:view'), getFilings);
router.put('/filings/:id/filed', authorize('reports:manage'), markFiled);

module.exports = router;
