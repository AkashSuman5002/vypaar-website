const express = require('express');
const { getBusinessStatus, getAllBusinesses, createBusiness, updateBusiness, updateBusinessById, deleteBusiness, switchBusiness } = require('../controllers/businessController');
const Setting = require('../models/Setting');
const { authorize } = require('../middleware/authorize');
const router = express.Router();

router.get('/status', authorize('settings:view'), getBusinessStatus);
router.get('/all', authorize('settings:view'), getAllBusinesses);
router.post('/', authorize('settings:manage'), createBusiness);
router.post('/setup', authorize('settings:manage'), async (req, res) => {
  try {
    const { name, email, phone, address, gstNumber, state, businessType, currency } = req.body;
    if (!name) return res.status(400).json({ message: 'Business name is required' });

    const Business = require('../models/Business');
    const business = await Business.create({
      name, email, phone, address, gstNumber, state, businessType,
      owner: req.user._id, isActive: true,
    });

    let setting = await Setting.findOne({ user: req.user._id });
    if (!setting) {
      setting = await Setting.create({ user: req.user._id, businessName: name, email, phone, address, gstNumber, state, currency: currency || '₹' });
    } else {
      setting.businessName = name;
      if (email) setting.email = email;
      if (phone) setting.phone = phone;
      if (address) setting.address = address;
      if (gstNumber) setting.gstNumber = gstNumber;
      if (state) setting.state = state;
      if (currency) setting.currency = currency;
      await setting.save();
    }

    res.json({ business, settings: setting });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.put('/profile', authorize('settings:manage'), updateBusiness);
router.put('/:id', authorize('settings:manage'), updateBusinessById);
router.delete('/:id', authorize('settings:manage'), deleteBusiness);
router.post('/:businessId/switch', authorize('settings:manage'), switchBusiness);

module.exports = router;
