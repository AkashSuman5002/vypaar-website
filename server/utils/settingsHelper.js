const Setting = require('../models/Setting');
const { getBaseFilter } = require('./queryHelper');

const getSettings = async (req) => {
  const filter = getBaseFilter(req);
  const setting = await Setting.findOne(filter);
  const prefs = setting?.preferences || {};
  return {
    ...prefs,
    item: prefs.item || {},
    taxes: prefs.taxes || {},
    general: prefs.general || {},
    transaction: prefs.transaction || {},
    print: prefs.print || {},
  };
};

module.exports = { getSettings };
