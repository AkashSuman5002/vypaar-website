const express = require('express');
const router = express.Router();
const { runSync, getStatus, isEnabled } = require('../services/syncService');
const { authorizeAdmin } = require('../middleware/authorize');

// Current sync status (enabled? connected? last pass summary).
router.get('/status', (req, res) => {
  res.json(getStatus());
});

// Trigger an immediate sync pass (admin only). Returns the pass summary.
router.post('/now', authorizeAdmin, async (req, res) => {
  if (!isEnabled()) {
    return res.status(400).json({ message: 'Cloud sync is not enabled on this device' });
  }
  try {
    const result = await runSync();
    res.json({ message: 'Sync complete', result });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
