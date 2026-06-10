const AuditLog = require('../models/AuditLog');
const { getBaseFilter } = require('../utils/queryHelper');

const getAuditLogs = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { page = 1, limit = 50, entity, action, search, dateFrom, dateTo } = req.query;
    const filter = { ...baseFilter };
    if (entity) filter.entity = entity;
    if (action) filter.action = action;
    if (search) {
      filter.$or = [
        { entityName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo + 'T23:59:59.999Z');
    }
    const total = await AuditLog.countDocuments(filter);
    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    res.json({ logs, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAuditStats = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const filter = { ...baseFilter };
    const [total, today, allLogs] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.countDocuments({ ...filter, createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
      AuditLog.find(filter).select('entity').lean(),
    ]);
    const entityMap = {};
    allLogs.forEach(l => { entityMap[l.entity] = (entityMap[l.entity] || 0) + 1; });
    const byEntity = Object.entries(entityMap).map(([entity, count]) => ({ _id: entity, count })).sort((a, b) => b.count - a.count);
    res.json({ total, today, byEntity });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getAuditLogs, getAuditStats };
