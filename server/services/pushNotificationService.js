const Setting = require('../models/Setting');
const PushSubscription = require('../models/PushSubscription');

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
    console.warn('[Push] WARNING: VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY are not set in the environment. ' +
      'Generated an EPHEMERAL VAPID keypair for development only. This keypair is regenerated on every ' +
      'restart, which permanently invalidates all existing push subscriptions. ' +
      'Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in your environment for production.');
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

// Maps a canonical notification event type to its per-event preference key
// under preferences.notifications.push.* (see models/Setting.js).
const PUSH_EVENT_PREF_KEY = {
  new_sale: 'newSale',
  new_purchase: 'newPurchase',
  payment_received: 'paymentReceived',
  low_stock: 'lowStock',
};

// Persist a subscription to the database (survives restarts). A device is
// keyed by its endpoint; upsert so re-subscribing the same browser updates the
// keys/owner instead of creating duplicates.
const saveSubscription = async (userId, subscription) => {
  if (!subscription || !subscription.endpoint) return;
  await PushSubscription.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    {
      user: userId,
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys?.p256dh || '',
        auth: subscription.keys?.auth || '',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const removeSubscription = async (userId, endpoint) => {
  // If an endpoint is provided remove just that device; otherwise remove all of
  // the user's subscriptions (e.g. on a full unsubscribe).
  if (endpoint) {
    await PushSubscription.deleteOne({ endpoint });
  } else {
    await PushSubscription.deleteMany({ user: userId });
  }
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

    const subs = await PushSubscription.find({ user: userId });
    if (!subs.length) {
      console.log('[Push] No subscription found for user');
      return;
    }

    if (!webPush || !vapidKeys.publicKey) {
      console.log(`[Push] Would send: ${title} - ${body}`);
      return;
    }

    const payload = JSON.stringify({
      title, body, icon: icon || '/logo192.png',
      data: { url: url || '/' },
    });

    await Promise.all(subs.map(async (sub) => {
      const subscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.keys?.p256dh, auth: sub.keys?.auth },
      };
      try {
        await webPush.sendNotification(subscription, payload);
        console.log(`[Push] Sent to user ${userId}: ${title}`);
      } catch (err) {
        // 404/410 mean the subscription is gone — purge it so we stop retrying.
        if (err.statusCode === 404 || err.statusCode === 410) {
          await PushSubscription.deleteOne({ endpoint: sub.endpoint }).catch(() => {});
          console.log('[Push] Removed expired subscription');
        } else {
          console.error('[Push] Send failed:', err.message);
        }
      }
    }));
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
