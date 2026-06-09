const express = require('express');
const router = express.Router();
const { createTicket, getMyTickets, getTicketById } = require('../controllers/supportController');

router.post('/', createTicket);
router.get('/', getMyTickets);
router.get('/:id', getTicketById);

module.exports = router;
