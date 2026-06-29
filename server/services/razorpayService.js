// Razorpay integration — Payment Links flow.
//
// We create a hosted Razorpay Payment Link for an invoice and send the short URL to the
// customer (WhatsApp "Pay Now"). The customer pays via UPI/card/netbanking on Razorpay's
// page. We confirm payment either by a webhook (cloud) or by polling the link status
// (desktop), then mark the invoice paid. Keys are per-business, stored in Settings.
//
// Uses the built-in https module (no extra dependency) so it works under ELECTRON_RUN_AS_NODE.

const https = require('https');
const crypto = require('crypto');

const RZP_HOST = 'api.razorpay.com';

// Minimal HTTPS JSON request with Basic auth. Resolves { status, body }.
function rzpRequest(method, path, keyId, keySecret, payload) {
  return new Promise((resolve, reject) => {
    const data = payload ? JSON.stringify(payload) : null;
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const req = https.request(
      {
        host: RZP_HOST,
        path,
        method,
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let body;
          try { body = raw ? JSON.parse(raw) : {}; } catch { body = { raw }; }
          resolve({ status: res.statusCode, body });
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// Create a Razorpay Payment Link. amountRupees is in ₹ (we convert to paise).
async function createPaymentLink({ keyId, keySecret }, { amountRupees, description, customerName, customerPhone, customerEmail, referenceId, notes }) {
  const amount = Math.round(Number(amountRupees) * 100);
  if (!amount || amount < 100) throw new Error('Amount must be at least ₹1');

  const payload = {
    amount,
    currency: 'INR',
    accept_partial: true,                 // let the customer pay part of the amount (#12)
    first_min_partial_amount: 100,        // minimum ₹1 per partial payment
    description: (description || 'Invoice payment').slice(0, 2048),
    customer: {
      name: customerName || 'Customer',
      ...(customerPhone ? { contact: String(customerPhone) } : {}),
      ...(customerEmail ? { email: customerEmail } : {}),
    },
    notify: { sms: false, email: false }, // we deliver the link ourselves via WhatsApp
    reminder_enable: true,
    ...(referenceId ? { reference_id: String(referenceId).slice(0, 40) } : {}),
    ...(notes ? { notes } : {}),
  };

  const { status, body } = await rzpRequest('POST', '/v1/payment_links', keyId, keySecret, payload);
  if (status >= 400) {
    const msg = body?.error?.description || body?.message || `Razorpay error (${status})`;
    throw new Error(msg);
  }
  return body; // { id, short_url, status, ... }
}

// Fetch a payment link's current status (used by the desktop reconciliation poller).
async function fetchPaymentLink({ keyId, keySecret }, linkId) {
  const { status, body } = await rzpRequest('GET', `/v1/payment_links/${linkId}`, keyId, keySecret);
  if (status >= 400) {
    const msg = body?.error?.description || body?.message || `Razorpay error (${status})`;
    throw new Error(msg);
  }
  return body; // { id, status: 'created'|'paid'|'cancelled'|'expired', amount_paid, ... }
}

// Refund a captured payment (full or partial). amountRupees omitted = full refund.
async function refundPayment({ keyId, keySecret }, paymentId, amountRupees) {
  if (!paymentId) throw new Error('No captured payment found to refund');
  const payload = amountRupees ? { amount: Math.round(Number(amountRupees) * 100) } : {};
  const { status, body } = await rzpRequest('POST', `/v1/payments/${paymentId}/refund`, keyId, keySecret, payload);
  if (status >= 400) {
    const msg = body?.error?.description || body?.message || `Razorpay refund error (${status})`;
    throw new Error(msg);
  }
  return body; // { id: 'rfnd_...', amount, status, payment_id, ... }
}

// Verify a Razorpay webhook signature (HMAC-SHA256 of the raw body with the webhook secret).
function verifyWebhookSignature(rawBody, signature, webhookSecret) {
  if (!signature || !webhookSecret) return false;
  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch { return false; }
}

// Quick credential check — list 1 payment link. Returns true if keys are valid.
async function verifyKeys({ keyId, keySecret }) {
  const { status } = await rzpRequest('GET', '/v1/payment_links?count=1', keyId, keySecret);
  return status < 400;
}

module.exports = { createPaymentLink, fetchPaymentLink, refundPayment, verifyWebhookSignature, verifyKeys };
