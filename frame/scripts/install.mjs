#!/usr/bin/env node
/**
 * frame native dependency installer.
 *
 * Installs `@ast-grep/napi` globally via npm so the MCP server bundle
 * (`bridge/mcp-server.cjs`) can resolve it at runtime via the banner's
 * `npm root -g` NODE_PATH extension.
 *
 * Idempotent: skips install when already present.
 */

import { execSync } from 'node:child_process';

const PKG = '@ast-grep/napi';
const VERSION = '0.41.1';
const SPEC = `${PKG}@${VERSION}`;

function log(msg) {
  console.log(`[frame] ${msg}`);
}

function run(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', stdio: 'pipe', ...opts }).trim();
}

function checkNode() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 18) {
    console.error(`[frame] ERROR: Node.js >= 18 required. Found: ${process.version}`);
    process.exit(1);
  }
  log(`Node ${process.version} OK`);
}

function ensureNpm() {
  try {
    const v = run('npm --version');
    log(`npm ${v} OK`);
  } catch {
    console.error('[frame] ERROR: `npm` not found in PATH.');
    console.error('[frame]   Install Node.js (which includes npm) and retry.');
    process.exit(1);
  }
}

function isInstalled() {
  try {
    const globalRoot = run('npm root -g');
    const out = run(`npm ls -g --depth=0 --parseable ${PKG}`, { stdio: ['ignore', 'pipe', 'ignore'] });
    return out.includes(PKG) || out.includes(globalRoot);
  } catch {
    return false;
  }
}

function install() {
  log(`Installing ${SPEC} globally via npm...`);
  try {
    execSync(`npm install -g ${SPEC}`, { stdio: 'inherit' });
    log(`Installed ${SPEC}`);
  } catch (err) {
    console.error('');
    console.error(`[frame] ERROR: Global install failed.`);
    console.error('[frame]   This usually means npm cannot write to its global prefix.');
    console.error('[frame]   Retry with one of:');
    console.error(`[frame]     sudo npm install -g ${SPEC}`);
    console.error(`[frame]     # or configure a user-level npm prefix: https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally`);
    process.exit(1);
  }
}

checkNode();
ensureNpm();

if (isInstalled()) {
  log(`${PKG} already installed — skipping`);
} else {
  install();
}

console.log('');
log('Setup complete. Restart Claude Code to pick up the MCP server.');
