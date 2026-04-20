#!/usr/bin/env node
/**
 * HUD statusline uninstaller.
 *
 * - Removes ~/.claude/hud/ (wrapper + deps)
 * - Removes `statusLine` and `hveHud` keys from ~/.claude/settings.json
 *   while preserving all other keys
 * - Idempotent; safe to re-run
 *
 * Respects $CLAUDE_CONFIG_DIR. Does NOT touch the plugin cache
 * (managed by Claude Code's `/plugin uninstall`).
 */

import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

function getClaudeConfigDir() {
  const envDir = process.env.CLAUDE_CONFIG_DIR?.trim();
  if (envDir) return envDir.startsWith('~') ? join(homedir(), envDir.slice(1)) : envDir;
  return join(homedir(), '.claude');
}

const configDir = getClaudeConfigDir();
const hudDir = join(configDir, 'hud');
const settingsPath = join(configDir, 'settings.json');

// 1. Remove ~/.claude/hud/ directory (wrapper + lib deps)
if (existsSync(hudDir)) {
  rmSync(hudDir, { recursive: true, force: true });
  console.log(`[HUD] Removed: ${hudDir}`);
} else {
  console.log(`[HUD] Nothing to remove at ${hudDir}`);
}

// 2. Clean settings.json — drop statusLine + hveHud, preserve everything else
if (existsSync(settingsPath)) {
  let settings;
  try {
    settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  } catch (err) {
    console.error(`[HUD] ERROR: ${settingsPath} is not valid JSON: ${err.message}`);
    console.error('[HUD]   Skipping settings.json cleanup. Fix the file and re-run if needed.');
    process.exit(1);
  }

  let changed = false;
  if (Object.prototype.hasOwnProperty.call(settings, 'statusLine')) {
    delete settings.statusLine;
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(settings, 'hveHud')) {
    delete settings.hveHud;
    changed = true;
  }

  if (changed) {
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
    console.log(`[HUD] Cleaned: ${settingsPath}`);
  } else {
    console.log('[HUD] settings.json already clean');
  }
} else {
  console.log(`[HUD] No settings.json at ${settingsPath}`);
}

console.log('');
console.log('[HUD] Uninstall complete. Restart Claude Code to apply.');
