// Bundled MongoDB manager for the desktop app.
//
// Runs the bundled mongod.exe as a SINGLE-NODE REPLICA SET (rs0) so the app's
// transactions keep working, with its data stored in the per-user app-data folder.
// On first launch the replica set is initialized automatically. No system MongoDB
// install is required on the end user's machine.

const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');
const { app } = require('electron');

const MONGO_PORT = 27027;          // dedicated port (avoids clashing with a system MongoDB on 27017)
const REPL_SET = 'rs0';
const DB_NAME = 'vyapar_electron';

// mongodb driver lives in the backend's node_modules — used only to initiate the replica set.
const SERVER_DIR = path.join(__dirname, '..', 'server');
const { MongoClient } = require(path.join(SERVER_DIR, 'node_modules', 'mongodb'));

const MONGODB_URI = `mongodb://127.0.0.1:${MONGO_PORT}/${DB_NAME}?replicaSet=${REPL_SET}`;

let mongoProcess = null;

// Crash supervision (mirrors the backend supervisor in main.js): if mongod dies
// unexpectedly we respawn it so the app self-heals instead of being left with a
// running window talking to a dead database. `isStopping` distinguishes a clean
// shutdown (app quit) from a crash so we don't fight our own stopMongo().
let isStopping = false;
let mongoRestarts = 0;
const MAX_MONGO_RESTARTS = 5;

function mongodPath() {
  // Dev: ./mongodb/bin/mongod.exe. Packaged: provided via env (set in Phase 3).
  return process.env.MONGOD_EXE || path.join(__dirname, '..', 'mongodb', 'bin', 'mongod.exe');
}

function dataDir() {
  return path.join(app.getPath('userData'), 'mongodb-data');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Resolve once the TCP port is accepting connections.
function waitForPort(port, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = net.connect(port, '127.0.0.1');
      socket.on('connect', () => { socket.destroy(); resolve(); });
      socket.on('error', () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) return reject(new Error('mongod did not open port in time'));
        setTimeout(tryConnect, 500);
      });
    };
    tryConnect();
  });
}

// Initialize the replica set on first run, then wait until this node is PRIMARY.
async function ensureReplicaSet() {
  const client = new MongoClient(`mongodb://127.0.0.1:${MONGO_PORT}/?directConnection=true`, {
    serverSelectionTimeoutMS: 3000,
  });
  await client.connect();
  const admin = client.db('admin');
  try {
    await admin.command({ replSetGetStatus: 1 });
    // Already initialized.
  } catch (e) {
    const notInit = e.code === 94 || /no replset config|not yet initialized|NotYetInitialized/i.test(e.message);
    if (!notInit) { await client.close(); throw e; }
    console.log('[mongo] initializing replica set rs0...');
    await admin.command({
      replSetInitiate: { _id: REPL_SET, members: [{ _id: 0, host: `127.0.0.1:${MONGO_PORT}` }] },
    });
  }
  // Wait for PRIMARY (myState === 1).
  for (let i = 0; i < 60; i++) {
    try {
      const status = await admin.command({ replSetGetStatus: 1 });
      if (status.myState === 1) { await client.close(); return; }
    } catch (_) { /* keep waiting */ }
    await sleep(1000);
  }
  await client.close();
  throw new Error('replica set did not reach PRIMARY in time');
}

// Spawn the mongod process and attach the crash-supervision exit handler. The
// replica set is already initialized in the data dir after first run, so a respawn
// just needs the process back up — the backend's mongoose driver auto-reconnects
// (and ensureReplicaSet() is idempotent for the initial startMongo() path).
function spawnMongod(exe, dir, logPath) {
  console.log(`[mongo] starting bundled MongoDB on port ${MONGO_PORT} (data: ${dir})`);
  mongoProcess = spawn(exe, [
    '--dbpath', dir,
    '--port', String(MONGO_PORT),
    '--replSet', REPL_SET,
    '--bind_ip', '127.0.0.1',
    '--logpath', logPath,
    '--logappend',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  mongoProcess.stderr.on('data', (d) => console.error(`[mongod] ${d.toString().trim()}`));
  mongoProcess.on('exit', (code, signal) => {
    console.log(`[mongod] exited (code=${code}, signal=${signal})`);
    mongoProcess = null;
    if (isStopping) return; // clean shutdown via stopMongo()
    if (mongoRestarts >= MAX_MONGO_RESTARTS) {
      console.error(`[mongo] giving up after ${MAX_MONGO_RESTARTS} restarts`);
      return;
    }
    mongoRestarts += 1;
    console.warn(`[mongo] mongod died — restarting (attempt ${mongoRestarts}/${MAX_MONGO_RESTARTS})...`);
    setTimeout(() => { if (!isStopping) spawnMongod(exe, dir, logPath); }, 1000);
  });
}

// Start bundled MongoDB and return the connection URI the backend should use.
async function startMongo() {
  const exe = mongodPath();
  if (!fs.existsSync(exe)) throw new Error(`mongod.exe not found at ${exe}`);

  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  const logPath = path.join(app.getPath('userData'), 'mongod.log');

  isStopping = false;
  spawnMongod(exe, dir, logPath);

  await waitForPort(MONGO_PORT);
  await ensureReplicaSet();
  console.log('[mongo] bundled MongoDB ready');
  return MONGODB_URI;
}

function stopMongo() {
  isStopping = true; // suppress the supervisor so we don't respawn during app quit
  if (mongoProcess && !mongoProcess.killed) {
    console.log('[mongo] stopping bundled MongoDB');
    mongoProcess.kill();
  }
}

module.exports = { startMongo, stopMongo, MONGODB_URI, MONGO_PORT };
