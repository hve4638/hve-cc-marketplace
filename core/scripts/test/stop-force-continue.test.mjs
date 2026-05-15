import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = join(__dirname, '..', 'stop-force-continue.mjs');
const FIXTURES_DIR = join(__dirname, 'fixtures');

// WHY: 픽스처는 정적이라 timestamp 가 박혀 있고, 새 race-guard 가 가까운
//      과거만 abnormal 로 본다. 테스트 시점에 tool_result timestamp 를
//      덮어써서 의도한 gap 을 만든다.
function materializeFixture(fixturePath, { toolResultTimestamp, outDir }) {
  const raw = readFileSync(fixturePath, 'utf-8');
  const lines = raw.split('\n').map((line) => {
    if (!line) return line;
    let entry;
    try { entry = JSON.parse(line); } catch { return line; }
    const hasToolResult = entry?.type === 'user'
      && Array.isArray(entry.message?.content)
      && entry.message.content.some((c) => c?.type === 'tool_result');
    if (!hasToolResult) return line;
    entry.timestamp = toolResultTimestamp;
    return JSON.stringify(entry);
  });
  const outPath = join(outDir, 'fixture.jsonl');
  writeFileSync(outPath, lines.join('\n'));
  return outPath;
}

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

function withTmpDir(fn) {
  const tmpDir = mkdtempSync(join(tmpdir(), 'stop-fixture-'));
  return Promise.resolve(fn(tmpDir)).finally(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });
}

test('abnormal-tool-result-stop blocks with alert', async () => {
  await withTmpDir(async (tmpDir) => {
    const fixture = materializeFixture(
      join(FIXTURES_DIR, 'abnormal-tool-result-stop.jsonl'),
      { toolResultTimestamp: new Date().toISOString(), outDir: tmpDir },
    );
    const { stdout } = await runHook(fixture, `test-${Date.now()}-1`);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.decision, 'block');
    assert.ok(
      parsed.reason?.startsWith('[UNEXPECTED STOP ALERT]'),
      `reason should start with alert prefix, got: ${parsed.reason}`,
    );
  });
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

test('stale tool_result timestamp passes through (race-guard FP fix)', async () => {
  await withTmpDir(async (tmpDir) => {
    const fixture = materializeFixture(
      join(FIXTURES_DIR, 'abnormal-tool-result-stop.jsonl'),
      {
        toolResultTimestamp: new Date(Date.now() - 5000).toISOString(),
        outDir: tmpDir,
      },
    );
    const { stdout } = await runHook(fixture, `test-${Date.now()}-4`);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.continue, true);
    assert.equal(parsed.suppressOutput, true);
    assert.equal(parsed.decision, undefined);
  });
});
