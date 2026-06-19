const express = require('express');
const QRCode = require('qrcode');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { generateBase32Secret, verifyTotp, buildOtpauthUrl } = require('../utils/totp');

const router = express.Router();

// All 2FA management endpoints require an authenticated session (an already-logged-in user
// turning 2FA on/off for their own account). The router is also mounted behind authMiddleware
// in server.js, but we attach it here too so the file is self-contained / safe if remounted.

// POST /setup — generate (but do NOT yet enable) a fresh TOTP secret, persist it, and return
// the otpauth URL + a QR data-URL the client renders for the authenticator app to scan.
router.post('/setup', authMiddleware, async (req, res) => {
  try {
    const secret = generateBase32Secret();
    const user = await User.findById(req.user._id).select('+twoFactorSecret');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Store the candidate secret but keep twoFactorEnabled as-is (only /enable flips it on),
    // so a half-finished setup can never lock the user out.
    user.twoFactorSecret = secret;
    await user.save();

    const otpauthUrl = buildOtpauthUrl({
      secret,
      label: user.email || user.name || 'user',
      issuer: 'Vyapar',
    });
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

    res.json({ otpauthUrl, qrDataUrl, secret });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /enable — body { token }. Verify the 6-digit code against the stored secret, and on
// success flip twoFactorEnabled = true. From the NEXT login on, 2FA is enforced.
router.post('/enable', authMiddleware, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Verification code is required' });

    const user = await User.findById(req.user._id).select('+twoFactorSecret');
    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ message: 'Start 2FA setup first' });
    }
    if (!verifyTotp(token, user.twoFactorSecret)) {
      return res.status(400).json({ message: 'Invalid code. Please try again.' });
    }
    user.twoFactorEnabled = true;
    await user.save();
    res.json({ message: 'Two-factor authentication enabled', twoFactorEnabled: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /disable — body { token }. Require a valid current code (so a hijacked session that
// lacks the authenticator can't silently turn 2FA off), then clear the secret + disable.
router.post('/disable', authMiddleware, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Verification code is required' });

    const user = await User.findById(req.user._id).select('+twoFactorSecret');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ message: 'Two-factor authentication is not enabled' });
    }
    if (!verifyTotp(token, user.twoFactorSecret)) {
      return res.status(400).json({ message: 'Invalid code. Please try again.' });
    }
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    await user.save();
    res.json({ message: 'Two-factor authentication disabled', twoFactorEnabled: false });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /status — lightweight check the Settings UI uses to render the correct state.
router.get('/status', authMiddleware, async (req, res) => {
  try {
    res.json({ twoFactorEnabled: !!req.user.twoFactorEnabled });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
