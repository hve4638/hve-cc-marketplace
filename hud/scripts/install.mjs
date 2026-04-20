#!/usr/bin/env node
/**
 * HUD statusline installer.
 *
 * - Copies wrapper to ~/.claude/hud/hud.mjs (+ lib/config-dir.mjs dep)
 * - Adds statusLine to ~/.claude/settings.json
 * - Idempotent; safe to re-run after plugin updates
 *
 * Respects $CLAUDE_CONFIG_DIR.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

// This script lives at <plugin>/scripts/install.mjs
const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function getClaudeConfigDir() {
  const envDir = process.env.CLAUDE_CONFIG_DIR?.trim();
  if (envDir) return envDir.startsWith('~') ? join(homedir(), envDir.slice(1)) : envDir;
  return join(homedir(), '.claude');
}

const configDir = getClaudeConfigDir();
const hudDir = join(configDir, 'hud');
const hudLibDir = join(hudDir, 'lib');
const wrapperSrc = join(PLUGIN_ROOT, 'scripts', 'lib', 'hud-wrapper-template.txt');
const libDepSrc = join(PLUGIN_ROOT, 'scripts', 'lib', 'config-dir.mjs');
const wrapperDest = join(hudDir, 'hud.mjs');
const libDepDest = join(hudLibDir, 'config-dir.mjs');
const settingsPath = join(configDir, 'settings.json');

// 1. Copy wrapper + dependency
mkdirSync(hudLibDir, { recursive: true });
for (const [src, dest] of [[wrapperSrc, wrapperDest], [libDepSrc, libDepDest]]) {
  if (!existsSync(src)) {
    console.error(`[HUD] ERROR: missing source file ${src}`);
    process.exit(1);
  }
  copyFileSync(src, dest);
}
if (process.platform !== 'win32') {
  try { chmodSync(wrapperDest, 0o755); } catch { /* best-effort */ }
}
console.log(`[HUD] Wrapper installed: ${wrapperDest}`);

// 2. Compose statusLine command (shell-expandable on Unix; absolute on Windows)
const statusLineCommand = process.platform === 'win32'
  ? `node ${wrapperDest.split(sep).join('/')}`
  : 'node ${CLAUDE_CONFIG_DIR:-$HOME/.claude}/hud/hud.mjs';

// 3. Merge into settings.json, preserving other keys
let settings = {};
if (existsSync(settingsPath)) {
  try { settings = JSON.parse(readFileSync(settingsPath, 'utf8')); }
  catch (err) {
    console.error(`[HUD] ERROR: ${settingsPath} is not valid JSON: ${err.message}`);
    process.exit(1);
  }
}
settings.statusLine = { type: 'command', command: statusLineCommand };
mkdirSync(dirname(settingsPath), { recursive: true });
writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
console.log(`[HUD] statusLine configured: ${settingsPath}`);

console.log('');
console.log('[HUD] Installation complete. Restart Claude Code to activate.');
