// Razorpay Payment Links: config, link creation, status/reconciliation, webhook.
const Setting = require('../models/Setting');
const Sale = require('../models/Sale');
const PaymentLink = require('../models/PaymentLink');
const Receipt = require('../models/Receipt');
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const JournalEntry = require('../models/JournalEntry');
const AuditLog = require('../models/AuditLog');
const { withTransaction } = require('../utils/withTransaction');
const { decryptSecret } = require('../utils/secretCrypto');
const razorpay = require('../services/razorpayService');
const QRCode = require('qrcode');

// Pull the captured Razorpay payment id off a fetched link (needed for refunds).
const extractPaymentId = (link) => {
  const arr = Array.isArray(link?.payments) ? link.payments : [];
  const p = arr.find(x => x.status === 'captured') || arr[0];
  return p?.payment_id || p?.id || '';
};

// Fire-and-forget audit entry for a payment/refund (never breaks the flow).
const auditPayment = async (userId, businessId, action, entityId, description) => {
  try { await AuditLog.create({ user: userId, business: businessId, action, entity: 'PaymentLink', entityId, description }); } catch {}
};

// Build a CSP-safe data: URL QR for a link (the app's CSP blocks external QR services).
const qrFor = async (url) => {
  try { return await QRCode.toDataURL(url, { width: 240, margin: 1 }); } catch { return null; }
};

// Load the decrypted Razorpay credentials for a user/business. Returns null if not set up.
const getRazorpayKeys = async (userId, businessId) => {
  // Settings has a unique index on `user` (one doc per user), so always look up by user only.
  const setting = await Setting.findOne({ user: userId });
  const rp = setting?.preferences?.payments?.razorpay;
  if (!rp || !rp.enabled || !rp.keyId || !rp.keySecret) return null;
  return {
    keyId: rp.keyId,
    keySecret: decryptSecret(rp.keySecret),
    webhookSecret: rp.webhookSecret ? decryptSecret(rp.webhookSecret) : '',
  };
};

// GET /api/payments/config — returns config WITHOUT exposing the secret.
const getConfig = async (req, res) => {
  try {
    const setting = await Setting.findOne({ user: req.user._id });
    const rp = setting?.preferences?.payments?.razorpay || {};
    res.json({
      enabled: !!rp.enabled,
      keyId: rp.keyId || '',
      hasSecret: !!rp.keySecret,
      hasWebhookSecret: !!rp.webhookSecret,
      mode: (rp.keyId || '').startsWith('rzp_live_') ? 'live' : 'test', // #15 Test/Live indicator
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// POST /api/payments/config — save keys (verifies them with Razorpay first).
const saveConfig = async (req, res) => {
  try {
    const { enabled, keyId, keySecret, webhookSecret } = req.body;
    const setting = await Setting.findOne({ user: req.user._id })
      || new Setting({ user: req.user._id, business: req.businessId });

    setting.preferences = setting.preferences || {};
    setting.preferences.payments = setting.preferences.payments || {};
    const cur = setting.preferences.payments.razorpay || {};

    const newKeyId = keyId !== undefined ? keyId.trim() : cur.keyId;
    // Only replace the secret if a new (non-masked) one was provided.
    const newSecret = keySecret ? keySecret.trim() : cur.keySecret;

    if (enabled) {
      // Validate credentials before enabling so we never turn on a broken config.
      const secretPlain = keySecret ? keySecret.trim() : (cur.keySecret ? decryptSecret(cur.keySecret) : '');
      if (!newKeyId || !secretPlain) return res.status(400).json({ message: 'Key ID and Key Secret are required' });
      const ok = await razorpay.verifyKeys({ keyId: newKeyId, keySecret: secretPlain }).catch(() => false);
      if (!ok) return res.status(400).json({ message: 'Invalid Razorpay credentials — please check the Key ID and Secret.' });
    }

    setting.preferences.payments.razorpay = {
      enabled: !!enabled,
      keyId: newKeyId || '',
      keySecret: newSecret || '',
      webhookSecret: webhookSecret !== undefined ? webhookSecret.trim() : (cur.webhookSecret || ''),
    };
    setting.markModified('preferences.payments.razorpay');
    await setting.save();
    res.json({ success: true, enabled: !!enabled, keyId: newKeyId || '' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// POST /api/payments/link  { invoiceId } — create (or reuse) a payment link for an invoice.
const createLink = async (req, res) => {
  try {
    const { invoiceId } = req.body;
    if (!invoiceId) return res.status(400).json({ message: 'invoiceId is required' });

    const keys = await getRazorpayKeys(req.user._id, req.businessId);
    if (!keys) return res.status(400).json({ message: 'Razorpay is not configured. Add your keys in Settings → Payments.' });

    const sale = await Sale.findOne({ _id: invoiceId, user: req.user._id });
    if (!sale) return res.status(404).json({ message: 'Invoice not found' });

    const due = (sale.totalAmount || 0) - (sale.paidAmount || 0);
    if (due <= 0) return res.status(400).json({ message: 'This invoice is already fully paid.' });

    // Reuse an existing un-paid link for this invoice instead of creating duplicates.
    const existing = await PaymentLink.findOne({ sale: sale._id, status: 'created' }).sort({ createdAt: -1 });
    if (existing && existing.shortUrl) {
      return res.json({ shortUrl: existing.shortUrl, id: existing.providerLinkId, amount: existing.amount, qr: await qrFor(existing.shortUrl), reused: true });
    }

    const link = await razorpay.createPaymentLink(keys, {
      amountRupees: due,
      description: `Payment for invoice ${sale.invoiceNumber || ''}`.trim(),
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      referenceId: String(sale._id),
      notes: { invoiceId: String(sale._id), invoiceNumber: sale.invoiceNumber || '' },
    });

    await PaymentLink.create({
      user: req.user._id,
      business: req.businessId,
      sale: sale._id,
      provider: 'razorpay',
      providerLinkId: link.id,
      shortUrl: link.short_url,
      amount: due,
      status: 'created',
    });

    res.json({ shortUrl: link.short_url, id: link.id, amount: due, qr: await qrFor(link.short_url) });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// Apply a successful payment to the invoice exactly once (idempotent via PaymentLink.reconciled).
// Mirrors the manual receivePayment flow so online payments hit the SAME accounting surfaces:
//   - updates the Sale (paidAmount / remainingBalance / paymentStatus / embedded payment)
//   - creates a numbered Receipt (mode 'bank' → online money routes to the Bank Book)
//   - decrements the customer's outstanding balance (Customer.openingBalance)
// All inside one DB transaction so the books never end up half-updated.
const reconcilePaymentLink = async (paymentLinkDoc, amountPaidRupees) => {
  // Atomically CLAIM the link (reconciled:false -> true) so a concurrent poller + webhook can
  // never double-credit the same payment. If the claim doesn't match, another path has it.
  // On ANY failure below we revert the claim so the next poll retries cleanly.
  const claimed = await PaymentLink.findOneAndUpdate(
    { _id: paymentLinkDoc._id, reconciled: false },
    { reconciled: true, status: 'paid', paidAt: new Date() },
    { new: true }
  );
  if (!claimed) return;

  const userId = claimed.user;
  const businessId = claimed.business;
  // Match the app's scoping convention (business-scoped when present, else user-scoped).
  const baseFilter = businessId ? { business: businessId } : { user: userId };

  try {
  const amount = amountPaidRupees || claimed.amount || 0;
  // Scope the invoice lookup to the link's owner (don't trust a bare id).
  const sale = await Sale.findOne({ _id: claimed.sale, ...baseFilter });

  // Nothing to post (missing sale / zero amount): the claim already marked the link paid.
  if (!sale || amount <= 0) return;

  // Receipt number — reuse the configured payment-in / receipt prefix.
  const setting = await Setting.findOne({ user: userId });
  const txnPrefs = setting?.preferences?.transaction || {};
  const prefix = txnPrefs.paymentInPrefix || txnPrefs.receiptPrefix || 'RCP-';
  const lastReceipt = await Receipt.findOne(baseFilter).sort({ createdAt: -1 });
  let nextNum = 1;
  if (lastReceipt && lastReceipt.receiptNumber) {
    nextNum = (parseInt(lastReceipt.receiptNumber.replace(prefix, '')) || 0) + 1;
  }
  const receiptNumber = `${prefix}${String(nextNum).padStart(6, '0')}`;

  sale.paidAmount = (sale.paidAmount || 0) + amount;
  sale.remainingBalance = Math.max(0, (sale.totalAmount || 0) - sale.paidAmount);
  sale.paymentStatus = sale.remainingBalance <= 0 ? 'paid' : (sale.paidAmount > 0 ? 'partial' : 'unpaid');
  if (!sale.payments) sale.payments = [];
  sale.payments.push({ mode: 'razorpay', amount, date: new Date(), referenceNo: paymentLinkDoc.providerLinkId });

  const receipt = new Receipt({
    user: userId, business: businessId,
    receiptNumber, sale: sale._id, invoiceNumber: sale.invoiceNumber,
    customer: sale.customer, customerName: sale.customerName || 'Walk-in',
    date: new Date(), amount, mode: 'bank', // Receipt enum has no 'razorpay'; online settles to bank
    referenceNo: paymentLinkDoc.providerLinkId, notes: 'Razorpay online payment',
    status: 'cleared', createdBy: 'Razorpay',
  });

  await withTransaction(async (session) => {
    await sale.save({ session });
    if (sale.customer) {
      await Customer.findOneAndUpdate({ ...baseFilter, _id: sale.customer }, { $inc: { openingBalance: -amount } }, { session });
    }
    await receipt.save({ session });

    // Bank Book entry — online money settles to the bank account (not cash).
    const payTxn = new Transaction({
      user: userId, business: businessId,
      type: 'bank_in', amount,
      description: `Online payment received - ${receiptNumber} for ${sale.invoiceNumber} from ${sale.customerName || 'Walk-in'}`,
      date: new Date(), reference: receiptNumber, referenceModel: 'Receipt', referenceId: receipt._id,
      partyName: sale.customerName || 'Walk-in', partyType: 'customer',
    });
    await payTxn.save({ session });

    // Double-entry journal: Dr Bank (1002, fallback Cash 1001) / Cr Debtors (1101).
    let payAccount = await Account.findOne({ ...baseFilter, code: '1002' });
    if (!payAccount) payAccount = await Account.findOne({ ...baseFilter, code: '1001' });
    const custAccount = await Account.findOne({ ...baseFilter, code: '1101' });
    if (payAccount && custAccount) {
      const payLines = [
        { account: payAccount._id, accountName: payAccount.name, accountType: payAccount.type, debit: amount, credit: 0 },
        { account: custAccount._id, accountName: custAccount.name, accountType: custAccount.type, debit: 0, credit: amount },
      ];
      const payJe = new JournalEntry({
        user: userId, business: businessId,
        entryNumber: `JE-RCV-${receiptNumber}`,
        entryDate: new Date(),
        referenceType: 'receipt', referenceId: receipt._id,
        lines: payLines, totalDebit: amount, totalCredit: amount,
        narration: `Online payment received for ${sale.invoiceNumber} from ${sale.customerName || 'Walk-in'}`,
        isPosted: true, postedAt: new Date(),
      });
      await payJe.save({ session });
      const balanceOps = payLines.map(line => {
        const acc = [payAccount, custAccount].find(a => a._id.toString() === line.account.toString());
        if (!acc) return null;
        const change = ['asset', 'expense'].includes(acc.type) ? line.debit - line.credit : line.credit - line.debit;
        return { updateOne: { filter: { ...baseFilter, _id: line.account }, update: { $inc: { balance: change } } } };
      }).filter(Boolean);
      if (balanceOps.length > 0) await Account.bulkWrite(balanceOps, { session });
    }
    // The link was already marked paid/reconciled by the atomic claim above.
  });
  await auditPayment(userId, businessId, 'create', claimed._id, `Online payment ₹${amount} received for ${sale.invoiceNumber || 'invoice'}`);
  } catch (err) {
    // Posting failed — release the claim so the next poll can retry instead of losing the payment.
    await PaymentLink.updateOne({ _id: paymentLinkDoc._id }, { reconciled: false, status: 'created', paidAt: null }).catch(() => {});
    console.error('[payments] reconcile failed, claim reverted:', err.message);
  }
};

// Fetch a link, capture its payment id, and reconcile if (partially) paid. Shared by the
// on-demand status check and the background poller.
const processLink = async (pl, keys) => {
  const link = await razorpay.fetchPaymentLink(keys, pl.providerLinkId);
  const payId = extractPaymentId(link);
  if (payId && pl.providerPaymentId !== payId) {
    await PaymentLink.updateOne({ _id: pl._id }, { providerPaymentId: payId }).catch(() => {});
  }
  if ((link.status === 'paid' || link.status === 'partially_paid') && !pl.reconciled && (link.amount_paid || 0) > 0) {
    await reconcilePaymentLink(pl, (link.amount_paid || 0) / 100);
  } else if (['cancelled', 'expired'].includes(link.status)) {
    await PaymentLink.updateOne({ _id: pl._id }, { status: link.status }).catch(() => {});
  }
  return link.status;
};

// GET /api/payments/link/:invoiceId/status — poll Razorpay and reconcile if paid (desktop path).
const getStatus = async (req, res) => {
  try {
    const pl = await PaymentLink.findOne({ sale: req.params.invoiceId, user: req.user._id }).sort({ createdAt: -1 });
    if (!pl) return res.json({ status: 'none' });
    if (pl.reconciled || pl.status === 'paid' || pl.status === 'refunded') {
      return res.json({ status: pl.status, shortUrl: pl.shortUrl, refundedAmount: pl.refundedAmount });
    }
    const keys = await getRazorpayKeys(req.user._id, req.businessId);
    if (!keys) return res.json({ status: pl.status, shortUrl: pl.shortUrl });

    await processLink(pl, keys);
    const fresh = await PaymentLink.findById(pl._id);
    res.json({ status: fresh.status, shortUrl: fresh.shortUrl, refundedAmount: fresh.refundedAmount });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// POST /api/payments/webhook — Razorpay server-to-server confirmation (cloud path).
// Needs the raw body; the route mounts express.raw for this path.
const webhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : JSON.stringify(req.body);
    const event = JSON.parse(rawBody);

    const linkEntity = event?.payload?.payment_link?.entity || event?.payload?.payment?.entity;
    const providerLinkId = linkEntity?.id || event?.payload?.payment_link?.entity?.id;
    if (!providerLinkId) return res.json({ ok: true });

    const pl = await PaymentLink.findOne({ providerLinkId });
    if (!pl) return res.json({ ok: true });

    const keys = await getRazorpayKeys(pl.user, pl.business);
    // Fail CLOSED: a webhook is only trusted if a secret is configured AND the signature is
    // valid. Without this, anyone who can reach the public endpoint could forge a "paid" event.
    if (!keys?.webhookSecret || !razorpay.verifyWebhookSignature(rawBody, signature, keys.webhookSecret)) {
      return res.status(400).json({ message: 'Webhook signature verification failed' });
    }

    // Replay guard (#14): reject events older than 5 minutes. Combined with the one-shot
    // `reconciled` claim, this prevents a captured-and-replayed event from being re-processed.
    if (event.created_at && (Date.now() / 1000 - event.created_at) > 300) {
      return res.status(400).json({ message: 'Stale webhook event ignored' });
    }

    if ((event.event === 'payment_link.paid' || event.event === 'payment.captured') && !pl.reconciled) {
      const paid = (linkEntity?.amount_paid || linkEntity?.amount || 0) / 100;
      await reconcilePaymentLink(pl, paid);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// POST /api/payments/refund { invoiceId, amount? } — refund a Razorpay payment and REVERSE the
// books (bank-out Transaction + Dr Debtors / Cr Bank journal + restore customer balance + sale).
const refundPayment = async (req, res) => {
  try {
    const { invoiceId, amount } = req.body;
    if (!invoiceId) return res.status(400).json({ message: 'invoiceId is required' });

    const keys = await getRazorpayKeys(req.user._id, req.businessId);
    if (!keys) return res.status(400).json({ message: 'Razorpay is not configured.' });

    const baseFilter = req.businessId ? { business: req.businessId } : { user: req.user._id };
    const pl = await PaymentLink.findOne({ sale: invoiceId, user: req.user._id, reconciled: true }).sort({ createdAt: -1 });
    if (!pl) return res.status(404).json({ message: 'No completed online payment found for this invoice.' });
    if (pl.status === 'refunded') return res.status(400).json({ message: 'This payment has already been refunded.' });

    // Need the captured payment id; fetch the link if we don't have it cached.
    let paymentId = pl.providerPaymentId;
    if (!paymentId) {
      const link = await razorpay.fetchPaymentLink(keys, pl.providerLinkId);
      paymentId = extractPaymentId(link);
    }
    if (!paymentId) return res.status(400).json({ message: 'Could not locate the Razorpay payment to refund.' });

    const refundable = (pl.amount || 0) - (pl.refundedAmount || 0);
    const refundAmount = amount ? Number(amount) : refundable;
    if (refundAmount <= 0 || refundAmount > refundable) return res.status(400).json({ message: 'Invalid refund amount.' });

    // 1) Refund at Razorpay FIRST (so we never reverse the books for a refund that didn't happen).
    const refund = await razorpay.refundPayment(keys, paymentId, refundAmount);

    // 2) Reverse the books in one transaction.
    const sale = await Sale.findOne({ _id: invoiceId, ...baseFilter });
    await withTransaction(async (session) => {
      if (sale) {
        sale.paidAmount = Math.max(0, (sale.paidAmount || 0) - refundAmount);
        sale.remainingBalance = Math.max(0, (sale.totalAmount || 0) - sale.paidAmount);
        sale.paymentStatus = sale.paidAmount <= 0 ? 'unpaid' : (sale.remainingBalance > 0 ? 'partial' : 'paid');
        await sale.save({ session });
        if (sale.customer) {
          await Customer.findOneAndUpdate({ ...baseFilter, _id: sale.customer }, { $inc: { openingBalance: refundAmount } }, { session });
        }
      }
      await new Transaction({
        user: req.user._id, business: req.businessId,
        type: 'bank_out', amount: refundAmount,
        description: `Refund ${refund.id} for ${sale?.invoiceNumber || 'invoice'}`,
        date: new Date(), reference: refund.id, referenceModel: 'PaymentLink', referenceId: pl._id,
        partyName: sale?.customerName || 'Walk-in', partyType: 'customer',
      }).save({ session });

      let bankAcc = await Account.findOne({ ...baseFilter, code: '1002' });
      if (!bankAcc) bankAcc = await Account.findOne({ ...baseFilter, code: '1001' });
      const custAcc = await Account.findOne({ ...baseFilter, code: '1101' });
      if (bankAcc && custAcc) {
        const lines = [
          { account: custAcc._id, accountName: custAcc.name, accountType: custAcc.type, debit: refundAmount, credit: 0 },
          { account: bankAcc._id, accountName: bankAcc.name, accountType: bankAcc.type, debit: 0, credit: refundAmount },
        ];
        await new JournalEntry({
          user: req.user._id, business: req.businessId,
          entryNumber: `JE-REF-${refund.id}`, entryDate: new Date(),
          referenceType: 'receipt', referenceId: pl._id,
          lines, totalDebit: refundAmount, totalCredit: refundAmount,
          narration: `Refund for ${sale?.invoiceNumber || 'invoice'}`, isPosted: true, postedAt: new Date(),
        }).save({ session });
        const ops = lines.map(line => {
          const acc = [bankAcc, custAcc].find(a => a._id.toString() === line.account.toString());
          const change = ['asset', 'expense'].includes(acc.type) ? line.debit - line.credit : line.credit - line.debit;
          return { updateOne: { filter: { ...baseFilter, _id: line.account }, update: { $inc: { balance: change } } } };
        });
        await Account.bulkWrite(ops, { session });
      }

      pl.refundId = refund.id;
      pl.refundedAmount = (pl.refundedAmount || 0) + refundAmount;
      pl.refundedAt = new Date();
      pl.status = 'refunded';
      await pl.save({ session });
    });

    await auditPayment(req.user._id, req.businessId, 'update', pl._id, `Refund ₹${refundAmount} (${refund.id}) for ${sale?.invoiceNumber || 'invoice'}`);
    res.json({ success: true, refundId: refund.id, amount: refundAmount });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// Best-effort: ensure a payment link exists for a sale and return its short URL (or null).
// Used by the WhatsApp message builder so the "Pay Now" link is a REAL Razorpay link.
// Never throws.
const ensurePaymentLinkForSale = async (userId, businessId, saleId) => {
  try {
    const keys = await getRazorpayKeys(userId, businessId);
    if (!keys) return null;
    const sale = await Sale.findOne({ _id: saleId, user: userId });
    if (!sale) return null;
    const due = (sale.totalAmount || 0) - (sale.paidAmount || 0);
    if (due <= 0) return null;

    const existing = await PaymentLink.findOne({ sale: sale._id, status: 'created' }).sort({ createdAt: -1 });
    if (existing && existing.shortUrl) return existing.shortUrl;

    const link = await razorpay.createPaymentLink(keys, {
      amountRupees: due,
      description: `Payment for invoice ${sale.invoiceNumber || ''}`.trim(),
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      referenceId: String(sale._id),
      notes: { invoiceId: String(sale._id), invoiceNumber: sale.invoiceNumber || '' },
    });
    await PaymentLink.create({
      user: userId, business: businessId, sale: sale._id, provider: 'razorpay',
      providerLinkId: link.id, shortUrl: link.short_url, amount: due, status: 'created',
    });
    return link.short_url;
  } catch (e) {
    console.error('[payments] ensurePaymentLinkForSale failed:', e.message);
    return null;
  }
};

// Background reconciliation: periodically poll open payment links and mark invoices paid.
// This is the desktop path (no public webhook needed) — it makes "mark as paid" automatic.
const startReconciliationPoller = () => {
  const INTERVAL = 60 * 1000;
  const tick = async () => {
    try {
      const pending = await PaymentLink.find({ status: { $in: ['created', 'partially_paid'] }, reconciled: false }).sort({ createdAt: -1 }).limit(50);
      for (const pl of pending) {
        const keys = await getRazorpayKeys(pl.user, pl.business);
        if (!keys) continue;
        try { await processLink(pl, keys); } catch (_) { /* one bad link shouldn't stop the batch */ }
      }
    } catch (_) {}
  };
  setInterval(tick, INTERVAL);
  setTimeout(tick, 15000);
};

module.exports = { getConfig, saveConfig, createLink, getStatus, webhook, refundPayment, getRazorpayKeys, reconcilePaymentLink, ensurePaymentLinkForSale, startReconciliationPoller };
