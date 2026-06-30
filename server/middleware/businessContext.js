const Business = require('../models/Business');

const businessContext = async (req, res, next) => {
  try {
    // A non-owner user (staff/manager/accountant created via User Management) is a MEMBER
    // of the owner's business — their User.business points to it. They don't own a Business.
    const memberBusinessId = req.user.business ? req.user.business.toString() : null;
    // An OWNER (admin) must only ever resolve a business they ACTUALLY OWN. A `user.business`
    // that points at someone else's business is a corrupted / cross-account pointer and must
    // NOT be trusted — trusting it leaks another account's data. Only genuine sub-users
    // (non-admin roles) legitimately operate inside the owner's business via user.business.
    const role = req.user.role || '';
    const isSubUser = !!role && !['admin', 'Admin', 'owner', 'Owner'].includes(role);

    const headerBusinessId = req.headers['x-business-id'];
    if (headerBusinessId) {
      // Honour the header ONLY if the user owns it, or is a sub-user assigned to it.
      const owned = await Business.findOne({ _id: headerBusinessId, owner: req.user._id }).select('_id').lean();
      const isAssignedMember = isSubUser && memberBusinessId && memberBusinessId === headerBusinessId.toString();
      if (owned || isAssignedMember) {
        req.businessId = headerBusinessId;
        return next();
      }
      // A stale / cross-account header is NOT trusted — but we do NOT 403 (that would make every
      // page "fail to load"). Instead we silently IGNORE it and fall through to resolve the
      // account's OWN business below. Secure (never serves another account's data) AND usable.
    }

    // A sub-user uses their assigned business; an owner uses a business they OWN.
    if (isSubUser && memberBusinessId) {
      req.businessId = memberBusinessId;
      return next();
    }

    let business = await Business.findOne({ owner: req.user._id, isActive: true }).sort({ updatedAt: -1, createdAt: -1 });
    if (!business) {
      business = await Business.findOne({ owner: req.user._id }).sort({ createdAt: -1 });
    }
    if (business) {
      req.businessId = business._id.toString();
    } else if (memberBusinessId) {
      // Not an owner of any business but has an assignment — fall back to it.
      req.businessId = memberBusinessId;
    }
    next();
  } catch (err) {
    return res.status(500).json({ message: 'Failed to resolve business context' });
  }
};

module.exports = businessContext;
