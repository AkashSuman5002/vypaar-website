const nodemailer = require('nodemailer');
const Setting = require('../models/Setting');

let transporter = null;

const initEmailTransport = async (userId) => {
  const settings = await Setting.findOne({ user: userId });
  const emailPrefs = settings?.preferences?.notifications?.email || {};
  if (!emailPrefs.smtpHost || !emailPrefs.smtpUser) return null;

  transporter = nodemailer.createTransport({
    host: emailPrefs.smtpHost,
    port: parseInt(emailPrefs.smtpPort) || 587,
    secure: emailPrefs.smtpSecure || false,
    auth: { user: emailPrefs.smtpUser, pass: emailPrefs.smtpPass },
  });
  return transporter;
};

const sendEmailNotification = async (userId, { to, subject, html, text }) => {
  try {
    const settings = await Setting.findOne({ user: userId });
    const emailPrefs = settings?.preferences?.notifications?.email;
    if (!emailPrefs?.enabled) return;

    if (!transporter) {
      await initEmailTransport(userId);
    }
    if (!transporter) {
      console.log('[Email] SMTP not configured, skipping email notification');
      return;
    }

    const from = emailPrefs.fromEmail || emailPrefs.smtpUser;
    await transporter.sendMail({ from, to, subject, html: html || text, text });
    console.log(`[Email] Sent to ${to}: ${subject}`);
  } catch (err) {
    console.error('[Email] Failed:', err.message);
  }
};

const sendPaymentReceivedEmail = async (userId, data) => {
  const settings = await Setting.findOne({ user: userId });
  const bizName = settings?.businessName || 'Your Business';
  await sendEmailNotification(userId, {
    to: data.customerEmail,
    subject: `Payment Received - ${bizName}`,
    html: `<h2>Payment Received</h2><p>Dear ${data.customerName},</p><p>We have received your payment of ₹${data.amount}.</p><p>Invoice: ${data.invoiceNumber}</p><p>Balance: ₹${data.remainingBalance || 0}</p><p>Thank you,<br/>${bizName}</p>`,
  });
};

const sendLowStockEmail = async (userId, data) => {
  const settings = await Setting.findOne({ user: userId });
  const email = settings?.email;
  if (!email) return;
  await sendEmailNotification(userId, {
    to: email,
    subject: `Low Stock Alert - ${data.productName}`,
    html: `<h2>Low Stock Alert</h2><p>Product: ${data.productName}</p><p>Current Stock: ${data.stock}</p><p>Minimum Stock: ${data.minStock}</p>`,
  });
};

module.exports = { sendEmailNotification, sendPaymentReceivedEmail, sendLowStockEmail };
