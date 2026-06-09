const Business = require('../models/Business');

const businessContext = async (req, res, next) => {
  try {
    const businessId = req.headers['x-business-id'];
    if (businessId) {
      const Business = require('../models/Business');
      const owned = await Business.findOne({ _id: businessId, owner: req.user._id, isActive: true });
      if (!owned) {
        return res.status(403).json({ message: 'Invalid business context' });
      }
      req.businessId = businessId;
      return next();
    }
    const business = await Business.findOne({ owner: req.user._id, isActive: true });
    if (business) {
      req.businessId = business._id.toString();
    }
    next();
  } catch (err) {
    next();
  }
};

module.exports = businessContext;
