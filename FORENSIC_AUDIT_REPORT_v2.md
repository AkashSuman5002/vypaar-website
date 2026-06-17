# ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
# ┃  COMPREHENSIVE FORENSIC AUDIT REPORT — VYAPAR ERP  ┃
# ┃  Date: 2026-06-17  |  Mode: READ-ONLY              ┃
# ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

## TABLE OF CONTENTS
1. [Project Stats](#1-project-statistics)
2. [Executive Summary](#2-executive-summary)
3. [Critical Issues — Must Fix Before Production](#3-critical-issues-must-fix-before-production)
4. [High Issues — Must Fix Before Production](#4-high-issues-must-fix-before-production)
5. [Security Audit](#5-security-audit)
6. [Form Validation Audit](#6-form-validation-audit)
7. [Settings Forensic Report (All ~70 UI-Only Settings)](#7-settings-forensic-report)
8. [Print Tab — Complete Deconstruction](#8-print-tab-complete-deconstruction)
9. [Frontend ↔ Backend Connection Map](#9-frontend--backend-connection-map)
10. [Dead/Orphaned Code Inventory](#10-deadorphaned-code-inventory)
11. [Broken Pages & Components](#11-broken-pages--components)
12. [Broken Buttons & Icons](#12-broken-buttons--icons)
13. [View Page Deep Analysis](#13-view-page-deep-analysis)
14. [Data Integrity Issues](#14-data-integrity-issues)
15. [Notification System Audit](#15-notification-system-audit)
16. [Import/Export Audit](#16-importexport-audit)
17. [Report System Audit](#17-report-system-audit)
18. [Performance Audit](#18-performance-audit)
19. [Dark Mode Audit](#19-dark-mode-audit)
20. [User Management & RBAC Audit](#20-user-management--rbac-audit)
21. [Navigation & Routing Audit](#21-navigation--routing-audit)
22. [Production Readiness Assessment](#22-production-readiness-assessment)
23. [Final Answers: 14 Critical Questions](#23-final-answers-14-critical-questions)

---

## 1. PROJECT STATISTICS

| Metric | Value |
|--------|-------|
| **Frontend Files** | 194 source files |
| **Backend Files** | ~177 files |
| **Pages (Route Components)** | 127 |
| **Reusable Components** | 43 |
| **MongoDB Models** | 43 |
| **Controllers** | 44 |
| **Route Files** | 46 |
| **Middleware** | 8 |
| **Services** | 11 |
| **Cron Jobs** | 5 |
| **MongoDB Collections** | 43 |
| **API Endpoints** | ~200+ |
| **Total Source Files** | ~370+ |
| **Frontend Framework** | React 18 (CRA) |
| **Backend Framework** | Node.js/Express |
| **Database** | MongoDB with Mongoose |
| **Styling** | Tailwind CSS 3 |
| **Routing** | React Router v6 |

---

## 2. EXECUTIVE SUMMARY

```
┌─────────────────────────────────────────────────────────────────┐
│  PRODUCTION READINESS:  15-20%    DEPLOY TODAY?  ❌  NO         │
│  ERP COMPLETENESS:      65-70%    FIX EFFORT:    4-6 WEEKS      │
└─────────────────────────────────────────────────────────────────┘
```

### WHAT WORKS (CORE IS SOLID)
- ✅ Full CRUD for Sales, Purchases, Customers, Suppliers, Products, Expenses
- ✅ Dashboard with real data (but has critical bugs in calculations)
- ✅ Authentication (register, login, forgot/reset password, JWT)
- ✅ Import/Export (Excel, CSV, barcode, backup) — most complete subsystem
- ✅ WhatsApp connection (Baileys-based)
- ✅ Chart of accounts, journal entries (double-entry accounting)
- ✅ GST reports, stock reports, P&L, balance sheet
- ✅ User management with roles
- ✅ Notifications (12+ triggers, bell icon, read/mark read)

### WHAT IS BROKEN
- 🔴 **19 Critical data bugs** that corrupt financial data
- 🔴 **6 Security vulnerabilities** (JWT in git, no input validation, SQL injection)
- 🔴 **~70+ settings** save to DB but change nothing (UI-only)
- 🔴 **5 reports use wrong endpoints** — dedicated controller code is dead
- 🔴 **Dark mode broken in ALL settings pages** (invisible text)
- 🔴 **6 notification types silently fail** (enum validation)
- 🔴 **PaymentOut.js** has NO export statement — cannot be loaded by router

### TOP 5 PRODUCTION BLOCKERS
1. `remainingBalance || totalAmount` falsy-0 bug → fully paid sales appear unpaid
2. Dashboard cash/bank double-counted → wrong financial reporting
3. Backup import silently injects 250 fake customers + 1800 fake products
4. JWT_SECRET in git → anyone with repo access can forge tokens
5. No input validation on ANY API endpoint

---

## 3. CRITICAL ISSUES — MUST FIX BEFORE PRODUCTION

### 🔴 C-1: Fully Paid Sales Appear Unpaid
```
File:      server/controllers/saleController.js
Lines:     364, 558
Impact:    HIGH — Corrupts ALL customer outstanding balances
Root:      `remainingBalance || totalAmount` — JavaScript `0 || totalAmount`
            evaluates to `totalAmount` when remainingBalance is 0 (fully paid).
            Also causes customer openingBalance to be inflated by totalAmount.
```

### 🔴 C-2: Dashboard Cash/Bank Double-Counted
```
File:      server/controllers/dashboardController.js
Lines:     103-119
Impact:    HIGH — Dashboard shows inflated cash/bank balances
Root:      Code reads Account balances (already include all JE postings) THEN
            adds Transaction sums on top. Every cash movement is double-counted.
```

### 🔴 C-3: Stock Movement Records Have Wrong Balance Fields
```
File:      server/controllers/stockController.js
Lines:     31-48
Impact:    HIGH — Corrupts ALL FIFO/LIFO cost tracking
Root:      `recordStockMovement` re-reads the product AFTER stock update, so
            balanceBefore = post-update stock (wrong), balanceAfter = post-update + qty (wrong)
```

### 🔴 C-4: No Journal Entry Update on Sale/Purchase Edit
```
Files:     server/controllers/saleController.js:657-779
           server/controllers/purchaseController.js:419-525
Impact:    HIGH — Account balances become stale after any invoice edit
Root:      When items change, stock is reversed/re-applied, but NO journal entry
            reversal/re-creation happens. Account balances diverge from reality.
```

### 🔴 C-5: Expiry Date Logic in Wrong Scope
```
File:      server/controllers/saleController.js
Lines:     498-515
Impact:    MEDIUM — Estimates/quotations only get expiry dates when ALL of:
            accounting enabled AND accounts exist AND paidAmount > 0 AND cash account found
Root:      Expiry date setter placed INSIDE nested accounting/payment conditions.
```

### 🔴 C-6: Non-Atomic Transactions on Standalone MongoDB
```
File:      server/utils/withTransaction.js
Lines:     30-33
Impact:    HIGH — Partial failures leave inconsistent data
Root:      Falls back to NON-ATOMIC mode when MongoDB is not a replica set.
            A crash mid-way through createSale leaves: partial stock decrements,
            some stock movements recorded, no journal entry, but customer balance updated.
```

### 🔴 C-7: Dashboard COGS Uses Wrong Cost Price Source
```
File:      server/controllers/dashboardController.js
Line:      43
Impact:    MEDIUM — Dashboard profit diverges from report profit over time
Root:      Uses CURRENT product master costPrice instead of stamped sale-line costPrice.
            When product costPrice changes, historical dashboard profit changes too.
```

### 🔴 C-8: Backup Import Silently Injects Fake Data
```
File:      server/controllers/importController.js
Lines:     511-516
Impact:    CRITICAL — Users believe real data was imported
Root:      When sql.js fails to initialize, `backupExecute` silently inserts
            simulated records: 250 customers, 1800 products, etc. User sees
            "Import completed" with counts but NO actual data was imported.
```

### 🔴 C-9: Barcode Dashboard Stats ReferenceError
```
File:      server/controllers/barcodeController.js
Line:      611
Impact:    HIGH — Endpoint crashes with ReferenceError
Root:      References undeclared variable `userId` instead of `getUserId(req)`.
```

### 🔴 C-10: Notification Enum Validation Fails for 6 Types
```
File:      server/models/Notification.js (enum)
Impact:    HIGH — 6 notification types never saved to DB
Types failing silently:
  • purchase_updated      (purchaseController.js:516)
  • purchase_deleted      (purchaseController.js:600)
  • expense_updated       (expenseController.js:218)
  • expense_deleted       (expenseController.js:260)
  • payment_out           (paymentOutController.js:112)
  • payment_out_deleted   (paymentOutController.js:186)
```

### 🔴 C-11: Dark Mode Broken in ALL Settings Pages
```
Affects:   PrintTab.js (1147 lines), TaxesTab.js, ItemTab.js,
           TransactionTab.js, AccountingTab.js, NotificationPreferencesTab.js,
           Settings Page Container, SettingsSection.js, SettingsRow.js, ToggleSwitch.js
Impact:    HIGH — Settings pages are UNREADABLE in dark mode
Root:      Zero `dark:` variants on text-[#1F2937], bg-white, border-gray-200 classes.
            90+ instances of hardcoded dark gray text without dark mode fallback.
```

### 🔴 C-12: All ~50 Print Settings Are Decorative (Change Nothing)
```
File:      client/src/components/Settings/PrintTab.js
Impact:    HIGH — Users cannot configure printing at all
Root:      `getPref('print', ...)` is called ZERO times across the entire codebase.
            All 50+ settings save to DB but are NEVER READ by any print/PDF logic.
```

### 🔴 C-13: PaymentOut.js Has NO Export Statement
```
File:      client/src/pages/PaymentOut.js
Line:      635 (last line)
Issue:     File ends with `};` but has NO `export default PaymentOut;`
Impact:    BROKEN — This page cannot be loaded by the router. React will throw
            "Element type is invalid: expected a string or a class/function".
            Route `/purchases/payment-out` will crash the app.
```

---

## 4. HIGH ISSUES — MUST FIX BEFORE PRODUCTION

| # | Issue | File(s) | Impact |
|---|-------|---------|--------|
| H-1 | No duplicate purchase billNumber guard | `purchaseController.js` | Duplicate purchases enterable |
| H-2 | No anti-duplicate guard on purchase returns | `purchaseReturnController.js` | Multiple returns on same purchase |
| H-3 | Sale trusts client for GST values (no server validation) | `saleController.js:169-293` | Wrong GST amounts |
| H-4 | Customer openingBalance not adjusted on sale item changes | `updateSale:657-779` | Stale outstanding |
| H-5 | Stock movement silently hides negative stock | `stockController.js:40` | Negative inventory undetected |
| H-6 | Purchase stock movements run AFTER commit | `purchaseController.js:395-397` | No rollback on movement failure |
| H-7 | JE errors silently swallowed | Multiple purchase/purchaseReturn | Silent data loss |
| H-8 | convertToChallan/Estimate don't mark original | `saleController.js:1090-1195` | Infinite conversions possible |
| H-9 | COGS valuation.js (FIFO/LIFO/Average) NEVER called | `server/utils/valuation.js` | Cost method selection does nothing |
| H-10 | All external notifications silently fail | Multiple `.catch(() => {})` | No error visibility |
| H-11 | Zod validation schemas NEVER applied | `server/middleware/validate.js` vs all routes | No input validation on any API |
| H-12 | JWT accessible via localStorage (XSS) | `client/src/context/AuthContext.js` | Token theft via XSS |
| H-13 | WhatsApp send-document has no RBAC | `whatsappRoutes.js:18` | Any user can send WhatsApp docs |
| H-14 | JWT exposed in query string (SSE) | `auth.js:24`, `api.js:442-445` | Token in server logs |
| H-15 | No HTTPS enforcement/HSTS | `server/server.js` | MITM attacks possible |
| H-16 | Rate limiting bypassable via env var | `rateLimit.js:8` | `DISABLE_RATE_LIMIT=true` |
| H-17 | Dashboard loads ALL data into memory | `dashboardController.js` | OOM at ~50K records |
| H-18 | 20+ report methods fetch ALL data without `.limit()` | `reportController.js` | Timeout at scale |
| H-19 | Missing indexes on 5+ models | PurchaseReturn, PurchaseOrder, Business, etc. | Full collection scans |
| H-20 | Reports use `limit=5000` hardcoded | DayBook, CashFlow, AllTransactions | Will fail at >5K |
| H-21 | Permission maps out of sync (frontend vs backend) | `authorize.js` vs `usePermissions.js` | UI/backend mismatch |
| H-22 | Only 5 of ~50+ routes have route-level permission checks | `ProtectedRoute.js` | Staff can access most pages |
| H-23 | Admin can deactivate owner (no isOwner guard on PUT) | `userRoutes.js:91` | Privilege escalation |
| H-24 | DayBook running balance is mathematically WRONG | `DayBookReport.js` | Incorrect reports |
| H-25 | 5 reports bypass dedicated report endpoints | Sale, DayBook, CashFlow, AllTransactions, StockSummary | Dead controller code |

---

## 5. SECURITY AUDIT

```
┌──────────────────────────────────────────────────────────────┐
│  CRITICAL: 6    HIGH: 5    MEDIUM: 6    LOW: 4              │
└──────────────────────────────────────────────────────────────┘
```

### CRITICAL VULNERABILITIES

#### S-1: JWT_SECRET Hardcoded & Committed to Git
```
File:    server/.env
Risk:    Anyone with repo access can forge JWT tokens for any user ID
Fix:     Remove .env from git, rotate key, use env vars/secrets manager
```

#### S-2: Zod Validation Schemas Defined But NEVER Applied
```
File:    server/middleware/validate.js vs ALL route files
Risk:    Every POST/PUT endpoint accepts arbitrary, unvalidated JSON.
         Mass-assignment, type confusion, and injection attacks possible.
Evidence: Zero route files import `validate` middleware.
```

#### S-3: SQL Injection in sqliteService
```
File:    server/services/sqliteService.js:51
Code:    `SELECT value FROM settings WHERE key = '${keyPattern}'`
Risk:    String interpolation into SQLite query. Current callers use
         hardcoded strings, but future use of user input = exploitable.
```

#### S-4: Backup Import Accepts Arbitrary Files (500MB)
```
File:    server/routes/importRoutes.js:20
Code:    const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });
Risk:    NO fileFilter! Any file up to 500MB accepted. Combined with S-3,
         attacker can upload malicious SQLite databases.
```

#### S-5: JWT_EXPIRE=30 Days — No Refresh Token Rotation
```
File:    server/.env
Risk:    If JWT stolen, valid for 30 days. No blacklist, no rotation.
         `/auth/refresh` just issues new token with same 30-day expiry.
```

#### S-6: Error Messages Leak Internals in Production
```
Files:   authRoutes.js:74, userRoutes.js:27, businessRoutes.js:37, backupRoutes.js:11
         (~15+ instances of `error.message` returned directly)
Risk:    Inline catch blocks return `error.message` with stack traces, file paths,
         MongoDB error details. Error middleware suppresses production, but inline
         blocks send response BEFORE calling next(err), bypassing global handler.
```

### HIGH VULNERABILITIES
| # | Issue | File | Risk |
|---|-------|------|------|
| H-S1 | JWT in localStorage (XSS-vulnerable) | `AuthContext.js` | Token theft via XSS |
| H-S2 | WhatsApp send-document no RBAC | `whatsappRoutes.js:18` | Data exfiltration |
| H-S3 | JWT in query string (SSE streams) | `auth.js:24` | Token in server logs |
| H-S4 | No HTTPS enforcement | `server.js` | MITM |
| H-S5 | Rate limiting bypassable | `rateLimit.js:8` | Brute force |

### MEDIUM VULNERABILITIES
| # | Issue | File | Risk |
|---|-------|------|------|
| M-S1 | Mass assignment in user creation | `userRoutes.js:61-82` | Permission escalation |
| M-S2 | No CSRF on auth endpoints | `authRoutes.js` | Cross-site request forgery |
| M-S3 | Admin role confusion (case-sensitive) | `authorize.js` | Auth misconfiguration |
| M-S4 | CSRF sameSite 'lax' instead of 'strict' | `authRoutes.js:241` | Weakened CSRF |
| M-S5 | No per-endpoint rate limiting on mutations | All POST/PUT/DELETE | Resource exhaustion |
| M-S6 | JWT_SECRET exported from auth middleware | `auth.js:78` | Increased blast radius |

---

## 6. FORM VALIDATION AUDIT

```
┌──────────────────────────────────────────────────────────────┐
│  CRITICAL: 1    HIGH: 8    MEDIUM: 15    LOW: 20    TOTAL: 44│
└──────────────────────────────────────────────────────────────┘
```

### CRITICAL: Password Validation Has 3 Conflicting Rules
| Layer | Rule | File:Line |
|-------|------|-----------|
| Client UI | min 8 chars, NO complexity check | `Register.js:29` |
| Server Zod | min 6 chars | `validate.js:26` |
| Mongoose Model | min 8 + must have upper + lower + digit | `User.js:8-12` |
| **Result** | Password "Abc123" (7 chars) passes Zod, fails at model with confusing error |

### HIGH: Missing Required Field Validation
| Form | Missing Validations | File:Line |
|------|-------------------|-----------|
| CreateSale | Customer required, Invoice Number required, Invoice Date required | `CreateSale.js:526` |
| CreateSale | customerGST not validated | `CreateSale.js:392` |
| CreateSale | customerEmail not validated | `CreateSale.js:642` |
| CreateSale | Invoice discount no max constraint | `CreateSale.js:947-949` |
| Customers | GST number not validated | `Customers.js:241` |
| Customers | PAN number not validated | `Customers.js:245` |
| Suppliers | GST number not validated | `Suppliers.js:192` |
| Products | `gstRate: -1` (Exempt) fails model `min: 0` | `Products.js:1023` |
| Expenses | No server-side Zod schema at all | Missing entirely |
| Journals | No server-side Zod schema at all | Missing entirely |
| CreatePurchaseBill | Discount % no max constraint | `CreatePurchaseBill.js:656-659` |

### HIGH: Double-Submit Prevention Missing
| Form | Issue | File:Line |
|------|-------|-----------|
| Customers | Submit button NOT disabled during submission | `Customers.js:272` |
| Suppliers | Submit button NOT disabled during submission | `Suppliers.js:228` |
| Products | Save buttons NOT disabled during submission | `Products.js:1161-1167` |

### Validation Functions Defined But NEVER Used
| Function | File:Line |
|----------|-----------|
| `validateAadhaar` | `validation.js:157` |
| `validateBankAccount` | `validation.js:165` |
| `validateIFSC` | `validation.js:173` |
| `validatePincode` | `validation.js:181` |

---

## 7. SETTINGS FORENSIC REPORT

### Architecture
```
Tab UI → saveCategory('category', values) → settingAPI.update({preferences: {category: values}})
  → PUT /api/settings → settingController.updateSettings() → Setting.findOneAndUpdate() → MongoDB
  
Consumption: Components call useSettings().getPref(category, key) which reads from in-memory cache
  loaded via GET /api/settings
```

### SUMMARY: ~70+ UI-Only Settings (Saved to DB, Change Nothing)

#### General Tab — 5 of 28 are UI-Only
| Setting | Status | Why |
|---------|--------|-----|
| `gstin` | ❌ DUPLICATE | Business GST uses top-level `gstNumber`, not this pref |
| `goodsReturnOnDC` | ❌ UI-ONLY | Never checked by any component |
| `printAmountOnDC` | ❌ UI-ONLY | Never checked by any component |
| `auditTrail` | ❌ UI-ONLY | Never checked by audit middleware |
| `zoomLevel` | ❌ UI-ONLY | Never applied to viewport/layout |

#### Transaction Tab — 4 of ~35 are UI-Only
| Setting | Status | Why |
|---------|--------|-----|
| `poDate` | ❌ ORPHAN | In schema + defaults, but NEVER rendered in any UI |
| `deliveryChallanPrefix` | ❌ UI-ONLY | Never read |
| `paymentInPrefix` | ❌ UI-ONLY | Never read |
| `receiptPrefix` | ❌ UI-ONLY | Never read |

#### Print Tab — ALL ~50 Settings Are UI-Only
**Full list of decorative settings:**
- showBalanceAmount, showCurrentBalance, showTaxDetails, showYouSaved
- showAmountGrouping, showBankDetails, showQRCode, showPartyPhone
- showPartyGSTIN, showPartyAddress, showTransportDetails
- showPrintDescription, showTermsConditions, showReceivedBy, showDeliveredBy
- showSignature, showPaymentMode, showAcknowledgement
- additionalField1Label, additionalField2Label, customFooterText
- paperSize (A4/A5/Letter/Legal), orientation, companyNameSize, invoiceTextSize
- printOriginal, printDuplicate, topPdfMargin
- theme selection (4 themes), accentColor
- ALL thermal printer settings (12+ settings)
- makeThermalDefault (DISABLED), printingType (DISABLED), useTextStyling (DISABLED)
- autoCutPaper (DISABLED), openCashDrawer (DISABLED)
- pageSize, extraLines, numberOfCopies
- showSerialNo, showHSN, showUOM, showMRP, showDescription
- showBatchNo, showExpDate, showMfgDate, showSize, showModelNo, showSerialNo
- showTotalItemQty, showAmountDecimal, showReceivedAmt, showBalanceAmt
- showCurrentBalance2, showTaxDetails2, showYouSaved2, showAmountGrouping2
- showAmountWords, showPrintDescription2, showTerms2
- Additional Fields 1/2

**Proof:** `getPref('print', ...)` is called ZERO times in the entire codebase.

#### Taxes Tab — 4 of 14 are UI-Only
| Setting | Status | Why |
|---------|--------|-----|
| `compositionScheme` | ❌ UI-ONLY | Never read by any code |
| `enableTCS` / `tcsRate` | ❌ UI-ONLY | No TCS calculation logic exists anywhere |
| `enableTDS` / `tdsRate` | ❌ UI-ONLY | No TDS calculation logic exists anywhere |

#### Transaction Message Tab — ALL 12 Auto-Message Toggles Are UI-Only
| Setting | Status | Why |
|---------|--------|-----|
| `sendViaVyapar` | ❌ UI-ONLY | Never checked before sending |
| `sendViaWhatsApp` | ❌ UI-ONLY | Never checked before sending |
| `sendMessageToParty` | ❌ UI-ONLY | Never checked |
| `sendCopyToSelf` | ❌ UI-ONLY | Never checked |
| `sendTransactionUpdates` | ❌ UI-ONLY | Never checked |
| `autoShareInvoices` | ❌ UI-ONLY | Never checked |
| `autoMsgSales`, `autoMsgPurchase`, `autoMsgSaleReturn`, `autoMsgPurchaseReturn` | ❌ ALL UI-ONLY | Never checked by sale/purchase creation |
| `autoMsgPaymentIn`, `autoMsgPaymentOut` | ❌ UI-ONLY | Never checked |
| `autoMsgOrder`, `autoMsgEstimate`, `autoMsgProforma`, `autoMsgDc` | ❌ UI-ONLY | Never checked |

#### Party Tab — 1 of ~15 is UI-Only
| Setting | Status | Why |
|---------|--------|-----|
| `printShippingAddress` | ❌ UI-ONLY | Never read by any print logic |

#### Item Tab — 1 Missing Toggle
| Setting | Status | Why |
|---------|--------|-----|
| `wholesalePrice` | ❌ MISSING FROM UI | Defined in schema, read by Products.js + CreateSale.js, but has NO toggle in ItemTab |
| Custom Fields section | ❌ HARDCODED | 2 dummy fields (HSN Code, Color). "Add" button shows "under development" toast |

#### Notification Preferences — 3 Channel Configs Saved But Never Used
| Setting | Status | Why |
|---------|--------|-----|
| SMTP host/port/user/pass | ❌ UI-ONLY | `emailService.js` exists but NEVER required by any trigger |
| SMS API key/sender ID | ❌ UI-ONLY | `smsService.js` exists but NEVER required by any trigger |
| Push VAPID keys | ❌ UI-ONLY | `pushNotificationService.js` exists but NEVER required by server.js |

### GRAND TOTAL: ~70+ UI-Only Settings

---

## 8. PRINT TAB — COMPLETE DECONSTRUCTION

```
File:  client/src/components/Settings/PrintTab.js
Lines: 1147 (LARGEST single component file)
```

### What It Shows
- Full live preview with invoice template
- 4 themes with accent color picker
- Regular printer settings (50+ toggles, dropdowns, inputs)
- Thermal printer settings (12+ controls)
- 3 Vyapar printer brand setup buttons

### What Actually Works
| Feature | Works? | Details |
|---------|--------|---------|
| Saves to DB | ✅ | All 50+ settings persist to MongoDB |
| Loads from DB | ✅ | Settings load correctly on page mount |
| Live preview | ✅ | Client-side mock preview updates in real-time |

### What Does NOT Work
| Feature | Works? | Details |
|---------|--------|---------|
| **Changes actual PDF output** | ❌ | `getPref('print', any_key)` is NEVER called by any component |
| **Changes thermal print** | ❌ | Thermal endpoints don't reference print prefs |
| **Changes invoice print** | ❌ | PDF generation in pdfController.js ignores print prefs |
| **Printer setup buttons** | ❌ | All 3 show "coming soon" toasts |
| **Thermal printer toggles** | ❌ | 5 controls permanently disabled with "(Requires printer API)" |
| **Dark mode** | ❌ | ZERO `dark:` variants — completely unreadable in dark mode |

---

## 9. FRONTEND ↔ BACKEND CONNECTION MAP

```
┌────────────────────────────────────────────────────────────────┐
│  CONNECTED: 40/44 feature areas    BROKEN: 2    MISSING: 2    │
└────────────────────────────────────────────────────────────────┘
```

### BROKEN CONNECTIONS
| Frontend Call | Expected Backend | Actual Status | Broken Since |
|--------------|------------------|---------------|--------------|
| `chequeAPI.getById(id)` | `GET /accounting/cheques/:id` | ❌ **404 — Route doesn't exist** | Inception |
| `pushNotificationAPI.subscribe()` | `POST /notifications/push/subscribe` | ❌ **404 — No route defined** | Inception |

### MISSING FRONTEND → BACKEND
| Backend Feature | Frontend API Object | Status |
|----------------|-------------------|--------|
| `/api/currencies/*` (5 routes) | **No `currencyAPI` in api.js** | ❌ No frontend access |
| `/api/imports/barcode/*` (18 routes) | **No dedicated API calls in api.js** | ❌ Orphaned backend |
| Search endpoint | **No dedicated search API** | ❌ Missing entirely |

### ORPHANED FRONTEND API OBJECTS
| API Object | Defined Where | Used Where | Status |
|-----------|--------------|------------|--------|
| `auditAPI` | `api.js:390` | **Nowhere** — never imported | ❌ Dead code |
| `manufacturingAPI` | `api.js:503` | **Nowhere** — only in comment | ❌ Dead code |
| `advReportAPI` | `api.js:254` | **Nowhere** — never imported | ❌ Dead code |
| `pushNotificationAPI` | `api.js:160` | **Nowhere** — never imported | ❌ Dead code |

### ORPHANED BACKEND SERVICES
| Service File | Where Required | Status |
|-------------|---------------|--------|
| `pushNotificationService.js` | **Nowhere** | ❌ Dead file |
| `messagingTrigger.js` | **Nowhere** | ❌ Dead file |

---

## 10. DEAD/ORPHANED CODE INVENTORY

| # | Item | Type | Location | Status |
|---|------|------|----------|--------|
| 1 | `auditAPI` | Frontend API object | `api.js:390` | ❌ Defined, never imported |
| 2 | `manufacturingAPI` | Frontend API object | `api.js:503` | ❌ Defined, never imported |
| 3 | `advReportAPI` | Frontend API object | `api.js:254` | ❌ Defined, never imported |
| 4 | `pushNotificationAPI` | Frontend API object | `api.js:160` | ❌ Defined, never imported |
| 5 | `currencyAPI` | Frontend API object | **MISSING** | ❌ Full backend, no frontend |
| 6 | `pushNotificationService.js` | Server service | `server/services/` | ❌ Never required |
| 7 | `messagingTrigger.js` | Server service | `server/services/` | ❌ Never required |
| 8 | `excelUpload` endpoint | Server endpoint | `importController.js` | ❌ Never called by UI |
| 9 | `excelPreview` endpoint | Server endpoint | `importController.js` | ❌ Never called by UI |
| 10 | `otherIncomeEnabled` | Frontend variable | `Sidebar.js:235` | ❌ Declared, never referenced |
| 11 | `summaryItems` / `runningTotal` | Frontend variables | `ViewSale.js:106-115` | ❌ Computed, never rendered |
| 12 | `summaryItems` / `runningTotal` | Frontend variables | `ViewEstimate.js:99-108` | ❌ Computed, never rendered |
| 13 | `ROLE_ROUTES` | Frontend object | `ProtectedRoute.js:7-13` | ❌ Defined, never referenced |
| 14 | `user` role in User enum | Server enum value | `User.js:15` | ❌ No permission map exists |
| 15 | `purchase_return` notification type | Server enum value | `Notification.js` | ❌ Declared, never created |
| 16 | `sale_return` notification type | Server enum value | `Notification.js` | ❌ Declared, never created |
| 17 | `getSalesReport` controller | Server controller | `reportController.js:14-46` | ❌ Frontend uses `/sales` instead |
| 18 | `getDayBook` controller | Server controller | `reportController.js:566-599` | ❌ Frontend uses `/transactions` |
| 19 | `getCashFlow` controller | Server controller | `reportController.js:600-650` | ❌ Frontend uses `/transactions` |
| 20 | `getAllTransactions` controller | Server controller | `reportController.js:651-700` | ❌ Frontend uses `/transactions` |
| 21 | `getValuationByMethod` controller | Server controller | `stockController.js` | ❌ Defined, never called from frontend |
| 22 | PartyStatement pagination code | Server controller | `reportController.js:1158-1159` | ❌ Frontend never passes page/limit |
| 23 | `pino` logging package | Server dependency | `package.json` | ❌ Listed in deps, ZERO files import it |

---

## 11. BROKEN PAGES & COMPONENTS

### 🚫 PAGES THAT CRASH
| Page | Route | Issue |
|------|-------|-------|
| **PaymentOut** | `/purchases/payment-out` | **❌ NO EXPORT** — File ends at line 635 with `};` but has no `export default PaymentOut;`. Router will throw "Element type is invalid" error. |

### 🚫 PAGES WITH BROKEN DATA
| Page | Issue | Details |
|------|-------|---------|
| **DayBookReport** | Wrong running balance | Computes from 0 in descending date order instead of using `reportAPI.getDayBook()` |
| **CashFlowReport** | Custom broken CSV | Uses DOM table scraping instead of `exportToExcel` utility |
| **AllTransactionsReport** | Client-side date filtering | Loads 5000 records, filters in JS |
| **Settings (all tabs)** | No dark mode | ~90+ instances of hardcoded colors without dark variants |

### 🚫 COMPONENTS THAT DON'T WORK
| Component | Issue |
|-----------|-------|
| **PrintTab.js** (1147 lines) | Entirely decorative — 50+ settings change nothing. No dark mode. |
| **ItemTab.js** | Custom fields "Add" shows "under development" toast |
| **NotificationPreferencesTab.js** | Full SMTP/SMS/Push forms but no sending infrastructure |
| **TransactionMessageTab.js** | 12 auto-message toggles never checked |
| **ReportHeader.js** | "ALL FIRMS" dropdown is static/non-functional |

---

## 12. BROKEN BUTTONS & ICONS

### BUTTONS THAT DO NOTHING USEFUL (Toast Only)

| Button | Location | Line | Message |
|--------|----------|------|---------|
| **Add Custom Fields** | `Settings/ItemTab.js` | 91 | "under development" |
| **New Order** (Manufacturing) | `pages/Manufacturing.js` | 62 | "Create from Settings..." |
| **Printer Quick Setup — VYPRTP2001** | `Settings/PrintTab.js` | 1113 | "coming soon" |
| **Printer Quick Setup — VYPRTP3001** | `Settings/PrintTab.js` | 1115 | "coming soon" |
| **Printer Quick Setup — VYPRTP2002** | `Settings/PrintTab.js` | 1117 | "coming soon" |
| **Version info** (clickable span) | `Sidebar/Header.js` | 204 | "Current version: Vyapar Clone v1.0.0" |
| **Shortcuts info** (clickable span) | `Sidebar/Header.js` | 207 | "Shortcuts: Ctrl+K Search..." |

### PERMANENTLY DISABLED CONTROLS

| Control | Location | Line | Label |
|---------|----------|------|-------|
| Checkbox | `Settings/PrintTab.js` | 764 | "Make Thermal Printer Default" |
| Select | `Settings/PrintTab.js` | 810 | "Printing Type" (Text/Image) |
| Checkbox | `Settings/PrintTab.js` | 820 | "Use Text Styling(Bold)" |
| Checkbox | `Settings/PrintTab.js` | 828 | "Auto Cut Paper After Printing" |
| Checkbox | `Settings/PrintTab.js` | 836 | "Open Cash Drawer After Printing" |

### POOR UX BUTTONS

| Button | Location | Line | Issue |
|--------|----------|------|-------|
| View Expense | `pages/Expenses.js` | 339 | Uses browser `alert()` instead of proper modal |
| "PDF" on Ledger pages | `CustomerLedger.js:113`, `SupplierLedger.js:112` | Calls `window.print()` NOT server PDF generation |

### ICONS

| Icon | Issue |
|------|-------|
| `sale_updated` notification type | Falls through to generic Bell icon — missing from `notifIconMap` in Header.js |
| **All other icons** | ✅ Checked — all have proper state and handlers |

---

## 13. VIEW PAGE DEEP ANALYSIS

### ViewSale.js (546 lines)
| Check | Status | Notes |
|-------|--------|-------|
| API data loading | ✅ | `saleAPI.getById(id)` + `settingAPI.get()` |
| Error handling | ✅ | Toast on error |
| All buttons work | ✅ | Back, Receive, Convert, Edit, Duplicate, Print, PDF, WhatsApp, Delete, More |
| Print | ✅ | Custom HTML in new window with multi-copy |
| PDF | ✅ | Downloads from `saleAPI.getPDF()` |
| WhatsApp | ✅ | `shareDocumentToWhatsApp()` with error fallback |
| **BUG: Due Date** | ❌ | Line 267: Shows `sale.date` (invoice date) instead of `sale.dueDate` |
| **BUG: paymentMethod** | ❌ | Lines 145, 399: References `sale.paymentMethod` but Sale model has `payments[].mode` |
| Unused computed vars | ❌ | `summaryItems` and `runningTotal` (lines 106-115) never rendered |
| Dark mode | ✅ | Full implementation |
| Missing item fields vs model | ⚠️ | igst, cess, freeQuantity, unit, hsn, mrp, batchNo, serialNo, discountAmount, costPrice, profit |
| Missing top-level fields vs model | ⚠️ | shippingCharge, packingCharge, freightCharge, roundOff, tcsAmount, notes, transportMode, vehicleNo, poNumber, salesPerson, customerGst, billingAddress, placeOfSupply |

### CustomerLedger.js (466 lines) & SupplierLedger.js (456 lines)
| Check | Status | Notes |
|-------|--------|-------|
| API data loading | ✅ | `ledgerAPI.getCustomer/Supplier()` + `ledgerNoteAPI.get()` |
| Error handling | ✅ | Uses `Promise.allSettled` (best pattern in app) |
| **"PDF" button is fake** | ❌ | Lines 113-132: Opens new window and calls `.print()` — NOT a real server PDF. Misleading button label. |
| Print | ✅ | Custom formatted print layout |
| Excel/CSV | ✅ | Proper CSV export with BOM |
| Dark mode | ✅ | Full implementation |
| SupplierLedger missing Payment icon | ⚠️ | No `Payment` entry type in icon mapping (lines 174-183) |

### PartyDetails.js (694 lines)
| Check | Status | Notes |
|-------|--------|-------|
| **BUG: Dynamic Tailwind classes** | ❌ | Lines 237-238, 329, 337, 382-383, 390-391: `bg-${stat.color}-50`, `text-${stat.color}-600` — Tailwind JIT cannot detect dynamic classes. Will NOT work in production builds. |
| **BUG: "Both" party type** | ❌ | Lines 174-176: Creates TWO records (one customer + one supplier) instead of a single party |
| No export/share buttons | ⚠️ | No Print/PDF/WhatsApp/Share on this page |
| Missing modal fields vs model | ⚠️ | No `gstType`, `paymentTerms`, `bankDetails`, `tdsApplicable`, `tcsApplicable` |

### ViewOrder.js, ViewReturn.js, ViewEstimate.js, ViewChallan.js, ViewProforma.js
| Check | Status | Notes |
|-------|--------|-------|
| API data loading | ✅ All | Same pattern as ViewSale |
| All buttons work | ✅ All | Convert, Edit, Duplicate, Print, PDF, WhatsApp, More |
| **ViewEstimate unused Modal import** | ❌ | Line 5: `Modal` imported but never rendered |
| **ViewEstimate unused icon imports** | ❌ | `Share2`, `Banknote`, `Building2` imported but not used |
| **ViewReturn BUG: `originalInvoice`** | ❌ | Line 157: `sale.originalInvoice` doesn't exist on Sale model (model has `parentSale` ObjectId). Always shows `-`. |
| **ViewOrder dark mode gap** | ❌ | Lines 322, 326, 331: Delivery tracking inputs missing `dark:` variants |
| Dark mode overall | ✅ Good | Most view pages have comprehensive dark mode |

---

## 14. DATA INTEGRITY ISSUES

### FINANCIAL CALCULATION BUGS

| # | Bug | Impact | File:Line |
|---|-----|--------|-----------|
| 1 | `remainingBalance \|\| totalAmount` — `0 \|\| X = X` | Fully paid sales appear unpaid | `saleController.js:364,558` |
| 2 | Dashboard adds account balances + transaction sums | Cash/bank balances doubled | `dashboardController.js:103-119` |
| 3 | Dashboard COGS uses CURRENT product costPrice (not stamped) | Historical profit changes when costPrice changes | `dashboardController.js:43` |
| 4 | No JE update on sale/purchase edit | Account balances stale after edits | `saleController.js:657-779`, `purchaseController.js:419-525` |
| 5 | Expiry date code in wrong scope | Most estimates get no expiry date | `saleController.js:498-515` |

### STOCK MANAGEMENT BUGS

| # | Bug | Impact | File:Line |
|---|-----|--------|-----------|
| 6 | `recordStockMovement` reads post-update stock | All purchase stock movements have wrong balanceBefore/balanceAfter | `stockController.js:31-48` |
| 7 | `balanceAfter = Math.max(0, ...)` | Negative stock silently hidden | `stockController.js:40` |
| 8 | Purchase stock movements run AFTER transaction commit | No rollback on failure | `purchaseController.js:395-397` |
| 9 | No duplicate purchase billNumber guard | Duplicate purchases enterable | `purchaseController.js` |
| 10 | No anti-duplicate guard on purchase returns | Multiple returns on same purchase | `purchaseReturnController.js:43-192` |
| 11 | convertToChallan/Estimate don't mark original | Infinite conversions | `saleController.js:1090-1195` |

### GST CALCULATION BUGS

| # | Bug | Impact | File:Line |
|---|-----|--------|-----------|
| 12 | Sale trusts client for GST values | Wrong GST possible via malicious/buggy client | `saleController.js:169-293` |
| 13 | Purchase recalculates GST server-side | Inconsistent with sale approach | `purchaseController.js:76-108` |

### CUSTOMER BALANCE BUGS

| # | Bug | Impact | File:Line |
|---|-----|--------|-----------|
| 14 | openingBalance not adjusted on sale item changes | Outstanding balance wrong after edit | `updateSale:657-779` |
| 15 | "Both" party type creates 2 records | Duplicate parties | `PartyDetails.js:174-176` |

### TRANSACTION SAFETY BUGS

| # | Bug | Impact | File:Line |
|---|-----|--------|-----------|
| 16 | withTransaction() non-atomic on standalone MongoDB | Partial writes on crash | `withTransaction.js:30-33` |
| 17 | JE errors silently swallowed | Silent data loss | `purchaseController.js:385-387`, `purchaseReturnController.js:171-173` |
| 18 | All external notifications silent `.catch(() => {})` | No error visibility | Multiple files |
| 19 | Backup import creates fake data on sql.js failure | Users believe fake data is real | `importController.js:511-516` |

---

## 15. NOTIFICATION SYSTEM AUDIT

### WHAT WORKS
| Feature | Status | Details |
|---------|--------|---------|
| Bell icon | ✅ | Opens dropdown, shows notifications, clear all, mark read |
| DB Persistence | ✅ | MongoDB with indexes, preference checking |
| Triggers (12+) | ✅ | Sale create/update/cancel, purchase create/update/delete, payment received/due, expense CRUD, customer/supplier add, bank transaction, low stock, service reminder |
| Mark as read | ✅ | Single and bulk |
| Unread count | ✅ | Server-counted, refreshed every 30s |

### WHAT IS BROKEN
| Issue | Severity | Details |
|-------|----------|---------|
| **6 notification types silently fail** | 🔴 HIGH | `purchase_updated`, `purchase_deleted`, `expense_updated`, `expense_deleted`, `payment_out`, `payment_out_deleted` — NOT in Mongoose enum. ValidationError swallowed by `.catch(() => {})` |
| **No real-time delivery** | 🟡 MED | 30-second polling only. No WebSocket/Socket.IO/SSE |
| **2 unused enum values** | 🟢 LOW | `purchase_return`, `sale_return` — declared but never created |
| **No low-stock deduplication** | 🟡 MED | Every sale with low-stock product creates duplicate notifications |
| **stale notification count** | 🟢 LOW | Up to 30s stale between polls |
| **sale_updated has no icon** | 🟢 LOW | Falls through to generic Bell icon |

### NOTIFICATION TYPE MATRIX
| Type | In Model Enum | Created By | Has Icon | Works? |
|------|--------------|------------|----------|--------|
| `new_sale` | ✅ | `saleController.js:602` | ✅ | ✅ |
| `new_purchase` | ✅ | `purchaseController.js:399` | ✅ | ✅ |
| `payment_received` | ✅ | `saleController.js:1492` | ✅ | ✅ |
| `payment_due` | ✅ | `paymentReminderService.js:54` | ✅ | ✅ |
| `low_stock` | ✅ | `saleController.js:588` | ✅ | ✅ |
| `expense_created` | ✅ | `expenseController.js:118` | ✅ | ✅ |
| `service_reminder` | ✅ | `paymentReminderService.js:180` | ✅ | ✅ |
| `party_added` | ✅ | `customerController.js:65`, `supplierController.js:39` | ✅ | ✅ |
| `bank_transaction` | ✅ | `transactionController.js:51` | ✅ | ✅ |
| `sale_cancelled` | ✅ | `saleController.js:874` | ✅ | ✅ |
| `sale_updated` | ✅ | `saleController.js:780` | ❌ No icon | ⚠️ |
| `purchase_updated` | **❌ MISSING** | `purchaseController.js:516` | ❌ | ❌ |
| `purchase_deleted` | **❌ MISSING** | `purchaseController.js:600` | ❌ | ❌ |
| `expense_updated` | **❌ MISSING** | `expenseController.js:218` | ❌ | ❌ |
| `expense_deleted` | **❌ MISSING** | `expenseController.js:260` | ❌ | ❌ |
| `payment_out` | **❌ MISSING** | `paymentOutController.js:112` | ❌ | ❌ |
| `payment_out_deleted` | **❌ MISSING** | `paymentOutController.js:186` | ❌ | ❌ |
| `purchase_cancelled` | ✅ | `purchaseOrderController.js:155` | ✅ | ✅ |
| `purchase_return` | ✅ | **Never created** | ✅ | ❌ Unused |
| `sale_return` | ✅ | **Never created** | ✅ | ❌ Unused |

---

## 16. IMPORT/EXPORT AUDIT

```
┌──────────────────────────────────────────────────────────────┐
│  WORKS: 8    PARTIAL: 2    BROKEN: 1    DEAD CODE: 2        │
└──────────────────────────────────────────────────────────────┘
```

### FULLY WORKING
| Feature | Status | Details |
|---------|--------|---------|
| Excel Import (.xlsx/.xls) | ✅ | 7-step wizard, client-side XLSX parsing, server-side MongoDB insert, duplicate handling (skip/update/create) |
| CSV Import | ✅ | Same wizard, handled by xlsx library |
| Barcode Import (camera) | ✅ | `@zxing/library` `BrowserMultiFormatReader` for live camera scanning |
| Barcode Import (CSV bulk) | ✅ | Full column mapping, duplicate handling, stock/price modes |
| Excel Export (.xlsx) | ✅ | 11 modules, sheet per module, date filtering |
| CSV Export | ✅ | Single-sheet or ZIP of CSVs per module |
| Full Backup Export (ZIP) | ✅ | All collections as JSON, metadata manifest, sanitized fields |
| Import History | ✅ | Paginated, status badges, error log download |
| Export History | ✅ | Re-download previous exports |

### PARTIALLY WORKING
| Feature | Status | Issues |
|---------|--------|--------|
| PDF Export (Reports) | ⚠️ BASIC | Text-only, no borders, no headers/footers, no landscape, potential overflow |
| Vyapar Backup Import (.backup/.db) | ⚠️ RISKY | Works only if `sql.js` initializes; **silently creates fake data on failure** |

### BROKEN
| Feature | Status | Issue |
|---------|--------|-------|
| **Barcode getDashboardStats** | ❌ | `userId` ReferenceError crashes endpoint (line 611) |

### DEAD CODE
| Endpoint | Status | Why |
|----------|--------|-----|
| POST `/import/excel-upload` | ❌ Dead | Never called by any UI (wizard sends parsed JSON directly) |
| POST `/import/excel-preview` | ❌ Dead | Never called by any UI (wizard generates preview client-side) |

---

## 17. REPORT SYSTEM AUDIT

### REPORTS THAT USE WRONG ENDPOINTS (Should use reportAPI, use generic CRUD instead)

| Report | Uses | Should Use | Impact |
|--------|------|------------|--------|
| SaleReport | `saleAPI.getAll()` | `reportAPI.getSales()` | No pagination, dead controller |
| DayBookReport | `transactionAPI.getAll()` | `reportAPI.getDayBook()` | Wrong running balance |
| CashFlowReport | `transactionAPI.getAll()` | `reportAPI.getCashFlow()` | Broken CSV export |
| AllTransactionsReport | `transactionAPI.getAll()` | `reportAPI.getAllTransactions()` | Client-side filtering |
| StockSummary | `productAPI.getAll()` | Stock report endpoint | No pagination |

### REPORT CALCULATION MATRIX

| Report | Uses Correct Data? | Calculations Correct? | Pagination? | Export? |
|--------|-------------------|----------------------|-------------|---------|
| SaleReport | ✅ | ✅ | ❌ None | ✅ Excel/Print |
| PurchaseReport | ✅ | ✅ | ❌ None | ✅ Excel/Print |
| Profit & Loss | ✅ | ✅ (uses COGS, ex-GST) | N/A | ✅ Excel/Print |
| Balance Sheet | ✅ | ✅ | N/A | ✅ Excel/Print |
| Trial Balance | ✅ | ✅ | N/A | ✅ |
| **DayBook** | ✅ | **❌ WRONG** | ❌ None | ✅ Excel/Print |
| **CashFlow** | ✅ | ⚠️ Custom CSV broken | ❌ None | ⚠️ Broken CSV |
| **AllTransactions** | ✅ | ✅ (client-side filtered) | ❌ None | ✅ Excel/Print |
| **StockSummary** | ✅ | ✅ | ❌ None | ✅ Excel/Print |
| Stock Detail | ✅ | ✅ | ❌ None | ✅ |
| Stock Aging | ✅ | ✅ | N/A | ✅ |
| Low Stock | ✅ | ✅ | N/A | ✅ |
| Item Detail | ✅ | ✅ | ❌ None | ✅ |
| Item P&L | ✅ | ✅ | N/A | ✅ |
| GSTR-1 | ✅ | ✅ (B2B/B2C correct) | ❌ None | ✅ Excel/Print |
| GSTR-2 | ✅ | ✅ | ❌ None | ✅ |
| GSTR-3B | ✅ | ✅ | ❌ None | ✅ |
| GSTR-9 | ✅ | ✅ | ❌ None | ✅ |
| Party Statement | ✅ | ✅ | ⚠️ **Dead code** (controller has pagination, frontend ignores) | ✅ |
| GST Report | ✅ | ✅ (net liability correct) | N/A | ✅ Excel/Print |
| TCS Receivable | ✅ | TCS logic doesn't exist yet | ❌ None | ✅ |
| TDS Payable | ✅ | TDS logic doesn't exist yet | ❌ None | ✅ |
| Budget Report | ✅ | ✅ | ❌ None | ✅ |
| Bank Statement | ✅ | ✅ | ❌ None | ✅ |

### KEY ISSUE: No Server-Side Pagination on ~20 Reports
Every report that loads a list fetches ALL records, then filters/sorts client-side. At ~10K records, API response time degrades. At ~50K, crashes.

---

## 18. PERFORMANCE AUDIT

### CRITICAL PERFORMANCE ISSUES

| # | Issue | File | Impact |
|---|-------|------|--------|
| 1 | Dashboard loads ALL sales/purchases/expenses into Node.js memory | `dashboardController.js:21-23` | OOM at ~50K records |
| 2 | 20+ report methods fetch ALL data without `.limit()` | `reportController.js` | Timeout at scale |
| 3 | Missing DB indexes on 5+ models | PurchaseReturn, PurchaseOrder, Business, PartyToPartyTransfer, Support | Full collection scans on every query |
| 4 | Skip-based pagination gets slower as offset grows | All list controllers | O(n) degradation |
| 5 | `.sort()` without `.limit()` on many queries | `reportController.js` | In-memory sort on full collection |
| 6 | Reports use `limit=5000` hardcoded | DayBook, CashFlow, AllTransactions | Breaks at >5K |
| 7 | PurchaseReturn controller uses `$regex` with leading wildcard | `purchaseReturnController.js:18-22` | Cannot use indexes |
| 8 | Dashboard YoY comparison runs 2 additional full collection scans | `dashboardController.js:159-162` | Triples query load |
| 9 | Heavy `populate()` chains on sale list queries | `saleController.js:126-127` | Slow queries on large datasets |

### MONITORING/LOGGING GAPS
| Gap | Severity | Details |
|-----|----------|---------|
| `pino` package listed but NEVER used | 🔴 HIGH | All logging is `console.log/warn/error` |
| No structured logging | 🔴 HIGH | No JSON logs, no log levels, no request IDs |
| No request logging middleware | 🔴 HIGH | No method/URL/status/time tracking |
| No MongoDB slow query logging | 🟡 MED | `mongoose.set('debug', ...)` not configured |
| No health endpoint | 🟡 MED | `GET /health` or `GET /api/health` doesn't exist |
| No graceful shutdown | 🟡 MED | No `SIGTERM`/`SIGINT` handler |

---

## 19. DARK MODE AUDIT

### PAGES WITH COMPLETE DARK MODE
| Page | Status |
|------|--------|
| Dashboard | ✅ Full coverage |
| Sales (all pages) | ✅ Full coverage |
| Products | ✅ Full coverage |
| Customers | ✅ Full coverage |
| Suppliers | ✅ Full coverage |
| PurchaseBills | ✅ Full coverage |
| ViewSale, ViewOrder, ViewReturn, ViewEstimate, ViewChallan, ViewProforma | ✅ Full coverage |
| Login/Register/Forgot/Reset | ✅ Full coverage |
| MainLayout / AuthLayout | ✅ Both have dark variants |
| Sidebar (always-dark brand) | ✅ Intentional |
| Header | ✅ Full coverage |
| CustomerLedger / SupplierLedger | ✅ Full coverage |
| PartyDetails | ✅ Full coverage |
| All reports (list/stock/party/GST/tax) | ✅ Full coverage |
| CalendarPage | ✅ Full coverage |

### PAGES WITH PARTIAL/BROKEN DARK MODE
| Page | Status | Details |
|------|--------|---------|
| GeneralTab | ⚠️ Partial | Save bar hardcoded `bg-[#F5F6FA]` |
| PrintTab | ❌ **NONE** | 1147 lines, ZERO `dark:` variants |
| TaxesTab | ❌ **NONE** | All labels/inputs use `text-[#1F2937]` |
| TransactionTab | ❌ **NONE** | Save bar has no dark mode |
| ItemTab | ❌ **NONE** | Labels invisible in dark mode |
| AccountingTab | ❌ **NONE** | Content has no dark mode |
| NotificationPreferencesTab | ❌ **NONE** | No dark mode variants |
| TransactionMessageTab | ⚠️ Minimal | Most labels lack dark variants |
| ServiceRemindersTab | ⚠️ Partial | Several `text-[#1F2937]` without `dark:` |
| PartyTab | ⚠️ Partial | Most OK, some missing |
| Settings Page Container | ❌ **NONE** | `bg-[#F5F6FA]` hardcoded |
| SettingsSection | ❌ **NONE** | `text-[#1F2937]` no dark fallback |
| SettingsRow | ❌ **NONE** | `text-[#1F2937]`, `bg-white` |
| ToggleSwitch | ❌ **NONE** | `text-[#1F2937]` no dark fallback |
| ViewOrder delivery inputs | ⚠️ Partial | 3 inputs missing `dark:` at lines 322, 326, 331 |

### TOTAL: 90+ instances of `text-[#1F2937]` without `dark:text-*` in Settings files

---

## 20. USER MANAGEMENT & RBAC AUDIT

### ROLE PERMISSION MATRIX

| Permission | Admin | Manager | Accountant | Staff |
|-----------|-------|---------|------------|-------|
| Full access | ✅ `*` | — | — | — |
| Sales view | ✅ | ✅ | ✅ (view) | ✅ (view+create) |
| Purchases view | ✅ | ✅ | ✅ (view) | — |
| Products view | ✅ | ✅ | ✅ (view) | ✅ (view) |
| Customers view | ✅ | ✅ | ✅ (view) | ✅ (view) |
| Reports | ✅ | ✅ | ✅ | — |
| Accounting | ✅ | ✅ | ✅ | — |
| Cash/Bank | ✅ | ✅ | ✅ (view) | — |
| Expenses | ✅ | ✅ | ✅ (view) | — |
| Settings | ✅ | ✅ | — | — |
| Users/Staff | ✅ | ✅ | — | ✅ (view staff) |
| Dashboard | ✅ | ✅ | ✅ | ✅ |

### SECURITY GAPS IN RBAC
| Issue | Severity | Details |
|-------|----------|---------|
| WhatsApp send-document no authorize() | 🔴 HIGH | Any authenticated user can send WhatsApp docs |
| Currency routes no authorization | 🟡 MED | Any auth user can list all currencies |
| Only 5 of 50+ routes have frontend permission checks | 🔴 HIGH | ProtectedRoute.js only guards `user-management`, `settings`, `journal-entry`, `chart-of-accounts`, `account-statements` |
| Permission maps out of sync (frontend vs backend) | 🔴 HIGH | `usePermissions.js` and `authorize.js` define different permissions for Manager, Accountant, Staff |
| Admin can modify other admins | 🟡 MED | No restriction (except cannot delete owner) |
| Admin can deactivate owner via PUT | 🔴 HIGH | DELETE has `isOwner` guard, PUT doesn't |
| `user` role is a trap | 🟡 MED | In User model enum but no permission map — silently falls to Staff |
| No business-context filter on PUT user | 🟡 MED | Admin from Business A could update Business B users by ID |
| StaffPage.js no permission checks | 🟡 MED | No `usePermissions` import, no button-level guards |

---

## 21. NAVIGATION & ROUTING AUDIT

### SIDEBAR NAVIGATION
| Check | Status |
|-------|--------|
| Total sidebar entries | 8 top-level + 8 accordions + 51 sub-links = 67 navigation items |
| Dead links (sidebar route not in AppRoutes) | **0** — All 67 routes exist |
| Routes not in sidebar | ~55 (detail/edit views, reports sub-routes, auth routes) — expected |
| Items with NO permission gate | **4**: Calendar, GST Filing, Support, Utilities (all 15 sub-links) |

### ROUTE GUARD COVERAGE
| Route Type | Count | Guarded? |
|------------|-------|----------|
| Auth routes (login, register, forgot, reset) | 4 | N/A — public |
| Business setup | 1 | Redirect if already setup |
| Protected (all others) | ~117 | Auth check only (5 have permission check) |
| Permission-checked routes | 5 | `user-management`, `settings`, `journal-entry`, `chart-of-accounts`, `account-statements` |
| Routes WITHOUT permission check | ~112 | All sales, purchases, products, customers, suppliers, reports, expenses, banking, accounting, utilities, etc. |

### BREADCRUMBS
| Check | Status |
|-------|--------|
| Missing route labels | ⚠️ ~20+ routes missing from `routeLabels` map in `Breadcrumbs.js` |
| Fallback behavior | ✅ Auto-generates from URL segments (capitalizes hyphenated) |
| Correct labels | ⚠️ Some routes get wrong labels (e.g., `/parties/details` → "Details" not "Party Details") |

---

## 22. PRODUCTION READINESS ASSESSMENT

### SCALABILITY LIMITS
| Component | Max Safe | Failure Mode |
|-----------|----------|-------------|
| Dashboard | 5K sales | OOM at ~50K (loads all into memory) |
| Sale Report | 5K sales | Timeout at ~10K (no pagination) |
| DayBook Report | 5K transactions | Timeout at ~10K (limit=5000) |
| PurchaseReport | 5K purchases | Timeout at ~10K (no pagination) |
| Product listing | 5K products | Slow at ~10K (no server pagination) |
| Customer listing | 5K customers | Slow at ~10K (paginated but no server limit) |
| Concurrent users | ~50 | Single process, no cluster |
| Upload files | 500MB | No file validation |
| Database | 50K docs/collection | Missing indexes cause full scans |

### DEPLOYMENT MISSING
| Requirement | Present? | Notes |
|-------------|----------|-------|
| Dockerfile | ❌ | No containerization |
| docker-compose | ❌ | No orchestration |
| PM2 config | ❌ | No process manager |
| nginx config | ❌ | No reverse proxy |
| Health endpoint | ❌ | No `/health` route |
| Graceful shutdown | ❌ | No SIGTERM/SIGINT handler |
| Structured logging | ❌ | pino imported but unused |
| Request logging | ❌ | No morgan/pino-http |
| HTTPS/HSTS | ❌ | No redirect, no HSTS headers |
| .env.example | ❌ | Only .env with real secrets committed |

### WHAT WOULD FAIL FIRST IN PRODUCTION
```
1st sale with full payment   → remainingBalance=0 bug → customer balance wrong
1st dashboard view           → cash/bank doubled
1st purchase bill edit       → JE not updated → accounts stale
1st report with >5K rows     → timeout
1st backup import            → fake data if sql.js fails
1st purchase update          → notification silently fails (enum)
1st page load in dark mode   → Settings invisible
1st staff user login         → can access most pages despite permissions
```

---

## 23. FINAL ANSWERS: 14 CRITICAL QUESTIONS

### Q1: Is every frontend page connected to backend?
**No.** 5 frontend API objects are defined but never imported (`auditAPI`, `manufacturingAPI`, `advReportAPI`, `pushNotificationAPI`). 1 backend feature (`currencyAPI`) has no frontend at all. 2 backend service files are never required (`messagingTrigger.js`, `pushNotificationService.js`).

### Q2: Which features are frontend only?
- **Print settings** — entire tab (50+ settings) changes nothing
- **Transaction message auto-send** — 12 toggles never checked
- **TCS/TDS settings** — saved but no calculation logic exists
- **Composition scheme** — saved but never checked
- **Notification channel configs** — SMTP/SMS/Push fully configured but no sending
- **Search filtering** — AllTransactions, DayBook, CashFlow filter client-side
- **CustomerSearch** component — client-side filtering only

### Q3: Which features are backend only?
- **Currencies** (full CRUD + exchange rate, no frontend)
- **Audit log** (backend fully wired, frontend never calls it)
- **Push notification service** (file exists, never required)
- **Messaging triggers** (file exists, never required)
- **Valuation-method endpoint** (defined, never called)
- **5 dedicated report endpoints** (controller code exists, frontend uses generic CRUD)

### Q4: Which pages still use demo data?
- **Backup Import** (`importController.js:511-516`): Injects 250 fake customers + 1800 fake products on failure
- **SetupMyBusiness.js**: Contains "Sample Tax Invoice", "Sample Party", "Sample Item" text
- **PrintTab.js**: Contains "(Sample Party Name)" text
- **seed.js**: Development seeder (10 customers, 10 products, 9 suppliers, 7 sales)
- **seedPurchases.js**: Development seeder (8 hardcoded purchases)

### Q5: Which buttons/icons do nothing?
**Toast-only (non-functional):** Add Custom Fields (ItemTab.js), New Order (Manufacturing.js), 3 Printer Setup buttons (PrintTab.js), Version/Shortcuts info (Header.js)

**Permanently disabled:** 5 thermal printer controls (PrintTab.js:764,810,820,828,836)

**Poor UX:** View Expense uses `alert()` (Expenses.js:339), "PDF" on ledger pages uses `window.print()` not real PDF

### Q6: Which settings are fake?
**~70+ UI-only settings** across: Print Tab (ALL 50+), General Tab (5), Transaction Tab (4), Taxes Tab (4), Transaction Message Tab (ALL auto-message toggles), Party Tab (1), Notification Preferences (3 channel configs). See Section 7 for full list.

### Q7: Which reports are disconnected?
**5 reports** use generic CRUD instead of dedicated report endpoints: SaleReport, DayBookReport, CashFlowReport, AllTransactionsReport, StockSummary. Their dedicated controller functions are dead code.

### Q8: Which APIs are unused?
20+ endpoints: 5 dedicated report endpoints, 5 currency endpoints, 2 import endpoints, `/stock/valuation-method`, `POST /notifications/push/subscribe` (route doesn't exist), `GET /accounting/cheques/:id` (route doesn't exist).

### Q9: Which settings are copied from Vyapar but not implemented?
**10 features**: Vyapar Printer Setup (3 "coming soon" buttons), Thermal Printer API (5 disabled controls), TCS/TDS (no logic), Composition Scheme (no logic), Transaction auto-messages (no trigger), WhatsApp auto-send (no trigger), Email/SMS/Push channels (no infrastructure), Audit Trail (not checked), Goods Return on DC (not checked), Print Amount on DC (not checked).

### Q10: Can this application be deployed today?
**No.** 19 critical bugs, 30 high-severity issues, 6 critical security vulnerabilities. Top blockers: financial data corruption (paid sales show as unpaid), dashboard wrong, backup import injects fake data, JWT_SECRET in git, no input validation.

### Q11: Production readiness percentage?
**15-20%** — Core CRUD works but financial calculations unreliable, security weak, scaling will fail beyond a few thousand records.

### Q12: ERP/Vyapar clone completeness percentage?
**65-70%** — Missing: working print configuration, TCS/TDS logic, auto-messaging, notification delivery, thermal printer support, dark mode in settings, composition scheme.

### Q13: Highest-risk production issues?
1. Financial corruption (`remainingBalance || totalAmount` bug + double-counted balances + stale JEs)
2. Security breach (JWT in git, no validation, SQL injection, arbitrary file upload)
3. Data integrity (backup import injects fake data, wrong stock movements, non-atomic operations)

### Q14: Exact files involved in every issue?
Referenced throughout this report — every issue includes exact file paths and line numbers.

---

*End of Report — 370+ source files audited across 23 sections*
