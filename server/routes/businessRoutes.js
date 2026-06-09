const express = require('express');
const { getBusinessStatus, getAllBusinesses, createBusiness, updateBusiness, updateBusinessById, deleteBusiness, switchBusiness } = require('../controllers/businessController');
const Setting = require('../models/Setting');
const router = express.Router();

router.get('/status', getBusinessStatus);
router.get('/all', getAllBusinesses);
router.post('/', createBusiness);
router.post('/setup', async (req, res) => {
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
router.put('/profile', updateBusiness);
router.put('/:id', updateBusinessById);
router.delete('/:id', deleteBusiness);
router.post('/:businessId/switch', switchBusiness);

module.exports = router;
