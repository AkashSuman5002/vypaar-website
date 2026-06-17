const Business = require('../models/Business');

const businessContext = async (req, res, next) => {
  try {
    // A non-owner user (staff/manager/accountant created via User Management) is a MEMBER
    // of the owner's business — their User.business points to it. They don't own a Business.
    const memberBusinessId = req.user.business ? req.user.business.toString() : null;

    const headerBusinessId = req.headers['x-business-id'];
    if (headerBusinessId) {
      // Allow the requested business if the user OWNS it or is a MEMBER assigned to it.
      const owned = await Business.findOne({ _id: headerBusinessId, owner: req.user._id });
      const isMember = memberBusinessId && memberBusinessId === headerBusinessId.toString();
      if (!owned && !isMember) {
        return res.status(403).json({ message: 'Invalid business context' });
      }
      req.businessId = headerBusinessId;
      return next();
    }

    // No header: resolve the user's default business.
    // Members use their assigned business directly; owners fall back to the one they own.
    if (memberBusinessId) {
      req.businessId = memberBusinessId;
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
