const express = require('express');
const router = express.Router();
const { createTicket, getMyTickets, getTicketById, replyToTicket, userReplyToTicket, upload } = require('../controllers/supportController');
const { authorize } = require('../middleware/authorize');

router.post('/', authorize('support:manage'), upload.any(), createTicket);
router.get('/', authorize('support:view'), getMyTickets);
router.get('/:id', authorize('support:view'), getTicketById);
router.post('/:id/reply', authorize('support:manage'), upload.any(), replyToTicket);
router.post('/:id/user-reply', authorize('support:view'), upload.any(), userReplyToTicket);

module.exports = router;
