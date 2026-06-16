const Setting = require('../models/Setting');

const webPush = require('web-push') || null;

const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || '',
  privateKey: process.env.VAPID_PRIVATE_KEY || '',
};

if (webPush && vapidKeys.publicKey && vapidKeys.privateKey) {
  try {
    webPush.setVapidDetails('mailto:admin@vyapar.com', vapidKeys.publicKey, vapidKeys.privateKey);
  } catch (e) {}
}

const subscriptions = new Map();

const saveSubscription = (userId, subscription) => {
  subscriptions.set(userId, subscription);
};

const sendPushNotification = async (userId, { title, body, icon, url }) => {
  try {
    const settings = await Setting.findOne({ user: userId });
    const pushPrefs = settings?.preferences?.notifications?.push;
    if (!pushPrefs?.enabled) return;

    const subscription = subscriptions.get(userId);
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
  });
};

const sendLowStockPush = async (userId, data) => {
  await sendPushNotification(userId, {
    title: 'Low Stock Alert',
    body: `${data.productName} has only ${data.stock} units left`,
    url: `/products`,
  });
};

module.exports = { saveSubscription, sendPushNotification, sendPaymentReceivedPush, sendLowStockPush };
