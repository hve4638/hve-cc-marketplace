#!/usr/bin/env node
/**
 * core native dependency installer.
 *
 * Installs `@ast-grep/napi` globally via npm so the MCP server bundle
 * (`bridge/mcp-server.cjs`) can resolve it at runtime via the banner's
 * `npm root -g` NODE_PATH extension.
 *
 * Idempotent: skips install when already present.
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const PKG = '@ast-grep/napi';
const VERSION = '0.41.1';
const SPEC = `${PKG}@${VERSION}`;
const TEAMS_ENV_KEY = 'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS';

function log(msg) {
  console.log(`[core] ${msg}`);
}

function run(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', stdio: 'pipe', ...opts }).trim();
}

function checkNode() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 18) {
    console.error(`[core] ERROR: Node.js >= 18 required. Found: ${process.version}`);
    process.exit(1);
  }
  log(`Node ${process.version} OK`);
}

function ensureNpm() {
  try {
    const v = run('npm --version');
    log(`npm ${v} OK`);
  } catch {
    console.error('[core] ERROR: `npm` not found in PATH.');
    console.error('[core]   Install Node.js (which includes npm) and retry.');
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
    console.error(`[core] ERROR: Global install failed.`);
    console.error('[core]   This usually means npm cannot write to its global prefix.');
    console.error('[core]   Retry with one of:');
    console.error(`[core]     sudo npm install -g ${SPEC}`);
    console.error(`[core]     # or configure a user-level npm prefix: https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally`);
    process.exit(1);
  }
}

function settingsPath() {
  const dir = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
  return join(dir, 'settings.json');
}

function enableAgentTeams() {
  const path = settingsPath();

  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({ env: { [TEAMS_ENV_KEY]: '1' } }, null, 2) + '\n');
    log(`agent teams: enabled (created ${path})`);
    return;
  }

  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    console.error(`[core] WARN: Could not parse ${path}: ${err.message}`);
    console.error('[core]   Skipping agent teams enablement. Add manually:');
    console.error(`[core]     { "env": { "${TEAMS_ENV_KEY}": "1" } }`);
    return;
  }

  if (data && data.env && data.env[TEAMS_ENV_KEY] === '1') {
    log('agent teams: already enabled');
    return;
  }

  data.env = { ...(data.env || {}), [TEAMS_ENV_KEY]: '1' };
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  log(`agent teams: enabled (${path})`);
}

checkNode();
ensureNpm();

if (isInstalled()) {
  log(`${PKG} already installed — skipping`);
} else {
  install();
}

enableAgentTeams();

console.log('');
log('Setup complete. Restart Claude Code to pick up the MCP server.');
