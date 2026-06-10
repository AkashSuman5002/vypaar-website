const pino = require('pino');
const path = require('path');
const fs = require('fs');
const WhatsAppSession = require('../models/WhatsAppSession');

const sessions = new Map();
const qrCallbacks = new Map();
const statusCallbacks = new Map();

const logger = pino({ level: 'silent' });

let baileys = null;
const loadBaileys = async () => {
  if (!baileys) {
    baileys = await import('@whiskeysockets/baileys');
  }
  return baileys;
};

const getSessionDir = (userId) => {
  const dir = path.join(__dirname, '..', 'whatsapp-sessions', String(userId));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const startSession = async (userId, onQR, onStatus) => {
  const uid = String(userId);

  if (sessions.has(uid)) {
    const existing = sessions.get(uid);
    if (existing) {
      try {
        if (existing.ws && existing.ws.readyState === 1) {
          return { status: 'already_connected' };
        }
      } catch {}
      // Stale socket — clean it up
      try { existing.end(); } catch {}
      sessions.delete(uid);
    }
  }

  qrCallbacks.set(uid, onQR);
  statusCallbacks.set(uid, onStatus);

  await WhatsAppSession.findOneAndUpdate(
    { user: uid },
    { status: 'qr_pending', qrCode: '', failReason: '', sessionData: null },
    { upsert: true }
  );

  console.log(`[WhatsApp] Starting session for user ${uid}`);

  try {
    const BA = await loadBaileys();
    const sessionDir = getSessionDir(uid);
    const { state, saveCreds } = await BA.useMultiFileAuthState(sessionDir);
    const { version } = await BA.fetchLatestBaileysVersion();

    console.log(`[WhatsApp] Baileys version: ${version.join('.')}, session dir: ${sessionDir}`);

    const sock = BA.makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: BA.makeCacheableSignalKeyStore(state.keys, logger),
      },
      printQRInTerminal: false,
      logger,
      browser: ['Vyapar Business', 'Chrome', '4.0.0'],
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log(`[WhatsApp] QR received for user ${uid}`);
        await WhatsAppSession.findOneAndUpdate(
          { user: uid },
          { status: 'qr_pending', qrCode: qr },
          { upsert: true }
        );
        const cb = qrCallbacks.get(uid);
        if (cb) cb(qr);
      }

      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = reason !== BA.DisconnectReason.loggedOut;
        console.log(`[WhatsApp] Connection closed for user ${uid}, reason: ${reason}, reconnect: ${shouldReconnect}`);

        await WhatsAppSession.findOneAndUpdate(
          { user: uid },
          { status: 'disconnected', lastDisconnected: new Date(), failReason: String(reason || '') }
        );

        sessions.delete(uid);
        const cb = statusCallbacks.get(uid);
        if (cb) cb('disconnected');

        if (shouldReconnect) {
          setTimeout(() => startSession(uid, onQR, onStatus), 3000);
        } else {
          qrCallbacks.delete(uid);
          statusCallbacks.delete(uid);
          const dir = getSessionDir(uid);
          try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
        }
      }

      if (connection === 'open') {
        const phone = sock.user?.id?.replace(/:.*@/, '@')?.split('@')[0] || '';
        const name = sock.user?.name || '';
        console.log(`[WhatsApp] Connected for user ${uid}, phone: ${phone}`);
        await WhatsAppSession.findOneAndUpdate(
          { user: uid },
          { status: 'connected', qrCode: '', phoneNumber: phone, name, lastConnected: new Date(), sessionData: null }
        );
        const cb = statusCallbacks.get(uid);
        if (cb) cb('connected');
      }
    });

    sessions.set(uid, sock);
    return { status: 'started' };
  } catch (err) {
    console.error(`[WhatsApp] Session start error for user ${uid}:`, err.message);
    await WhatsAppSession.findOneAndUpdate(
      { user: uid },
      { status: 'failed', failReason: err.message }
    ).catch(() => {});
    throw err;
  }
};

const getSession = (userId) => sessions.get(String(userId)) || null;

const sendMessage = async (userId, phone, text) => {
  const sock = sessions.get(String(userId));
  if (!sock) throw new Error('WhatsApp not connected');

  let jid = phone.replace(/[^0-9]/g, '');
  if (!jid.endsWith('@s.whatsapp.net')) {
    jid = jid + '@s.whatsapp.net';
  }

  const result = await sock.sendMessage(jid, { text });
  return result;
};

const sendDocument = async (userId, phone, buffer, fileName, mimetype, caption) => {
  const sock = sessions.get(String(userId));
  if (!sock) throw new Error('WhatsApp not connected');

  let jid = phone.replace(/[^0-9]/g, '');
  if (!jid.endsWith('@s.whatsapp.net')) {
    jid = jid + '@s.whatsapp.net';
  }

  const result = await sock.sendMessage(jid, {
    document: buffer,
    fileName,
    mimetype,
    caption: caption || '',
  });
  return result;
};

const disconnectSession = async (userId) => {
  const uid = String(userId);
  const sock = sessions.get(uid);
  if (sock) {
    try { sock.end(); } catch {}
    sessions.delete(uid);
  }
  qrCallbacks.delete(uid);
  statusCallbacks.delete(uid);

  await WhatsAppSession.findOneAndUpdate(
    { user: uid },
    { status: 'disconnected', lastDisconnected: new Date() }
  );

  const sessionDir = getSessionDir(uid);
  try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch {}

  return { status: 'disconnected' };
};

const getConnectionStatus = async (userId) => {
  const uid = String(userId);
  const session = await WhatsAppSession.findOne({ user: uid });
  const sock = sessions.get(uid);
  return {
    connected: !!(sock && sock.user),
    status: session?.status || 'disconnected',
    phoneNumber: session?.phoneNumber || '',
    name: session?.name || '',
    lastConnected: session?.lastConnected,
  };
};

module.exports = {
  startSession, getSession, sendMessage, sendDocument,
  disconnectSession, getConnectionStatus, sessions,
};
