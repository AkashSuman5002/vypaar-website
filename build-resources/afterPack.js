// electron-builder afterPack hook — protects the shipped source code.
//
// WHY: the app ships with `asar: false`, and the backend is launched as a SEPARATE
// Node process (ELECTRON_RUN_AS_NODE) that reads its files as real files — so the
// server's .js files would otherwise be fully readable by anyone who installs the app.
// asar can't protect them (a spawned plain-Node process can't read inside an asar
// archive). So instead we OBFUSCATE the shipped copy here: the code still runs, but is
// turned into unreadable gibberish. This touches ONLY the packaged output under
// resources/app — your real source tree is never modified.
//
// SAFETY: settings are deliberately conservative so behaviour is identical:
//   - renameGlobals:false      -> never rename require/module.exports/globals (keeps modules working)
//   - transformObjectKeys:false -> keep object keys intact (Mongoose schema fields, config keys)
//   - controlFlowFlattening/selfDefending OFF -> avoid runtime breakage & slowdowns
// Only local identifiers are renamed and string literals are hidden in an encoded array;
// the string VALUES (e.g. require paths) are preserved, so dynamic requires still resolve.

const fs = require('fs');
const path = require('path');

const OBFUSCATOR_OPTIONS = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  identifierNamesGenerator: 'hexadecimal',
  numbersToExpressions: false,
  renameGlobals: false,
  selfDefending: false,
  simplify: true,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
};

// Directories (relative to resources/app) whose .js files we obfuscate. We deliberately
// SKIP node_modules (third-party, huge, and obfuscating it risks breaking native/edge cases)
// and non-shipped/dev folders.
const INCLUDE_ROOTS = ['server', 'electron'];
const SKIP_DIR_NAMES = new Set(['node_modules', 'tests', 'test', 'coverage', '.history', 'backups', 'uploads', 'exports', 'whatsapp-sessions']);

function collectJsFiles(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIR_NAMES.has(e.name)) continue;
      collectJsFiles(full, out);
    } else if (e.isFile() && e.name.endsWith('.js')) {
      out.push(full);
    }
  }
}

exports.default = async function afterPack(context) {
  // Only obfuscate real desktop builds (skip the unsigned/dev quick runs if ever hooked).
  const JavaScriptObfuscator = require('javascript-obfuscator');
  const appDir = path.join(context.appOutDir, 'resources', 'app');

  if (!fs.existsSync(appDir)) {
    console.log('[obfuscate] resources/app not found (asar build?) — skipping');
    return;
  }

  const files = [];
  for (const root of INCLUDE_ROOTS) {
    collectJsFiles(path.join(appDir, root), files);
  }

  let ok = 0, failed = 0;
  for (const file of files) {
    try {
      const code = fs.readFileSync(file, 'utf8');
      const result = JavaScriptObfuscator.obfuscate(code, OBFUSCATOR_OPTIONS).getObfuscatedCode();
      fs.writeFileSync(file, result, 'utf8');
      ok++;
    } catch (err) {
      // Never fail the whole build over one file — keep the original and report it.
      failed++;
      console.warn(`[obfuscate] SKIPPED (kept original): ${path.relative(appDir, file)} — ${err.message}`);
    }
  }
  console.log(`[obfuscate] done — ${ok} files protected, ${failed} skipped`);
};
