const Setting = require('../models/Setting');

const webPush = require('web-push') || null;

const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || '',
  privateKey: process.env.VAPID_PRIVATE_KEY || '',
};

// If keys aren't supplied via env, generate an ephemeral keypair ONCE at startup
// and cache it in-module so setVapidDetails succeeds and push actually sends.
// (Single-instance only; regenerated on restart, which invalidates old subscriptions.)
if (webPush && (!vapidKeys.publicKey || !vapidKeys.privateKey)) {
  try {
    const generated = webPush.generateVAPIDKeys();
    vapidKeys.publicKey = generated.publicKey;
    vapidKeys.privateKey = generated.privateKey;
    console.log('[Push] Generated ephemeral VAPID keypair (set VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY to persist across restarts)');
  } catch (e) {
    console.error('[Push] Failed to generate VAPID keys:', e.message);
  }
}

if (webPush && vapidKeys.publicKey && vapidKeys.privateKey) {
  try {
    webPush.setVapidDetails('mailto:admin@vyapar.com', vapidKeys.publicKey, vapidKeys.privateKey);
    console.log(`[Push] VAPID public key: ${vapidKeys.publicKey}`);
  } catch (e) {
    console.error('[Push] setVapidDetails failed:', e.message);
  }
}

const getVapidPublicKey = () => vapidKeys.publicKey;

const subscriptions = new Map();

// Maps a canonical notification event type to its per-event preference key
// under preferences.notifications.push.* (see models/Setting.js).
const PUSH_EVENT_PREF_KEY = {
  new_sale: 'newSale',
  new_purchase: 'newPurchase',
  payment_received: 'paymentReceived',
  low_stock: 'lowStock',
};

const saveSubscription = (userId, subscription) => {
  subscriptions.set(String(userId), subscription);
};

const removeSubscription = (userId) => {
  subscriptions.delete(String(userId));
};

const sendPushNotification = async (userId, { title, body, icon, url }, eventType) => {
  try {
    const settings = await Setting.findOne({ user: userId });
    const pushPrefs = settings?.preferences?.notifications?.push;
    if (!pushPrefs?.enabled) return;

    // Per-event gating: if a specific toggle exists for this event and is
    // disabled, suppress. Undefined keys default to enabled (no suppression).
    const eventKey = eventType && PUSH_EVENT_PREF_KEY[eventType];
    if (eventKey && pushPrefs[eventKey] === false) return;

    const subscription = subscriptions.get(String(userId));
    if (!subscription) {
      console.log('[Push] No subscription found for user');
      return;
    }

    if (!webPush || !vapidKeys.publicKey) {
      console.log(`[Push] Would send: ${title} - ${body}`);
      return;
    }

    await webPush.sendNotification(subscription, JSON.stringify({
      title, body, icon: icon || '/logo192.png',
      data: { url: url || '/' },
    }));
    console.log(`[Push] Sent to user ${userId}: ${title}`);
  } catch (err) {
    console.error('[Push] Failed:', err.message);
  }
};

const sendPaymentReceivedPush = async (userId, data) => {
  await sendPushNotification(userId, {
    title: 'Payment Received',
    body: `₹${data.amount} received from ${data.customerName} for invoice ${data.invoiceNumber}`,
    url: `/sales/payments`,
  }, 'payment_received');
};

const sendLowStockPush = async (userId, data) => {
  await sendPushNotification(userId, {
    title: 'Low Stock Alert',
    body: `${data.productName} has only ${data.stock} units left`,
    url: `/products`,
  }, 'low_stock');
};

module.exports = { saveSubscription, removeSubscription, getVapidPublicKey, sendPushNotification, sendPaymentReceivedPush, sendLowStockPush };
