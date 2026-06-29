const Transaction = require('../models/Transaction');
const Supplier = require('../models/Supplier');
const JournalEntry = require('../models/JournalEntry');
const Account = require('../models/Account');
const { getBaseFilter, getCreateData } = require('../utils/queryHelper');
const { sendPaymentMessage } = require('../services/messageService');
const { createNotification } = require('../controllers/notificationController');
const { sendEmailNotification } = require('../services/emailService');
const { sendSMSNotification } = require('../services/smsService');
const { withTransaction } = require('../utils/withTransaction');

const getPaymentOuts = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { page = 1, limit = 50, search, dateFrom, dateTo } = req.query;
    const filter = { ...baseFilter, type: { $in: ['cash_out', 'bank_out'] } };
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { description: { $regex: escaped, $options: 'i' } },
        { partyName: { $regex: escaped, $options: 'i' } },
        { reference: { $regex: escaped, $options: 'i' } },
      ];
    }
    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom);
      if (dateTo) filter.date.$lte = (dateTo.includes('T') ? new Date(dateTo) : new Date(dateTo + 'T23:59:59.999Z'));
    }
    const total = await Transaction.countDocuments(filter);
    const payments = await Transaction.find(filter).sort({ date: -1 }).skip((page - 1) * limit).limit(parseInt(limit));
    res.json({ payments, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createPaymentOut = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const { amount, description, date, paymentMethod, partyName, partyType, reference, partyId } = req.body;
    const txnType = paymentMethod === 'cash' ? 'cash_out' : 'bank_out';

    const payment = await withTransaction(async (session) => {
      const [created] = await Transaction.create([{
        user: req.user._id, business: req.businessId, type: txnType, amount, description: description || 'Payment out',
        date: date || new Date(), reference: reference || '', referenceModel: 'PaymentOut',
        partyName: partyName || '', partyType: partyType || 'supplier',
        // Persist the stable supplier id used for the balance decrement so delete can reverse by id
        referenceId: (partyId && (partyType || 'supplier') === 'supplier') ? partyId : undefined,
      }], { session });

      // Update supplier opening balance
      if (partyId && (partyType || 'supplier') === 'supplier') {
        await Supplier.findOneAndUpdate({ _id: partyId, ...baseFilter }, { $inc: { openingBalance: -amount } }, { session });
      }

      // Create journal entry
      try {
        const payableAccount = await Account.findOne({ ...baseFilter, code: '2001' });
        const cashBankCode = paymentMethod === 'cash' ? '1001' : '1002';
        const cashBankAccount = await Account.findOne({ ...baseFilter, code: cashBankCode });
        if (payableAccount && cashBankAccount) {
          const jeLines = [
            { account: payableAccount._id, accountName: payableAccount.name, accountType: payableAccount.type, debit: amount, credit: 0 },
            { account: cashBankAccount._id, accountName: cashBankAccount.name, accountType: cashBankAccount.type, debit: 0, credit: amount },
          ];
          await JournalEntry.create([
            getCreateData(req, {
              entryNumber: `JE-POUT-${created._id}`,
              entryDate: date || new Date(),
              referenceType: 'PaymentOut',
              referenceId: created._id,
              lines: jeLines,
              totalDebit: amount,
              totalCredit: amount,
              narration: `Payment out: ${description || partyName || 'supplier'}`,
              isPosted: true,
              postedAt: new Date(),
            }),
          ], { session });
          const accIds = jeLines.map(l => l.account);
          const accounts = await Account.find({ _id: { $in: accIds }, ...baseFilter });
          const accMap = new Map(accounts.map(a => [a._id.toString(), a]));
          const balanceOps = jeLines.map(line => {
            const acc = accMap.get(line.account.toString());
            if (!acc) return null;
            const change = ['asset', 'expense'].includes(acc.type) ? line.debit - line.credit : line.credit - line.debit;
            return { updateOne: { filter: { _id: line.account, ...baseFilter }, update: { $inc: { balance: change } } } };
          }).filter(Boolean);
          if (balanceOps.length > 0) await Account.bulkWrite(balanceOps, { session });
        }
      } catch (jeErr) {
        console.error('Failed to create journal entry for payment out:', jeErr.message);
        throw jeErr;
      }

      return created;
    });

    // Send WhatsApp payment message to supplier
    sendPaymentMessage(req.user._id, req.businessId, {
      customerName: partyName || 'Supplier',
      supplierName: partyName || 'Supplier',
      customerPhone: '',
      invoiceNumber: reference || payment._id.toString(),
      invoiceId: payment._id,
      totalAmount: amount,
      remainingBalance: 0,
      paymentMode: paymentMethod || 'cash',
      date: date || new Date(),
      // Marks this as an outgoing payment so messageService gates on autoMsgPaymentOut.
      isPaymentOut: true,
    }).catch(() => {});

    createNotification(req.user._id, 'payment_out', 'Payment Sent',
      `Rs.${amount.toFixed(2)} paid to ${partyName || 'supplier'}`,
      payment._id, 'PaymentOut'
    ).catch(() => {});

    // Send email/SMS if supplier info available
    if (partyId) {
      const supplier = await Supplier.findOne({ _id: partyId, ...baseFilter });
      if (supplier) {
        const payMsg = `Payment of Rs.${amount.toFixed(2)} sent to ${partyName || 'supplier'}`;
        if (supplier.email) {
          sendEmailNotification(req.user._id, {
            to: supplier.email,
            subject: `Payment Sent - Rs.${amount.toFixed(2)}`,
            html: `<p>Dear ${partyName || 'Supplier'},</p><p>${payMsg}</p><p>Thank you!</p>`,
          }).catch(() => {});
        }
        if (supplier.phone) {
          sendSMSNotification(req.user._id, {
            to: supplier.phone,
            message: payMsg,
          }).catch(() => {});
        }
      }
    }

    res.status(201).json(payment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Reverses the supplier-balance, journal-entry and account-balance effects of a
// payment-out doc inside the given transaction `session`. Used by both delete and
// update (update reverses the old effects then re-applies the new ones).
const reversePaymentOutEffects = async (payment, baseFilter, session) => {
  // Reverse supplier balance. ALWAYS prefer the stored stable supplier id
  // (referenceId) that create decremented. Only fall back to a name match when
  // NO id is present (legacy docs) — name matching can mis-credit renamed/
  // duplicate suppliers, so it is strictly scoped and logged.
  if (payment.partyType === 'supplier' && payment.referenceId) {
    await Supplier.findOneAndUpdate({ _id: payment.referenceId, ...baseFilter }, { $inc: { openingBalance: payment.amount } }, { session });
  } else if (payment.partyType === 'supplier' && payment.partyName) {
    console.warn(`[paymentOut] Reversing legacy payment ${payment._id} by supplier NAME "${payment.partyName}" (no stored supplier id); scoped by baseFilter.`);
    const supplier = await Supplier.findOne({ ...baseFilter, name: payment.partyName }, null, { session });
    if (supplier) {
      await Supplier.findOneAndUpdate({ _id: supplier._id, ...baseFilter }, { $inc: { openingBalance: payment.amount } }, { session });
    }
  }

  // Reverse journal entry
  try {
    const oldJE = await JournalEntry.findOne({ referenceType: 'PaymentOut', referenceId: payment._id, ...baseFilter }, null, { session });
    if (oldJE) {
      const jeAccIds = oldJE.lines.filter(l => l.account).map(l => l.account);
      const jeAccounts = await Account.find({ _id: { $in: jeAccIds }, ...baseFilter }, null, { session });
      const jeAccMap = new Map(jeAccounts.map(a => [a._id.toString(), a]));
      const reverseOps = oldJE.lines.filter(l => l.account).map(line => {
        const acc = jeAccMap.get(line.account.toString());
        if (!acc) return null;
        const change = ['asset', 'expense'].includes(acc.type) ? -(line.debit - line.credit) : -(line.credit - line.debit);
        return { updateOne: { filter: { _id: line.account, ...baseFilter }, update: { $inc: { balance: change } } } };
      }).filter(Boolean);
      if (reverseOps.length > 0) await Account.bulkWrite(reverseOps, { session });
      await JournalEntry.findOneAndDelete({ _id: oldJE._id, ...baseFilter }, { session });
    }
  } catch (jeErr) {
    console.error('Failed to reverse journal entry for payment out:', jeErr.message);
    throw jeErr;
  }
};

// Applies the supplier-balance, journal-entry and account-balance effects of a
// payment-out inside the given transaction `session`. Mirrors createPaymentOut's
// side-effects so update can re-apply with the new values. Returns the JE (if any).
const applyPaymentOutEffects = async ({ req, baseFilter, transaction, amount, description, date, paymentMethod, partyName, partyId, partyType }, session) => {
  // Update supplier opening balance
  if (partyId && (partyType || 'supplier') === 'supplier') {
    await Supplier.findOneAndUpdate({ _id: partyId, ...baseFilter }, { $inc: { openingBalance: -amount } }, { session });
  }

  // Create journal entry
  const payableAccount = await Account.findOne({ ...baseFilter, code: '2001' }, null, { session });
  const cashBankCode = paymentMethod === 'cash' ? '1001' : '1002';
  const cashBankAccount = await Account.findOne({ ...baseFilter, code: cashBankCode }, null, { session });
  if (payableAccount && cashBankAccount) {
    const jeLines = [
      { account: payableAccount._id, accountName: payableAccount.name, accountType: payableAccount.type, debit: amount, credit: 0 },
      { account: cashBankAccount._id, accountName: cashBankAccount.name, accountType: cashBankAccount.type, debit: 0, credit: amount },
    ];
    await JournalEntry.create([
      getCreateData(req, {
        entryNumber: `JE-POUT-${transaction._id}`,
        entryDate: date || new Date(),
        referenceType: 'PaymentOut',
        referenceId: transaction._id,
        lines: jeLines,
        totalDebit: amount,
        totalCredit: amount,
        narration: `Payment out: ${description || partyName || 'supplier'}`,
        isPosted: true,
        postedAt: new Date(),
      }),
    ], { session });
    const accIds = jeLines.map(l => l.account);
    const accounts = await Account.find({ _id: { $in: accIds }, ...baseFilter }, null, { session });
    const accMap = new Map(accounts.map(a => [a._id.toString(), a]));
    const balanceOps = jeLines.map(line => {
      const acc = accMap.get(line.account.toString());
      if (!acc) return null;
      const change = ['asset', 'expense'].includes(acc.type) ? line.debit - line.credit : line.credit - line.debit;
      return { updateOne: { filter: { _id: line.account, ...baseFilter }, update: { $inc: { balance: change } } } };
    }).filter(Boolean);
    if (balanceOps.length > 0) await Account.bulkWrite(balanceOps, { session });
  }
};

const updatePaymentOut = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const existing = await Transaction.findOne({ _id: req.params.id, ...baseFilter, type: { $in: ['cash_out', 'bank_out'] } });
    if (!existing) return res.status(404).json({ message: 'Payment not found' });

    const { amount, description, date, paymentMethod, partyName, partyType, reference, partyId } = req.body;
    const txnType = paymentMethod === 'cash' ? 'cash_out' : 'bank_out';

    const updated = await withTransaction(async (session) => {
      // 1. Reverse all old effects (supplier balance, JE, account balances).
      await reversePaymentOutEffects(existing, baseFilter, session);

      // 2. Update the transaction document in place with the new values.
      existing.type = txnType;
      existing.amount = amount;
      existing.description = description || 'Payment out';
      existing.date = date || existing.date || new Date();
      existing.reference = reference || '';
      existing.partyName = partyName || '';
      existing.partyType = partyType || 'supplier';
      existing.referenceId = (partyId && (partyType || 'supplier') === 'supplier') ? partyId : undefined;
      await existing.save({ session });

      // 3. Re-apply the new effects mirroring create.
      await applyPaymentOutEffects({
        req, baseFilter, transaction: existing,
        amount, description, date, paymentMethod, partyName, partyId, partyType,
      }, session);

      return existing;
    });

    createNotification(req.user._id, 'payment_out', 'Payment Updated',
      `Payment to ${partyName || 'supplier'} updated to Rs.${Number(amount).toFixed(2)}`,
      updated._id, 'PaymentOut'
    ).catch(() => {});

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deletePaymentOut = async (req, res) => {
  try {
    const baseFilter = getBaseFilter(req);
    const payment = await Transaction.findOne({ _id: req.params.id, ...baseFilter });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    await withTransaction(async (session) => {
      await Transaction.findOneAndDelete({ _id: req.params.id, ...baseFilter }, { session });

      await reversePaymentOutEffects(payment, baseFilter, session);
    });

    createNotification(req.user._id, 'payment_out_deleted', 'Payment Removed',
      `Payment of Rs.${payment.amount.toFixed(2)} to ${payment.partyName || 'supplier'} has been removed`,
      payment._id, 'PaymentOut'
    ).catch(() => {});

    res.json({ message: 'Payment removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getPaymentOuts, createPaymentOut, updatePaymentOut, deletePaymentOut };
