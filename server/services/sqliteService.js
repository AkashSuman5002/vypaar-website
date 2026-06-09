const fs = require('fs');
const path = require('path');

let Database = null;
let initPromise = null;

// Initialize sql.js 1.x asynchronously and cache the Database constructor
const init = async () => {
  try {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs({
      locateFile: (file) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
    });
    Database = SQL.Database;
  } catch (e) {
    Database = null;
  }
};
initPromise = init();

const openDatabase = (dbPath) => {
  if (!Database) return null;
  if (!fs.existsSync(dbPath)) return null;
  try {
    const buffer = fs.readFileSync(dbPath);
    return new Database(buffer);
  } catch {
    return null;
  }
};

const getTables = (sql) => {
  const result = sql.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
  if (result.length > 0) return result[0].values.map(r => r[0]);
  return [];
};

const getRowCounts = (sql, tables) => {
  const counts = {};
  for (const table of tables.slice(0, 30)) {
    try {
      const res = sql.exec(`SELECT COUNT(*) as cnt FROM "${table}";`);
      if (res.length > 0) counts[table] = res[0].values[0][0];
    } catch { /* skip */ }
  }
  return counts;
};

const getSetting = (sql, keyPattern) => {
  try {
    const res = sql.exec(`SELECT value FROM settings WHERE key = '${keyPattern}' OR key LIKE '%${keyPattern}%' LIMIT 1;`);
    if (res.length > 0 && res[0].values.length > 0) return res[0].values[0][0];
  } catch { /* ignore */ }
  return null;
};

const extractRowsAsObjects = (sql, tableName) => {
  try {
    const res = sql.exec(`SELECT * FROM "${tableName}";`);
    if (res.length === 0 || res[0].values.length === 0) return [];
    const columns = res[0].columns;
    return res[0].values.map(row => {
      const obj = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });
  } catch { return []; }
};

const isSqlJsAvailable = () => Database !== null;

const waitForInit = () => initPromise;

module.exports = {
  openDatabase, getTables, getRowCounts, getSetting, extractRowsAsObjects, isSqlJsAvailable, waitForInit,
};
