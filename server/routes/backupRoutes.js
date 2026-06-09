const express = require('express');
const { createBackup, getBackupHistory, downloadBackup } = require('../services/backupService');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.get('/history', authorize('settings:view'), (req, res) => {
  try {
    const history = getBackupHistory();
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/create', authorize('settings:manage'), async (req, res) => {
  try {
    const filename = await createBackup();
    if (!filename) return res.status(500).json({ message: 'Backup failed' });
    res.json({ message: 'Backup created', filename });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/download/:filename', authorize('settings:view'), (req, res) => {
  try {
    const filepath = downloadBackup(req.params.filename);
    if (!filepath) return res.status(404).json({ message: 'Backup not found' });
    res.download(filepath);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
