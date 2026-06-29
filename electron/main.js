// Electron main process — wraps the Vyapar MERN app as a desktop window.
//
// Strategy (single-origin): the Express backend (server/server.js) also serves the
// React production build, so the whole app lives on http://127.0.0.1:5001. Electron
// simply launches that backend and loads the URL — no file:// protocol, which means
// BrowserRouter, relative /api calls, and cookies all keep working exactly as on the web.

const { app, BrowserWindow, shell, dialog, Menu, session, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');
const { spawn } = require('child_process');
const { startMongo, stopMongo } = require('./mongo');

const PORT = 5001;
const APP_URL = `http://127.0.0.1:${PORT}`;

// Connection string for the bundled MongoDB, set once it has started.
let mongoUri = null;

// With asar disabled the app tree keeps its dev layout under resources/app, so these
// relative paths resolve correctly both in development and in the packaged app.
const SERVER_DIR = path.join(__dirname, '..', 'server');
const SERVER_ENTRY = path.join(SERVER_DIR, 'server.js');

// Per-install JWT secret: generated once and stored in the user's app-data folder, so we
// never ship a shared secret inside the build. Each installation gets its own unique key.
function getJwtSecret() {
  const keyFile = path.join(app.getPath('userData'), 'jwt-secret.key');
  try {
    if (fs.existsSync(keyFile)) return fs.readFileSync(keyFile, 'utf8').trim();
  } catch (_) {}
  const secret = crypto.randomBytes(48).toString('hex');
  try { fs.writeFileSync(keyFile, secret, { mode: 0o600 }); } catch (_) {}
  return secret;
}

// Cloud API base URL for secure multi-device sync (Option B). This is the ONLY cloud
// setting baked into the build — it is just a public URL (NO database credentials), so
// it is safe to distribute. The desktop talks to this API with the user's login token;
// the database password lives only on the cloud server. An optional `cloud-config.json`
// ({ "apiUrl": "https://..." }) in the user's app-data folder overrides it for testing.
const CLOUD_API_URL_DEFAULT = 'https://vypaar-website.onrender.com';
function getCloudApiUrl() {
  if (process.env.CLOUD_API_URL) return process.env.CLOUD_API_URL;
  const cfgFile = path.join(app.getPath('userData'), 'cloud-config.json');
  try {
    if (fs.existsSync(cfgFile)) {
      const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
      if (cfg && typeof cfg.apiUrl === 'string' && cfg.apiUrl.trim()) return cfg.apiUrl.trim();
    }
  } catch (_) {}
  return CLOUD_API_URL_DEFAULT;
}

let mainWindow = null;
let splashWindow = null;
let backendProcess = null;

// ---- splash + window state --------------------------------------------------

// Small branded window shown immediately at launch while MongoDB + backend boot,
// so the app feels responsive instead of showing nothing for several seconds.
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 380,
    height: 300,
    frame: false,
    resizable: false,
    center: true,
    show: true,
    backgroundColor: '#2563eb',
    webPreferences: { contextIsolation: true },
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
  splashWindow = null;
}

// Remember the window size/position between runs (a real app reopens where you left it).
const WINDOW_STATE_FILE = () => path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  try { return JSON.parse(fs.readFileSync(WINDOW_STATE_FILE(), 'utf8')); } catch (_) { return null; }
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    const bounds = mainWindow.getNormalBounds();
    fs.writeFileSync(WINDOW_STATE_FILE(), JSON.stringify({ ...bounds, maximized: mainWindow.isMaximized() }));
  } catch (_) {}
}

// ---- backend lifecycle ------------------------------------------------------

// Is something already answering on PORT? (e.g. a dev backend you started manually)
function isServerUp() {
  return new Promise((resolve) => {
    const req = http.get(APP_URL, (res) => {
      res.destroy();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Persist all backend output to a file so crashes are diagnosable even if the app exits.
// Stored in per-user app-data (NOT the install folder) so it survives reinstall/update
// and never fails to write on a read-only/protected install location.
const BACKEND_LOG = path.join(app.getPath('userData'), 'electron-backend.log');
let isQuitting = false;
let backendRestarts = 0;
const MAX_RESTARTS = 5;

function logBackend(line) {
  const text = line.toString().trimEnd();
  if (!text) return;
  console.log(`[backend] ${text}`);
  try { require('fs').appendFileSync(BACKEND_LOG, text + '\n'); } catch (_) {}
}

// Launch server.js using Electron's bundled Node (ELECTRON_RUN_AS_NODE) so no separate
// Node install is required on the user's machine once packaged. If the backend dies
// unexpectedly (not during app shutdown), respawn it so the window never ends up talking
// to a dead server — the desktop app should be self-healing.
function startBackend() {
  backendProcess = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: SERVER_DIR,
    // Provide all runtime config via env so the packaged build ships NO secrets (no .env).
    // dotenv won't override env vars that are already set, so these win in dev too.
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(PORT),
      NODE_ENV: 'development', // keep cookies non-Secure so auth works over http://127.0.0.1
      // Writable data root for backups/uploads/exports/WhatsApp sessions. Pointing this at
      // the per-user app-data folder keeps that data OUT of the install dir, so it survives
      // uninstall, reinstall and app updates (see server/config/paths.js).
      DATA_DIR: app.getPath('userData'),
      JWT_SECRET: getJwtSecret(),
      // Secure multi-device sync via the cloud API (Option B). Only a public URL — never
      // database credentials. The desktop syncs through this API with the user's token.
      CLOUD_API_URL: getCloudApiUrl(),
      EXPOSE_DEV_OTP: 'true', // offline desktop: show the OTP on screen (no email/SMS needed)
      ...(mongoUri ? { MONGODB_URI: mongoUri } : {}),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  backendProcess.stdout.on('data', logBackend);
  backendProcess.stderr.on('data', logBackend);
  backendProcess.on('exit', (code, signal) => {
    logBackend(`exited (code=${code}, signal=${signal})`);
    backendProcess = null;
    if (isQuitting) return;
    if (backendRestarts >= MAX_RESTARTS) {
      logBackend(`giving up after ${MAX_RESTARTS} restarts`);
      return;
    }
    backendRestarts += 1;
    logBackend(`restarting backend (attempt ${backendRestarts}/${MAX_RESTARTS})...`);
    setTimeout(() => { if (!isQuitting) startBackend(); }, 1000);
  });
}

// Poll until the backend answers, then resolve. Fails after ~30s.
function waitForServer(timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      if (await isServerUp()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('Backend did not start in time'));
      setTimeout(tick, 500);
    };
    tick();
  });
}

// ---- window -----------------------------------------------------------------

function createWindow() {
  const saved = loadWindowState();
  mainWindow = new BrowserWindow({
    width: saved?.width || 1400,
    height: saved?.height || 900,
    x: saved?.x,
    y: saved?.y,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Enable Chromium's built-in PDF viewer (PDFium) so blob:/file: PDFs render inside
      // <iframe>/<embed> — e.g. the Settings → Print "Live Invoice Preview". Without this
      // Electron disables the PDF plugin and the preview iframe shows up blank.
      plugins: true,
    },
  });

  // Default to maximized for a desktop business app (unless the user resized it before).
  if (!saved) mainWindow.maximize();
  else if (saved.maximized) mainWindow.maximize();

  mainWindow.loadURL(APP_URL);
  mainWindow.once('ready-to-show', () => {
    closeSplash();
    mainWindow.show();
  });

  // Window-open handling:
  //  - Blank/local popups (window.open('', '_blank')) are used by several print/preview
  //    screens — ALLOW them so printing works in the desktop app.
  //  - http(s) and protocol links (wa.me, mailto:, tel:, sms:) open in the user's real apps.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url || url === 'about:blank' || url.startsWith(APP_URL) || url.startsWith('http://127.0.0.1')) {
      return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, width: 900, height: 700 } };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', saveWindowState);
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ---- native PDF printing ----------------------------------------------------

// The web app sends PDF bytes here; we open them in a visible PDF viewer window so the
// user can preview the invoice (scroll/zoom), then print via Ctrl+P or the viewer's print
// button. This is reliable for PDFs (iframe printing is not) and matches a real billing app.
let printSeq = 0;
ipcMain.handle('print-pdf', async (_evt, bytes) => {
  const tmpFile = path.join(app.getPath('temp'), `vyapar-print-${process.pid}-${printSeq++}.pdf`);
  fs.writeFileSync(tmpFile, Buffer.from(bytes));

  const preview = new BrowserWindow({
    width: 820,
    height: 1000,
    title: 'Print Preview — press Ctrl+P to print',
    autoHideMenuBar: true,
    parent: mainWindow || undefined,
    webPreferences: { sandbox: true },
  });
  preview.setMenuBarVisibility(false);

  // Ctrl+P inside the preview opens the native print dialog for this invoice.
  preview.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.control && (input.key || '').toLowerCase() === 'p') {
      preview.webContents.print({ silent: false, printBackground: true });
    }
  });

  preview.on('closed', () => { try { fs.unlinkSync(tmpFile); } catch (_) {} });

  try {
    await preview.loadURL('file://' + tmpFile.replace(/\\/g, '/'));
  } catch (err) {
    console.error('[print] preview failed:', err.message);
  }
  return true;
});

// ---- auto-update ------------------------------------------------------------

// Check GitHub Releases for a newer version, download it in the background, and
// offer to restart-and-install. Fully defensive: any failure (no network, feed
// not configured yet, unsigned-build quirks, module missing) is logged and
// swallowed so the app ALWAYS continues to run normally. Only active in the
// packaged app — never in dev (`electron .`).
function setupAutoUpdate() {
  if (!app.isPackaged) return; // updates only make sense for an installed build
  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (err) {
    logBackend(`[update] electron-updater not available: ${err.message}`);
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = { info: logBackend, warn: logBackend, error: logBackend, debug: () => {} };

  autoUpdater.on('error', (err) => logBackend(`[update] error: ${err == null ? 'unknown' : (err.message || err)}`));
  autoUpdater.on('update-available', (info) => logBackend(`[update] available: ${info && info.version}`));
  autoUpdater.on('update-not-available', () => logBackend('[update] up to date'));
  autoUpdater.on('update-downloaded', async (info) => {
    logBackend(`[update] downloaded: ${info && info.version}`);
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update ready',
      message: `Vyapar ${info && info.version ? info.version : ''} has been downloaded.`,
      detail: 'Restart the application to install the update.',
    });
    if (response === 0) {
      isQuitting = true; // let the backend/mongo tear down cleanly on quit
      autoUpdater.quitAndInstall();
    }
  });

  // Don't block startup; check a few seconds after the window is up.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => logBackend(`[update] check failed: ${err.message}`));
  }, 8000);
}

// ---- app startup ------------------------------------------------------------

// Only one running copy of the desktop app at a time.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    // Clean, app-like UI: no default Electron developer menu (Reload/DevTools/etc).
    Menu.setApplicationMenu(null);

    // Allow camera/microphone for the app's own origin (used by barcode scanning).
    const allowedPermissions = ['media', 'clipboard-read', 'clipboard-sanitized-write', 'fullscreen'];
    session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
      callback(allowedPermissions.includes(permission));
    });
    session.defaultSession.setPermissionCheckHandler((wc, permission) => allowedPermissions.includes(permission));

    // Show the splash immediately so the user gets instant feedback during boot.
    createSplash();

    // 1) Start the bundled MongoDB first — the backend can't run without it.
    try {
      mongoUri = await startMongo();
    } catch (err) {
      console.error('[mongo] failed to start:', err.message);
      closeSplash();
      dialog.showErrorBox(
        'Database failed to start',
        `Vyapar could not start its database engine.\n\n${err.message}`
      );
      app.quit();
      return;
    }

    // 2) Reuse an already-running backend (dev convenience); otherwise start our own.
    if (!(await isServerUp())) startBackend();
    try {
      await waitForServer();
    } catch (err) {
      console.error(err.message);
    }
    createWindow();
    setupAutoUpdate();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Make sure the backend and bundled MongoDB are torn down with the app (and not respawned).
app.on('before-quit', () => {
  isQuitting = true;
  if (backendProcess && !backendProcess.killed) backendProcess.kill();
  stopMongo();
});
