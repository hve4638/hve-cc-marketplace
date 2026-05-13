import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = join(__dirname, '..', 'stop-force-continue.mjs');
const FIXTURES_DIR = join(__dirname, 'fixtures');

function runHook(transcriptPath, sessionId) {
  const tmpDir = mkdtempSync(join(tmpdir(), 'stop-test-'));
  const payload = JSON.stringify({
    hook_event_name: 'Stop',
    session_id: sessionId,
    transcript_path: transcriptPath,
    cwd: tmpDir,
    stop_hook_active: false,
  });

  return new Promise((resolve, reject) => {
    const child = spawn('node', [SCRIPT_PATH], {
      env: { ...process.env, CLAUDE_PROJECT_DIR: tmpDir },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => { stdout += c.toString(); });
    child.stderr.on('data', (c) => { stderr += c.toString(); });
    child.on('error', (err) => {
      rmSync(tmpDir, { recursive: true, force: true });
      reject(err);
    });
    child.on('close', (code) => {
      rmSync(tmpDir, { recursive: true, force: true });
      resolve({ stdout, stderr, code });
    });

    child.stdin.write(payload);
    child.stdin.end();
  });
}

test('abnormal-tool-result-stop blocks with alert', async () => {
  const fixture = join(FIXTURES_DIR, 'abnormal-tool-result-stop.jsonl');
  const { stdout } = await runHook(fixture, `test-${Date.now()}-1`);
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.decision, 'block');
  assert.ok(
    parsed.reason?.startsWith('[UNEXPECTED STOP ALERT]'),
    `reason should start with alert prefix, got: ${parsed.reason}`,
  );
});

test('abnormal-assistant-tool-use blocks with alert', async () => {
  const fixture = join(FIXTURES_DIR, 'abnormal-assistant-tool-use.jsonl');
  const { stdout } = await runHook(fixture, `test-${Date.now()}-2`);
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.decision, 'block');
  assert.ok(
    parsed.reason?.startsWith('[UNEXPECTED STOP ALERT]'),
    `reason should start with alert prefix, got: ${parsed.reason}`,
  );
});

test('normal-end-turn passes through', async () => {
  const fixture = join(FIXTURES_DIR, 'normal-end-turn.jsonl');
  const { stdout } = await runHook(fixture, `test-${Date.now()}-3`);
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.continue, true);
  assert.equal(parsed.suppressOutput, true);
  assert.equal(parsed.decision, undefined);
});
