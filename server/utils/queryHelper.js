const getBaseFilter = (req) => {
  if (req.businessId) {
    return {
      $or: [
        { business: req.businessId },
        { user: req.user._id, business: { $exists: false } },
        { user: req.user._id, business: null },
      ],
    };
  }
  return { user: req.user._id };
};

const getCreateData = (req, extra = {}) => {
  const data = { user: req.user._id, ...extra };
  if (req.businessId) data.business = req.businessId;
  return data;
};

module.exports = { getBaseFilter, getCreateData };
