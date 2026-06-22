const express = require('express');
const { getNote, saveNote } = require('../controllers/ledgerNoteController');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.get('/:partyType/:partyId', authorize('reports:view'), getNote);
router.put('/:partyType/:partyId', authorize('reports:view'), saveNote);

module.exports = router;
