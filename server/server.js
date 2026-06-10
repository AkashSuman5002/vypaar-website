require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorMiddleware');
const { apiLimiter } = require('./middleware/rateLimit');
const { authMiddleware } = require('./middleware/auth');
const { csrfProtection } = require('./middleware/csrf');
const businessContext = require('./middleware/businessContext');
const auditMiddleware = require('./middleware/audit');
const multer = require('multer');
const path = require('path');
const cookieParser = require('cookie-parser');
const sqliteService = require('./services/sqliteService');
const { startRecurringService } = require('./services/recurringService');
const { startAutoBackup } = require('./services/backupService');
const { startPaymentReminder } = require('./services/paymentReminderService');
const { startServiceReminderCheck } = require('./services/serviceReminderScheduler');

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

// Migration: backfill business field on all existing data
setTimeout(async () => {
  try {
    const db = mongoose.connection.db;
    if (!db) { console.log('Migration skipped: no DB connection'); return; }
    const Business = require('./models/Business');
    const collections = ['sales', 'purchases', 'expenses', 'products', 'customers', 'suppliers', 'transactions', 'accounts', 'stockmovements', 'staff', 'godowns', 'partyrates', 'loyaltytransactions', 'parttransfers', 'receipts', 'settings'];
    const users = await db.collection('users').find({}).toArray();
    console.log(`Migration: found ${users.length} users`);
    for (const u of users) {
      const biz = await Business.findOne({ owner: u._id }).sort({ createdAt: -1 });
      if (!biz) { console.log(`Migration: no business for user ${u.name || u.email}`); continue; }
      console.log(`Migration: backfilling business "${biz.name}" (${biz._id}) for user ${u.name || u.email}`);
      let totalBackfilled = 0;
      for (const col of collections) {
        try {
          const result = await db.collection(col).updateMany(
            { user: u._id, $or: [{ business: { $exists: false } }, { business: null }] },
            { $set: { business: biz._id } }
          );
          if (result.modifiedCount > 0) {
            console.log(`  Backfilled ${result.modifiedCount} ${col} docs`);
            totalBackfilled += result.modifiedCount;
          }
        } catch (e) { /* collection may not exist */ }
      }
      console.log(`Migration: total ${totalBackfilled} docs backfilled for ${u.name || u.email}`);
    }
    console.log('Business backfill migration complete');
  } catch (err) {
    console.error('Business backfill error:', err.message);
  }
}, 8000);

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());
app.use('/api', apiLimiter);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
  limits: { fileSize: 2 * 1024 * 1024 },
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

app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/sales', require('./routes/saleRoutes'));
app.use('/api/purchases', require('./routes/purchaseRoutes'));
app.use('/api/suppliers', require('./routes/supplierRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/adv-reports', require('./routes/advReportRoutes'));
app.use('/api/ledger', require('./routes/ledgerRoutes'));
app.use('/api/accounting', require('./routes/accountingRoutes'));
app.use('/api/stock', require('./routes/stockRoutes'));
app.use('/api/receipts', require('./routes/receiptRoutes'));
app.use('/api/import', require('./routes/importRoutes'));
app.use('/api/imports/barcode', require('./routes/barcodeRoutes'));
app.use('/api/barcode-labels', require('./routes/barcodeLabelRoutes'));
app.use('/api/expenses', require('./routes/expenseRoutes'));
app.use('/api/purchase-orders', require('./routes/purchaseOrderRoutes'));
const purchaseReturnRoutes = require('./routes/purchaseReturnRoutes');
app.use('/api/purchase-returns', (req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT') {
    upload.any()(req, res, () => {
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

// Business setup with multer for logo upload
const businessRoutes = require('./routes/businessRoutes');
app.use('/api/business', (req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT') {
    upload.any()(req, res, () => {
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
    upload.single('logo')(req, res, () => {
      settingRoutes(req, res, next);
    });
  } else {
    settingRoutes(req, res, next);
  }
});

app.use(errorHandler);

// Auto-migrate: run once in background (non-blocking)
const migrateExistingUsers = async () => {
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
sqliteService.waitForInit().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    migrateExistingUsers();
  });
}).catch((err) => {
  console.error('Failed to initialize sql.js, some features may not work:', err.message);
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (sql.js unavailable)`);
    migrateExistingUsers();
  });
});
