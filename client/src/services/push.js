import { pushNotificationAPI } from './api';

// Converts a base64url-encoded VAPID public key into the Uint8Array form
// expected by PushManager.subscribe({ applicationServerKey }).
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const isPushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// Registers the service worker, requests notification permission, subscribes via
// PushManager using the server's VAPID public key, and persists the subscription.
// Returns the PushSubscription on success, or null if unsupported / denied.
export async function registerPush() {
  if (!isPushSupported()) {
    console.warn('[Push] Push notifications are not supported in this browser');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[Push] Notification permission not granted');
      return null;
    }

    const { data } = await pushNotificationAPI.getVapidPublicKey();
    const publicKey = data?.publicKey;
    if (!publicKey) {
      console.warn('[Push] No VAPID public key available from server');
      return null;
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    // Send the serialized form so the server reliably receives keys.p256dh/auth.
    await pushNotificationAPI.subscribe(subscription.toJSON ? subscription.toJSON() : subscription);
    return subscription;
  } catch (err) {
    console.error('[Push] Failed to register push:', err);
    return null;
  }
}

// Unsubscribes locally and notifies the server.
export async function unregisterPush() {
  if (!isPushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    const subscription = registration && (await registration.pushManager.getSubscription());
    if (subscription) await subscription.unsubscribe();
    await pushNotificationAPI.unsubscribe();
  } catch (err) {
    console.error('[Push] Failed to unregister push:', err);
  }
}

export default registerPush;
