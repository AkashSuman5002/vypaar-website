const https = require('https');
const http = require('http');
const url = require('url');
const Setting = require('../models/Setting');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(options.url);
    const mod = parsedUrl.protocol === 'https:' ? https : http;
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'POST',
      headers: options.headers || {},
    };
    const req = mod.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function sendViaTwilio(prefs, to, message) {
  const { accountSid, authToken, fromNumber } = prefs;
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const postData = new URLSearchParams({ To: to, From: fromNumber, Body: message }).toString();
  const res = await request({
    url: endpoint,
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
    },
  }, postData);
  if (res.status >= 200 && res.status < 300) return true;
  console.error('[SMS] Twilio error:', res.status, res.body);
  return false;
}

async function sendViaTextLocal(prefs, to, message) {
  const { apiKey, senderId } = prefs;
  const postData = new URLSearchParams({
    apiKey,
    sender: senderId,
    numbers: to,
    message,
  }).toString();
  const res = await request({
    url: 'https://api.textlocal.in/send/',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
    },
  }, postData);
  if (res.status === 200 && res.body?.status === 'success') return true;
  console.error('[SMS] TextLocal error:', res.status, res.body);
  return false;
}

async function sendViaMSG91(prefs, to, message) {
  const { apiKey, senderId } = prefs;
  const postData = JSON.stringify({
    sender: senderId,
    route: 'p',
    country: '91',
    sms: [{ message, to: [to.replace(/^\+?91/, '')] }],
  });
  const res = await request({
    url: 'https://api.msg91.com/api/v5/flow',
    method: 'POST',
    headers: {
      authkey: apiKey,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  }, postData);
  if (res.status === 200 && res.body?.type === 'success') return true;
  console.error('[SMS] MSG91 error:', res.status, res.body);
  return false;
}

async function sendViaGeneric(prefs, to, message) {
  const { apiKey, senderId } = prefs;
  const customUrl = prefs.genericUrl || prefs.apiUrl || '';
  if (!customUrl) {
    console.error('[SMS] Generic provider: no URL configured');
    return false;
  }
  const parsedUrl = new URL(customUrl);
  const method = (prefs.httpMethod || 'POST').toUpperCase();
  let headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  if (senderId) headers['X-Sender-Id'] = senderId;
  if (prefs.customHeaders) {
    try { Object.assign(headers, JSON.parse(prefs.customHeaders)); } catch {}
  }
  const body = { to, message, sender: senderId, ...prefs.extraParams };
  const res = await request({ url: customUrl, method, headers }, method === 'GET' ? null : body);
  if (res.status >= 200 && res.status < 300) return true;
  console.error('[SMS] Generic API error:', res.status, res.body);
  return false;
}

const providerMap = {
  twilio: sendViaTwilio,
  textlocal: sendViaTextLocal,
  msg91: sendViaMSG91,
  generic: sendViaGeneric,
};

const sendSMSNotification = async (userId, { to, message }) => {
  try {
    const settings = await Setting.findOne({ user: userId });
    const smsPrefs = settings?.preferences?.notifications?.sms;
    if (!smsPrefs?.enabled) return false;
    if (!to || !message) return false;

    const provider = smsPrefs.provider || 'generic';
    const sendFn = providerMap[provider];
    if (!sendFn) {
      console.error(`[SMS] Unknown provider: ${provider}`);
      return false;
    }

    const result = await sendFn(smsPrefs, to, message);
    if (result) console.log(`[SMS] Sent to ${to} via ${provider}`);
    return result;
  } catch (err) {
    console.error('[SMS] Failed:', err.message);
    return false;
  }
};

const sendPaymentReceivedSMS = async (userId, data) => {
  const settings = await Setting.findOne({ user: userId });
  const bizName = settings?.businessName || 'Your Business';
  const msg = `${bizName}: Payment of \u20B9${data.amount} received for invoice ${data.invoiceNumber}. Balance: \u20B9${data.remainingBalance || 0}. Thank you!`;
  return sendSMSNotification(userId, { to: data.customerPhone, message: msg });
};

const sendLowStockSMS = async (userId, data) => {
  const settings = await Setting.findOne({ user: userId });
  const phone = settings?.phone;
  if (!phone) return false;
  return sendSMSNotification(userId, { to: phone, message: `Low Stock: ${data.productName} - ${data.stock} units remaining (min: ${data.minStock})` });
};

const sendPaymentReminderSMS = async (userId, data) => {
  const settings = await Setting.findOne({ user: userId });
  const bizName = settings?.businessName || 'Your Business';
  const dueDate = data.dueDate ? ` due on ${data.dueDate}` : '';
  const msg = `${bizName}: Reminder - Invoice ${data.invoiceNumber} for \u20B9${data.amount} is overdue${dueDate}. Please pay at your earliest. Thank you!`;
  return sendSMSNotification(userId, { to: data.customerPhone, message: msg });
};

module.exports = { sendSMSNotification, sendPaymentReceivedSMS, sendLowStockSMS, sendPaymentReminderSMS };
