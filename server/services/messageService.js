const Setting = require('../models/Setting');
const WhatsAppMessage = require('../models/WhatsAppMessage');
const { sendMessage, sendDocument, getSession } = require('./whatsappService');

const defaultTemplates = {
  invoice: 'Dear {customer_name},\n\nThank you for your purchase!\n\nInvoice: {invoice_number}\nDate: {date}\nAmount: {currency}{amount}\n{balance_line}\n\nView Invoice: {invoice_link}\n\nRegards,\n{company_name}',
  estimate: 'Dear {customer_name},\n\nHere is your estimate/quotation.\n\nEstimate: {invoice_number}\nDate: {date}\nAmount: {currency}{amount}\n\nRegards,\n{company_name}',
  order: 'Dear {customer_name},\n\nYour order has been confirmed.\n\nOrder: {invoice_number}\nDate: {date}\nAmount: {currency}{amount}\n\nRegards,\n{company_name}',
  proforma: 'Dear {customer_name},\n\nProforma Invoice for your reference.\n\nInvoice: {invoice_number}\nDate: {date}\nAmount: {currency}{amount}\n\nRegards,\n{company_name}',
  challan: 'Dear {customer_name},\n\nDelivery Challan attached.\n\nChallan: {invoice_number}\nDate: {date}\n\nRegards,\n{company_name}',
  credit_note: 'Dear {customer_name},\n\nCredit Note issued.\n\nNote: {invoice_number}\nDate: {date}\nAmount: {currency}{amount}\n\nRegards,\n{company_name}',
  payment_in: 'Dear {customer_name},\n\nPayment received successfully.\n\nAmount: {currency}{amount}\nMode: {payment_mode}\n{balance_line}\n\nThank you!\n{company_name}',
  payment_out: 'Dear {supplier_name},\n\nPayment sent successfully.\n\nAmount: {currency}{amount}\nMode: {payment_mode}\n\n Regards,\n{company_name}',
  cancelled: 'Dear {customer_name},\n\nInvoice {invoice_number} has been cancelled.\n\nRegards,\n{company_name}',
};

const renderTemplate = (template, vars) => {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
  }
  return result;
};

const buildVars = (data, settings) => {
  const bizName = settings?.businessName || 'Your Business';
  const phone = settings?.phone || '';
  const baseUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const currency = settings?.currency || '₹';

  const balanceLine = data.remainingBalance > 0
    ? `Balance: ${currency}${data.remainingBalance.toFixed(2)}`
    : '';

  const invoiceLink = data.invoiceId
    ? `${baseUrl}/sales/view/${data.invoiceId}`
    : '';

  const paymentLink = data.invoiceId
    ? `${baseUrl}/sales/view/${data.invoiceId}?pay=true`
    : '';

  return {
    customer_name: data.customerName || 'Customer',
    supplier_name: data.supplierName || 'Supplier',
    company_name: bizName,
    company_phone: phone,
    invoice_number: data.invoiceNumber || '',
    date: data.date ? new Date(data.date).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN'),
    amount: (data.totalAmount || 0).toFixed(2),
    currency,
    balance: (data.remainingBalance || 0).toFixed(2),
    balance_line: balanceLine,
    payment_mode: data.paymentMode || 'Cash',
    invoice_link: invoiceLink,
    payment_link: paymentLink,
  };
};

const logMessage = async (userId, businessId, data) => {
  try {
    await WhatsAppMessage.create({
      user: userId,
      business: businessId,
      direction: 'outgoing',
      to: data.to,
      from: data.from || '',
      message: data.message,
      type: data.type || 'text',
      status: data.status || 'pending',
      referenceType: data.referenceType,
      referenceId: data.referenceId,
      referenceNumber: data.referenceNumber,
      transactionType: data.transactionType,
      sentAt: data.status === 'sent' ? new Date() : undefined,
    });
  } catch (err) {
    console.error('Failed to log WhatsApp message:', err.message);
  }
};

const shouldSendAutoMessage = (settings, transactionType) => {
  const msgPrefs = settings?.preferences?.transactionMessage;
  if (!msgPrefs) return false;
  if (!msgPrefs.sendViaWhatsApp && !msgPrefs.sendViaVyapar) return false;
  if (!msgPrefs.sendTransactionUpdates) return false;

  const typeMap = {
    'invoice': 'autoMsgSales',
    'quotation': 'autoMsgEstimate',
    'estimate': 'autoMsgEstimate',
    'order': 'autoMsgSaleOrder',
    'proforma': 'autoMsgProforma',
    'challan': 'autoMsgDeliveryChallan',
    'credit_note': 'autoMsgSalesReturn',
    'return': 'autoMsgSalesReturn',
    'purchase': 'autoMsgPurchase',
    'purchase_return': 'autoMsgPurchaseReturn',
    'payment_in': 'autoMsgPaymentIn',
    'payment_out': 'autoMsgPaymentOut',
    'purchase_order': 'autoMsgPurchaseOrder',
    'cancelled': 'autoMsgCancelledInvoice',
  };

  const settingKey = typeMap[transactionType];
  if (settingKey && msgPrefs[settingKey] === false) return false;

  return true;
};

const sendAutoMessage = async (userId, businessId, transactionType, data) => {
  try {
    const settings = await Setting.findOne({ user: userId });
    if (!settings) return;

    if (!shouldSendAutoMessage(settings, transactionType)) return;

    const msgPrefs = settings.preferences?.transactionMessage || {};

    const templateKey = transactionType === 'invoice' ? 'invoice'
      : transactionType === 'credit_note' || transactionType === 'return' ? 'credit_note'
      : transactionType;

    // Template precedence: per-type custom template saved by the Transaction Message tab
    // (preferences.transactionMessage.templates[<type>]) > global messageTemplate override
    // > hardcoded default for the type > generic invoice default.
    const perTypeTemplate = settings.preferences?.transactionMessage?.templates?.[templateKey];
    const globalTemplate = settings.preferences?.transactionMessage?.messageTemplate;
    const template = perTypeTemplate
      || globalTemplate
      || defaultTemplates[templateKey]
      || defaultTemplates.invoice;

    const vars = buildVars(data, settings);
    let messageText = renderTemplate(template, vars);

    const currency = settings?.currency || '₹';

    if (msgPrefs.autoShareInvoices && data.invoiceId) {
      const pdfLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/api/pdf/invoice/${data.invoiceId}`;
      messageText += `\n\nView Invoice: ${pdfLink}`;
    }

    if (msgPrefs.currentBalance !== false && data.remainingBalance !== undefined) {
      messageText += `\nBalance: ${currency}${data.remainingBalance.toFixed(2)}`;
    }

    if (msgPrefs.webInvoiceLink !== false && data.invoiceId) {
      const link = `${process.env.CLIENT_URL || 'http://localhost:3000'}/sales/view/${data.invoiceId}`;
      messageText += `\nView Online: ${link}`;
    }

    if (msgPrefs.paymentLink !== false && data.invoiceId) {
      const payLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/payments/pay/${data.invoiceId}`;
      messageText += `\nPay Now: ${payLink}`;
    }

    const phone = data.customerPhone || data.phone;
    if (!phone) return;

    const sock = getSession(userId);
    if (!sock) return;

    const results = [];

    // Each channel is gated independently. There is no real external Vyapar API, so the
    // "Send via Vyapar" channel is delivered through the same WhatsApp/in-app delivery path
    // as the WhatsApp channel. We deliver at most once per recipient: if either channel is
    // enabled (and the party should be messaged) we send via WhatsApp. Disabling WhatsApp
    // alone (with Vyapar off) genuinely stops the send; both off sends nothing.
    const deliverViaWhatsApp = msgPrefs.sendViaWhatsApp || msgPrefs.sendViaVyapar;

    if (msgPrefs.sendMessageToParty !== false && deliverViaWhatsApp) {
      try {
        const result = await sendMessage(userId, phone, messageText);
        await logMessage(userId, businessId, {
          to: phone,
          message: messageText,
          status: 'sent',
          referenceType: 'Sale',
          referenceId: data.invoiceId,
          referenceNumber: data.invoiceNumber,
          transactionType,
        });
        results.push({ to: phone, status: 'sent' });
      } catch (err) {
        await logMessage(userId, businessId, {
          to: phone,
          message: messageText,
          status: 'failed',
          failReason: err.message,
          referenceType: 'Sale',
          referenceId: data.invoiceId,
          referenceNumber: data.invoiceNumber,
          transactionType,
        });
        results.push({ to: phone, status: 'failed', error: err.message });
      }
    }

    if (msgPrefs.sendCopyToSelf && deliverViaWhatsApp && settings.phone) {
      try {
        await sendMessage(userId, settings.phone, `[Copy] ${messageText}`);
        results.push({ to: settings.phone, status: 'sent', type: 'self_copy' });
      } catch {}
    }

    return results;
  } catch (err) {
    console.error('Auto message send failed:', err.message);
  }
};

const sendPaymentMessage = async (userId, businessId, paymentData) => {
  try {
    const settings = await Setting.findOne({ user: userId });
    if (!settings) return;

    const msgPrefs = settings.preferences?.transactionMessage;
    if (!msgPrefs?.sendViaWhatsApp && !msgPrefs?.sendViaVyapar) return;
    if (!msgPrefs?.sendTransactionUpdates) return;

    // Determine payment direction from the data already passed by callers. messagingTrigger
    // tags outgoing payments with isPaymentOut; the explicit type/direction fields are also
    // honoured. Everything else (e.g. sale payment_in) is treated as an incoming receipt.
    const isPaymentOut = paymentData.isPaymentOut === true
      || paymentData.type === 'payment_out'
      || paymentData.type === 'payment_sent'
      || paymentData.direction === 'out';
    const transactionType = isPaymentOut ? 'payment_out' : 'payment_in';

    // Gate on the per-type auto-message toggle: incoming -> autoMsgPaymentIn,
    // outgoing -> autoMsgPaymentOut. Disabled (=== false) means do not send.
    const autoToggleKey = isPaymentOut ? 'autoMsgPaymentOut' : 'autoMsgPaymentIn';
    if (msgPrefs[autoToggleKey] === false) return;

    // Per-type custom template (templates[<type>]) > global messageTemplate > hardcoded default.
    const template = msgPrefs.templates?.[transactionType]
      || msgPrefs.messageTemplate
      || defaultTemplates[transactionType]
      || defaultTemplates.payment_in;
    const vars = buildVars({
      ...paymentData,
      remainingBalance: paymentData.remainingBalance || 0,
    }, settings);
    let messageText = renderTemplate(template, vars);

    const currency = settings?.currency || '₹';

    if (msgPrefs.autoShareInvoices && paymentData.invoiceId) {
      const pdfLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/api/pdf/invoice/${paymentData.invoiceId}`;
      messageText += `\n\nView Invoice: ${pdfLink}`;
    }

    if (msgPrefs.currentBalance !== false && paymentData.remainingBalance !== undefined) {
      messageText += `\nBalance: ${currency}${paymentData.remainingBalance.toFixed(2)}`;
    }

    if (msgPrefs.webInvoiceLink !== false && paymentData.invoiceId) {
      const link = `${process.env.CLIENT_URL || 'http://localhost:3000'}/sales/view/${paymentData.invoiceId}`;
      messageText += `\nView Online: ${link}`;
    }

    if (msgPrefs.paymentLink !== false && paymentData.invoiceId) {
      const payLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/payments/pay/${paymentData.invoiceId}`;
      messageText += `\nPay Now: ${payLink}`;
    }

    const phone = paymentData.customerPhone || paymentData.phone;
    if (!phone) return;

    const sock = getSession(userId);
    if (!sock) return;

    // Independent channel gating: WhatsApp and Vyapar are gated separately, but since there
    // is no real external Vyapar API the Vyapar channel is delivered through the same WhatsApp
    // path. Deliver once if either channel is enabled; both off sends nothing.
    const deliverViaWhatsApp = msgPrefs.sendViaWhatsApp || msgPrefs.sendViaVyapar;

    if (msgPrefs.sendMessageToParty !== false && deliverViaWhatsApp) {
      try {
        await sendMessage(userId, phone, messageText);
        await logMessage(userId, businessId, {
          to: phone,
          message: messageText,
          status: 'sent',
          referenceType: 'Receipt',
          referenceId: paymentData.receiptId,
          referenceNumber: paymentData.receiptNumber,
          transactionType,
        });
      } catch (err) {
        await logMessage(userId, businessId, {
          to: phone,
          message: messageText,
          status: 'failed',
          failReason: err.message,
          referenceType: 'Receipt',
          referenceId: paymentData.receiptId,
          referenceNumber: paymentData.receiptNumber,
          transactionType,
        });
      }
    }

    if (msgPrefs.sendCopyToSelf && deliverViaWhatsApp && settings.phone) {
      try { await sendMessage(userId, settings.phone, `[Copy] ${messageText}`); } catch {}
    }
  } catch (err) {
    console.error('Payment message send failed:', err.message);
  }
};

const sendManualMessage = async (userId, businessId, phone, message) => {
  const sock = getSession(userId);
  if (!sock) throw new Error('WhatsApp not connected');

  try {
    const result = await sendMessage(userId, phone, message);
    await logMessage(userId, businessId, {
      to: phone,
      message,
      status: 'sent',
      referenceType: 'manual',
      transactionType: 'manual',
    });
    return result;
  } catch (err) {
    await logMessage(userId, businessId, {
      to: phone,
      message,
      status: 'failed',
      failReason: err.message,
      referenceType: 'manual',
      transactionType: 'manual',
    });
    throw err;
  }
};

module.exports = {
  sendAutoMessage,
  sendPaymentMessage,
  sendManualMessage,
  defaultTemplates,
  renderTemplate,
};
