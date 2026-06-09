const Business = require('../models/Business');
const Branch = require('../models/Branch');
const Role = require('../models/Role');
const Setting = require('../models/Setting');

const getBusinessStatus = async (req, res) => {
  try {
    const business = await Business.findOne({ owner: req.user._id, isActive: true });
    res.json({ hasBusiness: !!business, business: business || null });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllBusinesses = async (req, res) => {
  try {
    const businesses = await Business.find({ owner: req.user._id }).sort({ createdAt: -1 });
    res.json(businesses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createBusiness = async (req, res) => {
  try {
    const { name, email, phone, address, gstNumber, state, panNumber, businessType, businessCategory, pincode } = req.body;
    if (!name) return res.status(400).json({ message: 'Business name is required' });

    const business = await Business.create({
      name,
      email: email || '',
      phone: phone || '',
      address: address || '',
      gstNumber: gstNumber || '',
      state: state || '',
      panNumber: panNumber || '',
      businessType: businessType || 'retail',
      businessCategory: businessCategory || '',
      pincode: pincode || '',
      owner: req.user._id,
      isActive: false,
    });

    await Branch.create({
      name: 'Main Branch',
      business: business._id,
      address,
      state,
      phone,
      email,
      gstNumber,
      isActive: true,
    });

    await Role.create({
      name: 'Admin',
      business: business._id,
      permissions: ['*'],
      isDefault: true,
    });

    res.status(201).json(business);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateBusiness = async (req, res) => {
  try {
    let business = await Business.findOne({ owner: req.user._id, isActive: true });
    if (!business) {
      business = await Business.create({
        name: req.body.businessName || req.body.name || 'My Business',
        owner: req.user._id,
        isActive: true,
      });
    }

    const fields = ['name', 'email', 'phone', 'address', 'gstNumber', 'state', 'panNumber', 'businessType', 'businessCategory', 'pincode', 'signature'];
    for (const field of fields) {
      if (req.body[field] !== undefined) business[field] = req.body[field];
    }
    if (req.body.businessName) business.name = req.body.businessName;
    if (Array.isArray(req.files)) {
      for (const file of req.files) {
        if (file.fieldname === 'logo') business.logo = `/uploads/${file.filename}`;
        if (file.fieldname === 'signature') business.signature = `/uploads/${file.filename}`;
      }
    } else if (req.file) {
      if (req.file.fieldname === 'logo') business.logo = `/uploads/${req.file.filename}`;
      if (req.file.fieldname === 'signature') business.signature = `/uploads/${req.file.filename}`;
    }
    await business.save();

    let setting = await Setting.findOne({ user: req.user._id });
    if (!setting) {
      setting = await Setting.create({ user: req.user._id, businessName: business.name });
    }
    setting.businessName = business.name;
    setting.phone = req.body.phone !== undefined ? req.body.phone : setting.phone;
    setting.email = req.body.email !== undefined ? req.body.email : setting.email;
    setting.address = req.body.address !== undefined ? req.body.address : setting.address;
    setting.gstNumber = req.body.gstNumber !== undefined ? req.body.gstNumber : setting.gstNumber;
    setting.state = req.body.state !== undefined ? req.body.state : setting.state;
    setting.businessType = req.body.businessType !== undefined ? req.body.businessType : setting.businessType;
    setting.businessCategory = req.body.businessCategory !== undefined ? req.body.businessCategory : setting.businessCategory;
    setting.pincode = req.body.pincode !== undefined ? req.body.pincode : setting.pincode;
    if (business.logo) setting.logo = business.logo;
    if (business.signature) setting.signature = business.signature;
    if (req.body.accountBooksBeginningDate) setting.accountBooksBeginningDate = req.body.accountBooksBeginningDate;
    await setting.save();

    res.json(business);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateBusinessById = async (req, res) => {
  try {
    const business = await Business.findOne({ _id: req.params.id, owner: req.user._id });
    if (!business) return res.status(404).json({ message: 'Business not found' });

    const fields = ['name', 'email', 'phone', 'address', 'gstNumber', 'state', 'panNumber', 'businessType', 'businessCategory', 'pincode'];
    for (const field of fields) {
      if (req.body[field] !== undefined) business[field] = req.body[field];
    }
    await business.save();
    res.json(business);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteBusiness = async (req, res) => {
  try {
    const business = await Business.findOne({ _id: req.params.id, owner: req.user._id });
    if (!business) return res.status(404).json({ message: 'Business not found' });
    if (business.isActive) return res.status(400).json({ message: 'Cannot delete active business. Switch to another first.' });

    await Business.findByIdAndDelete(req.params.id);
    res.json({ message: 'Business deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const switchBusiness = async (req, res) => {
  try {
    const { businessId } = req.params;
    const business = await Business.findOne({ _id: businessId, owner: req.user._id });
    if (!business) return res.status(404).json({ message: 'Business not found' });

    await Business.updateMany({ owner: req.user._id }, { isActive: false });
    business.isActive = true;
    await business.save();

    const setting = await Setting.findOne({ user: req.user._id });
    if (setting) {
      setting.businessName = business.name;
      setting.phone = business.phone || setting.phone;
      setting.email = business.email || setting.email;
      setting.address = business.address || setting.address;
      setting.gstNumber = business.gstNumber || setting.gstNumber;
      setting.state = business.state || setting.state;
      setting.businessType = business.businessType || setting.businessType;
      setting.businessCategory = business.businessCategory || setting.businessCategory;
      setting.pincode = business.pincode || setting.pincode;
      if (business.logo) setting.logo = business.logo;
      await setting.save();
    }

    res.json({ message: 'Switched to ' + business.name, business });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getBusinessStatus, getAllBusinesses, createBusiness, updateBusiness, updateBusinessById, deleteBusiness, switchBusiness };
