const AuditLog = require('../models/AuditLog');
const Setting = require('../models/Setting');

const ENTITY_MAP = {
  '/api/sales': 'Sale',
  '/api/purchases': 'Purchase',
  '/api/products': 'Product',
  '/api/customers': 'Customer',
  '/api/suppliers': 'Supplier',
  '/api/transactions': 'Transaction',
  '/api/expenses': 'Expense',
  '/api/receipts': 'Receipt',
  '/api/accounting': 'Account',
  '/api/godowns': 'Godown',
  '/api/party-rates': 'PartyRate',
  '/api/loyalty-points': 'LoyaltyPoint',
  '/api/settings': 'Setting',
};

const ACTION_MAP = { POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' };

const auditMiddleware = async (req, res, next) => {
  if (req.method === 'GET' || req.method === 'OPTIONS') return next();

  // Audit trail is always active — users cannot disable it
  const action = ACTION_MAP[req.method];
  if (!action) return next();

  let entity = null;
  for (const [path, name] of Object.entries(ENTITY_MAP)) {
    if (req.path.startsWith(path) || req.originalUrl.includes(path)) {
      entity = name;
      break;
    }
  }
  if (!entity) return next();

  const originalJson = res.json.bind(res);
  let capturedData = null;

  res.json = (data) => {
    capturedData = data;
    return originalJson(data);
  };

  res.on('finish', async () => {
    try {
      if (res.statusCode >= 400) return;
      const entityId = req.params.id || capturedData?._id || null;
      const entityName = capturedData?.name || capturedData?.businessName || capturedData?.invoiceNumber || capturedData?.billNumber || '';
      const description = `${action} ${entity}${entityName ? `: ${entityName}` : ''}`;

      let changes = {};
      if (action === 'create' && capturedData) {
        changes = { created: true };
      } else if (action === 'update') {
        const bodyKeys = Object.keys(req.body).filter(k => k !== 'passcode' && k !== 'passcodeHash');
        changes = { updatedFields: bodyKeys };
      } else if (action === 'delete') {
        changes = { deleted: true };
      }

      await AuditLog.create({
        user: req.user._id,
        action,
        entity,
        entityId: entityId || undefined,
        entityName,
        changes,
        ipAddress: req.ip || req.connection?.remoteAddress || '',
        description,
      });
    } catch (err) {
      console.error('Audit log error:', err.message);
    }
  });

  next();
};

module.exports = auditMiddleware;
