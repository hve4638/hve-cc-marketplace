#!/usr/bin/env node
/**
 * Stop Hook: Force Continue when the last assistant segment ended on a tool_use
 * the harness did not continue. Tracks repeat occurrences per session and
 * applies a soft / hard rate limit to prevent runaway retry loops.
 *
 * State: <projectRoot>/.agent-memory/unexpected-stop/<session_id>.json
 *   { "stops": ["<ISO>", ...] }
 *
 * Decision matrix (only when payload guards pass and an unexpected stop is
 * detected from the transcript tail):
 *   total >= HARD_LIMIT             → pass + additionalContext + stderr; clear state
 *   recent_in_5min >= SOFT_LIMIT    → block with extended alert; append state
 *   otherwise                       → block with base alert; append state
 *
 * Any pass that is not "no state op" (re-entry, missing session, missing
 * transcript) clears the state file. Atomic writes via tmp+rename.
 *
 * Tunables (env):
 *   FRAME_FORCE_CONTINUE_TAIL_LINES  transcript tail lines to scan (default: 50)
 */

import { execSync } from 'node:child_process';
import {
  existsSync, mkdirSync, readFileSync, renameSync, statSync,
  unlinkSync, writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { readStdin } from './lib/stdin.mjs';

const TAIL_LINES_DEFAULT = 50;
const STATE_SUBDIR = '.agent-memory/unexpected-stop';
const SOFT_LIMIT = 5;
const SOFT_WINDOW_MS = 5 * 60 * 1000;
const HARD_LIMIT = 10;

const NOISE_TYPES = new Set([
  'attachment',
  'ai-title',
  'permission-mode',
  'last-prompt',
  'file-history-snapshot',
  'system',
]);

const ALERT_REASON = `[UNEXPECTED STOP ALERT] Turn ended unexpectedly. KEEP GOING if work remains. Otherwise, notify the user that the work is complete.`;

function softLimitNote(recent) {
  return `Repeated unexpected stops (${recent} within 5 minutes). If this looks like a loop, call AskUserQuestion to halt and ask the user before continuing.`;
}

function hardStopNote(total) {
  return `Force-stopped after ${total} consecutive unexpected stops; retry counter cleared.`;
}

function ok() {
  process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }));
}

function getProjectRoot() {
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function statePathFor(sessionId) {
  return join(getProjectRoot(), STATE_SUBDIR, `${sessionId}.json`);
}

function readState(path) {
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.stops) ? { stops: parsed.stops.slice() } : { stops: [] };
  } catch {
    return { stops: [] };
  }
}

function atomicWriteState(path, state) {
  try {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.tmp.${process.pid}.${Date.now()}`;
    writeFileSync(tmp, JSON.stringify(state));
    renameSync(tmp, path);
  } catch { /* fail open: state tracking is best-effort */ }
}

function deleteState(path) {
  try { unlinkSync(path); } catch { /* ENOENT or other: best-effort */ }
}

function tailLines(path, n) {
  try {
    return execSync(`tail -n ${n} ${JSON.stringify(path)}`, {
      encoding: 'utf-8',
      timeout: 1000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return '';
  }
}

function lastSubstantiveEntry(path, n) {
  const lines = tailLines(path, n).split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (!entry?.type || NOISE_TYPES.has(entry.type)) continue;
    if (entry.type === 'user' || entry.type === 'assistant') return entry;
  }
  return null;
}

async function main() {
  const raw = await readStdin(1000);
  let data = {};
  try { data = JSON.parse(raw); } catch { return ok(); }

  // Guards (no state ops)
  if (data?.stop_hook_active) return ok();
  if (data?.hook_event_name !== 'Stop') return ok();
  if (!data?.session_id) return ok();

  const transcriptPath = data?.transcript_path;
  if (!transcriptPath || !existsSync(transcriptPath)) return ok();

  const tailN = parseInt(process.env.FRAME_FORCE_CONTINUE_TAIL_LINES ?? '', 10) || TAIL_LINES_DEFAULT;
  const entry = lastSubstantiveEntry(transcriptPath, tailN);
  const isAbnormal =
    entry?.type === 'assistant' && entry.message?.stop_reason === 'tool_use';

  const statePath = statePathFor(data.session_id);

  if (!isAbnormal) {
    deleteState(statePath);
    return ok();
  }

  const state = readState(statePath);
  state.stops.push(new Date().toISOString());

  const total = state.stops.length;
  const cutoff = Date.now() - SOFT_WINDOW_MS;
  const recent = state.stops.reduce((acc, ts) => {
    const t = Date.parse(ts);
    return Number.isFinite(t) && t >= cutoff ? acc + 1 : acc;
  }, 0);

  if (total >= HARD_LIMIT) {
    deleteState(statePath);
    const note = hardStopNote(total);
    process.stdout.write(JSON.stringify({
      continue: true,
      hookSpecificOutput: { hookEventName: 'Stop', additionalContext: note },
    }));
    process.stderr.write(`[force-continue] ${note}\n`);
    return;
  }

  atomicWriteState(statePath, state);

  let reason = ALERT_REASON;
  if (recent >= SOFT_LIMIT) {
    reason += `\n\n${softLimitNote(recent)}`;
  }
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
}

main().catch(() => ok());
