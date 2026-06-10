const Business = require('../models/Business');

const businessContext = async (req, res, next) => {
  try {
    const businessId = req.headers['x-business-id'];
    if (businessId) {
      const owned = await Business.findOne({ _id: businessId, owner: req.user._id });
      if (!owned) {
        return res.status(403).json({ message: 'Invalid business context' });
      }
      req.businessId = businessId;
      return next();
    }
    let business = await Business.findOne({ owner: req.user._id, isActive: true }).sort({ updatedAt: -1, createdAt: -1 });
    if (!business) {
      business = await Business.findOne({ owner: req.user._id }).sort({ createdAt: -1 });
    }
    if (business) {
      req.businessId = business._id.toString();
    }
    next();
  } catch (err) {
    return res.status(500).json({ message: 'Failed to resolve business context' });
  }
};

module.exports = businessContext;
