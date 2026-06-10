const getBaseFilter = (req) => {
  if (req.businessId) {
    return { business: req.businessId };
  }
  return { user: req.user._id };
};

const getSettingQuery = (req) => {
  return { user: req.user._id };
};

const getCreateData = (req, extra = {}) => {
  const data = { user: req.user._id, ...extra };
  if (req.businessId) data.business = req.businessId;
  return data;
};

module.exports = { getBaseFilter, getSettingQuery, getCreateData };
