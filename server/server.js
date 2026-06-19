require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorMiddleware');
const { apiLimiter } = require('./middleware/rateLimit');
const { authMiddleware, uploadsAuthMiddleware } = require('./middleware/auth');
const { csrfProtection } = require('./middleware/csrf');
const businessContext = require('./middleware/businessContext');
const auditMiddleware = require('./middleware/audit');
const sanitize = require('./middleware/sanitize');
const multer = require('multer');
const path = require('path');
const cookieParser = require('cookie-parser');
const sqliteService = require('./services/sqliteService');
const { startRecurringService } = require('./services/recurringService');
const { startAutoBackup } = require('./services/backupService');
const { startPaymentReminder } = require('./services/paymentReminderService');
const { startServiceReminderCheck } = require('./services/serviceReminderScheduler');
// Required once at startup so its VAPID keypair init (env or ephemeral) runs before any push send.
require('./services/pushNotificationService');

// Fail fast on missing critical config; warn loudly if not running in production mode
// (so production safety doesn't silently depend on remembering to set NODE_ENV).
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Refusing to start.');
  process.exit(1);
}
if (process.env.NODE_ENV !== 'production') {
  console.warn('WARNING: NODE_ENV is not "production". Cookies are not Secure and error details are verbose. Set NODE_ENV=production in your deploy environment.');
}
if (!process.env.CLIENT_URL) {
  console.warn('WARNING: CLIENT_URL is not set — CORS and customer-facing links will default to http://localhost:3000.');
}

// Log unhandled rejections (don't crash on a single swallowed promise), but on a true
// uncaught exception the process state is undefined — log and exit so a process manager
// (pm2/systemd/Docker) can restart it cleanly instead of running in a corrupt state.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception — exiting:', err);
  process.exit(1);
});

connectDB();

// One-time migration: drop old unique index on {user, code} (now {user, business, code})
const mongoose = require('mongoose');
setTimeout(async () => {
  try {
    const db = mongoose.connection.db;
    if (db) {
      const collections = await db.listCollections({ name: 'accounts' }).toArray();
      if (collections.length > 0) {
        const indexes = await db.collection('accounts').indexInformation();
        const hasOldIndex = indexes.user_1_code_1;
        if (hasOldIndex) {
          await db.collection('accounts').dropIndex('user_1_code_1');
          console.log('Dropped old unique index user_1_code_1');
        }
      }
    }
  } catch (err) {
    if (err.codeName !== 'IndexNotFound') console.error('Index migration error:', err.message);
  }
}, 5000);

const app = express();

// NOTE: In production, set CLIENT_URL env var to your deployed frontend URL (e.g. https://app.vyapar.com)
const CLIENT_ORIGIN = process.env.CLIENT_URL || 'http://localhost:3000';
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));

// Content-Security-Policy tuned for a Create-React-App SPA + Tailwind so it adds real
// protection WITHOUT ever white-screening the app (no wildcard `*`):
//  - scriptSrc allows 'unsafe-inline' + 'unsafe-eval' because CRA's runtime (and the dev
//    server) evaluate inline/eval'd code; removing these breaks the bundle.
//  - styleSrc allows 'unsafe-inline' because Tailwind / styled components inject inline styles.
//  - imgSrc allows data:/blob: for inline logos, generated QR codes and object-URL previews.
//  - connectSrc allows 'self', the client origin and ws:/wss: for CRA HMR + SSE/EventSource.
//  - fontSrc allows data: for embedded fonts.
// crossOriginResourcePolicy stays disabled (false) so cross-origin <img src="/uploads/.."> works.
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", CLIENT_ORIGIN, 'ws:', 'wss:'],
      fontSrc: ["'self'", 'data:'],
    },
  },
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());

// Strip NoSQL operator-injection keys ($..., dotted paths) from all request payloads.
// Mounted EARLY (after body parsers, before any route/auth) so every downstream
// handler and Mongoose query sees only sanitized req.body/req.query/req.params.
app.use(sanitize);

app.use('/api', apiLimiter);

// Uploaded files (logos, signatures) use guessable Date.now() filenames, so the
// static route must NOT be public. Require a valid auth token before serving any
// file, and set safe response headers so browsers don't sniff/render content.
app.use(
  '/uploads',
  uploadsAuthMiddleware,
  (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    next();
  },
  express.static(path.join(__dirname, 'uploads'))
);

// Request timeout
app.use((req, res, next) => {
  req.setTimeout(30000);
  res.setTimeout(30000);
  next();
});

// Multer setup for logo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype);
    if (extOk && mimeOk) cb(null, true);
    else cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed'));
  },
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));

// Auth middleware for protected routes
app.use('/api', authMiddleware);
app.use('/api', csrfProtection);
app.use('/api', businessContext);
app.use('/api', auditMiddleware);

app.use('/api/2fa', require('./routes/twoFactorRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/sales', require('./routes/saleRoutes'));
app.use('/api/purchases', require('./routes/purchaseRoutes'));
app.use('/api/suppliers', require('./routes/supplierRoutes'));
app.use('/api/party-groups', require('./routes/partyGroupRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
// '/api/reports' removed: dead duplicate of '/api/accounting/reports/*' (sales|purchases|profit).
// The controllers (getSalesReport/getPurchaseReport/getProfitReport) remain mounted via accountingRoutes.
app.use('/api/adv-reports', require('./routes/advReportRoutes'));
app.use('/api/ledger', require('./routes/ledgerRoutes'));
app.use('/api/accounting', require('./routes/accountingRoutes'));
app.use('/api/stock', require('./routes/stockRoutes'));
app.use('/api/receipts', require('./routes/receiptRoutes'));
app.use('/api/import', require('./routes/importRoutes'));
app.use('/api/imports/barcode', require('./routes/barcodeRoutes'));
app.use('/api/barcode-labels', require('./routes/barcodeLabelRoutes'));
app.use('/api/expenses', require('./routes/expenseRoutes'));
app.use('/api/budgets', require('./routes/budgetRoutes'));
app.use('/api/purchase-orders', require('./routes/purchaseOrderRoutes'));
const purchaseReturnRoutes = require('./routes/purchaseReturnRoutes');
app.use('/api/purchase-returns', (req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT') {
    upload.any()(req, res, (err) => {
      if (err) return next(err);
      purchaseReturnRoutes(req, res, next);
    });
  } else {
    purchaseReturnRoutes(req, res, next);
  }
});
app.use('/api/payment-out', require('./routes/paymentOutRoutes'));
app.use('/api/party-transfers', require('./routes/partyTransferRoutes'));
app.use('/api/export', require('./routes/exportRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/ledger-notes', require('./routes/ledgerNoteRoutes'));
app.use('/api/branches', require('./routes/branchRoutes'));
app.use('/api/godowns', require('./routes/godownRoutes'));
app.use('/api/audit', require('./routes/auditRoutes'));
app.use('/api/party-rates', require('./routes/partyRateRoutes'));
app.use('/api/loyalty-points', require('./routes/loyaltyRoutes'));
app.use('/api/backup', require('./routes/backupRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/utilities', require('./routes/utilityRoutes'));
app.use('/api/support', require('./routes/supportRoutes'));
app.use('/api/whatsapp', require('./routes/whatsappRoutes'));
app.use('/api/staff', require('./routes/staffRoutes'));
app.use('/api/service-reminders', require('./routes/serviceReminderRoutes'));
app.use('/api/manufacturing', require('./routes/manufacturingRoutes'));
app.use('/api/godown-transfers', require('./routes/godownTransferRoutes'));
app.use('/api/stock-reconciliations', require('./routes/stockReconciliationRoutes'));
app.use('/api/gst-filing', require('./routes/gstFilingRoutes'));
app.use('/api/currencies', require('./routes/currencyRoutes'));

// Business setup with multer for logo upload
const businessRoutes = require('./routes/businessRoutes');
app.use('/api/business', (req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT') {
    upload.any()(req, res, (err) => {
      if (err) return next(err);
      businessRoutes(req, res, next);
    });
  } else {
    businessRoutes(req, res, next);
  }
});

// Settings with multer for logo upload
const settingRoutes = require('./routes/settingRoutes');
app.use('/api/settings', (req, res, next) => {
  if (req.method === 'PUT') {
    upload.single('logo')(req, res, (err) => {
      if (err) return next(err);
      settingRoutes(req, res, next);
    });
  } else {
    settingRoutes(req, res, next);
  }
});

app.use(errorHandler);

// Auto-migrate: runs once, deferred to not block login
const migrateExistingUsers = async () => {
  const fs = require('fs');
  const path = require('path');
  const flagFile = path.join(__dirname, '.migration-done');
  if (fs.existsSync(flagFile)) return;
  try {
    const fs = require('fs');
    const path = require('path');
    const flagFile = path.join(__dirname, '.migration-done');
    if (fs.existsSync(flagFile)) return;

    const User = require('./models/User');
    const Business = require('./models/Business');
    const Setting = require('./models/Setting');
    const Branch = require('./models/Branch');
    const Role = require('./models/Role');
    const Sale = require('./models/Sale');
    const Purchase = require('./models/Purchase');
    const Product = require('./models/Product');
    const Customer = require('./models/Customer');
    const Supplier = require('./models/Supplier');
    const Transaction = require('./models/Transaction');
    const Expense = require('./models/Expense');
    const PurchaseOrder = require('./models/PurchaseOrder');
    const PurchaseReturn = require('./models/PurchaseReturn');
    const Receipt = require('./models/Receipt');
    const JournalEntry = require('./models/JournalEntry');
    const StockMovement = require('./models/StockMovement');
    const LoyaltyPoint = require('./models/LoyaltyPoint');
    const LedgerNote = require('./models/LedgerNote');
    const PartyRate = require('./models/PartyRate');
    const Account = require('./models/Account');

    const models = [Sale, Purchase, Product, Customer, Supplier, Transaction, Expense, PurchaseOrder, PurchaseReturn, Receipt, JournalEntry, StockMovement, LoyaltyPoint, LedgerNote, PartyRate, Account];

    const users = await User.find({});
    for (const user of users) {
      let business = await Business.findOne({ owner: user._id }).sort({ createdAt: -1 });
      if (!business) {
        business = await Business.create({ name: user.name + "'s Business", email: user.email, owner: user._id, isActive: true });
        await Branch.create({ name: 'Main Branch', business: business._id, isActive: true });
        await Role.create({ name: 'Admin', business: business._id, permissions: ['*'], isDefault: true });
      }
      let setting = await Setting.findOne({ user: user._id });
      if (!setting) {
        await Setting.create({ user: user._id, businessName: business.name, email: user.email });
      } else if (!setting.businessName) {
        setting.businessName = business.name;
        await setting.save();
      }
      await Promise.all(models.map(Model => Model.updateMany(
        { user: user._id, $or: [{ business: { $exists: false } }, { business: null }] },
        { $set: { business: business._id } }
      )));
    }
    fs.writeFileSync(flagFile, new Date().toISOString());
    console.log('Migration complete');
  } catch (err) {
    console.error('Migration error:', err.message);
  }
};

// Start recurring invoice service
startRecurringService();
startAutoBackup();
startPaymentReminder();
startServiceReminderCheck();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Initialize sqlite in background (non-blocking)
  sqliteService.waitForInit().catch(() => {});
  // Defer migration by 30s so login requests aren't blocked
  setTimeout(() => migrateExistingUsers(), 30000);
});
