const express = require('express');
const router = express.Router();
const { createTicket, getMyTickets, getTicketById } = require('../controllers/supportController');
const { authorize } = require('../middleware/authorize');

router.post('/', authorize('support:manage'), createTicket);
router.get('/', authorize('support:view'), getMyTickets);
router.get('/:id', authorize('support:view'), getTicketById);

module.exports = router;
