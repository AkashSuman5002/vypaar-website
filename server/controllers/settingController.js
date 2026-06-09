const Setting = require('../models/Setting');
const Business = require('../models/Business');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');

const stripPasscodeHash = (doc) => {
  if (!doc) return doc;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  if (obj.preferences?.general?.passcodeHash !== undefined) {
    obj.preferences.general.passcodeHash = '';
  }
  return obj;
};

const getSettings = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    let settings = await Setting.findOne({ ...baseFilter });
    if (!settings) {
      settings = await Setting.create({ ...getCreateData(req, {}) });
    }
    res.json(stripPasscodeHash(settings));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const setNestedValue = (obj, path, value) => {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) current[keys[i]] = {};
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
};

const updateSettings = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    let settings = await Setting.findOne({ ...baseFilter });
    if (!settings) {
      settings = await Setting.create({ ...getCreateData(req, {}) });
    }

    const topLevelFields = [
      'businessName', 'phone', 'email', 'address', 'gstNumber',
      'gstNumber', 'invoicePrefix', 'invoiceNote', 'currency',
      'state', 'isInterState', 'bankName', 'bankAccountNumber',
      'bankIfsc', 'bankBranch', 'upiId',
      'businessType', 'businessCategory', 'pincode', 'accountBooksBeginningDate',
      'signature', 'sharedWith',
    ];

    for (const field of topLevelFields) {
      if (req.body[field] !== undefined) {
        settings[field] = req.body[field];
      }
    }

    // Handle plain-text passcode sent in body — hash and store in preferences.general.passcodeHash
    if (req.body.passcode !== undefined) {
      if (req.body.passcode) {
        const salt = await bcrypt.genSalt(10);
        settings.preferences = settings.preferences || {};
        settings.preferences.general = settings.preferences.general || {};
        settings.preferences.general.passcodeHash = await bcrypt.hash(String(req.body.passcode), salt);
        settings.preferences.general.enablePasscode = true;
      }
    }

    // Handle preferences object (nested settings)
    if (req.body.preferences) {
      const prefs = typeof req.body.preferences === 'string'
        ? JSON.parse(req.body.preferences)
        : req.body.preferences;
      for (const [category, values] of Object.entries(prefs)) {
        if (values && typeof values === 'object') {
          for (const [key, value] of Object.entries(values)) {
            if (key === 'passcodeHash') continue;
            if (key === 'passcode' && value) {
              const salt = await bcrypt.genSalt(10);
              settings.preferences = settings.preferences || {};
              settings.preferences[category] = settings.preferences[category] || {};
              settings.preferences[category].passcodeHash = await bcrypt.hash(String(value), salt);
              settings.preferences[category].enablePasscode = true;
              continue;
            }
            setNestedValue(settings, `preferences.${category}.${key}`, value);
          }
        }
      }
    }

    if (req.file) {
      settings.logo = `/uploads/${req.file.filename}`;
    }

    const updated = await settings.save();

    // Auto-create or update Business profile
    const existingBiz = await Business.findOne({ owner: req.user._id, isActive: true });
    if (existingBiz && updated.businessName) {
      existingBiz.name = updated.businessName || existingBiz.name;
      if (updated.email !== undefined) existingBiz.email = updated.email;
      if (updated.phone !== undefined) existingBiz.phone = updated.phone;
      if (updated.address !== undefined) existingBiz.address = updated.address;
      if (updated.gstNumber !== undefined) existingBiz.gstNumber = updated.gstNumber;
      await existingBiz.save();
    } else if (!existingBiz && updated.businessName) {
      await Business.create({
        name: updated.businessName,
        email: updated.email,
        phone: updated.phone,
        address: updated.address,
        gstNumber: updated.gstNumber,
        owner: req.user._id,
        isActive: true,
      });
    }

    res.json(stripPasscodeHash(updated));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const verifyPasscode = async (req, res) => {
  try {
    const { passcode } = req.body;
    if (!passcode) return res.status(400).json({ valid: false, message: 'Passcode required' });
    const baseFilter = getBaseFilter(req);
    const settings = await Setting.findOne({ ...baseFilter });
    const hash = settings?.preferences?.general?.passcodeHash;
    if (!hash) return res.json({ valid: false, message: 'No passcode set' });
    const match = await bcrypt.compare(String(passcode), hash);
    res.json({ valid: match });
  } catch (error) {
    res.status(500).json({ valid: false, message: error.message });
  }
};

const clearPasscode = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const settings = await Setting.findOne({ ...baseFilter });
    if (!settings) return res.json({ ok: true });
    settings.preferences = settings.preferences || {};
    settings.preferences.general = settings.preferences.general || {};
    settings.preferences.general.passcodeHash = '';
    settings.preferences.general.enablePasscode = false;
    await settings.save();
    res.json(stripPasscodeHash(settings));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getTheme = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    let settings = await Setting.findOne({ ...baseFilter });
    if (!settings) {
      settings = await Setting.create({ ...getCreateData(req, {}) });
    }
    res.json({ darkMode: settings.preferences?.general?.darkMode === true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateTheme = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    let settings = await Setting.findOne({ ...baseFilter });
    if (!settings) {
      settings = await Setting.create({ ...getCreateData(req, {}) });
    }
    if (!settings.preferences) settings.preferences = {};
    if (!settings.preferences.general) settings.preferences.general = {};
    settings.preferences.general.darkMode = req.body.darkMode === true;
    await settings.save();
    res.json({ darkMode: settings.preferences.general.darkMode });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


module.exports = { getSettings, updateSettings, getTheme, updateTheme, verifyPasscode, clearPasscode };
