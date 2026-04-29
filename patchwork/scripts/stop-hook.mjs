#!/usr/bin/env node
import { statSync } from 'fs';
import { dirname } from 'path';
import { execFileSync } from 'child_process';
import {
  loadCacheForStop,
  saveCache,
  ensureCacheDir,
} from '../_build/src/lib/state-file.mjs';

function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
  process.exit(0);
}

function silent() {
  emit({ continue: true, suppressOutput: true });
}

function readStdin() {
  return new Promise((resolveStdin) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolveStdin(data));
  });
}

function runGit(cwd, args) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf-8',
      timeout: 1000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

function getCapsuleDiff(capsuleRoot) {
  // WHY: 캡슐 디렉토리가 git work tree 안일 때만 diff 노출. 외부면 skip.
  const inside = runGit(capsuleRoot, ['rev-parse', '--is-inside-work-tree']);
  if (!inside || inside.trim() !== 'true') return null;

  // WHY: full diff 는 모델이 방금 자기가 만든 변경이라 본문 중복. 파일별
  //      +/- 통계만 노출해 캡슐 내 변동 스코프만 알린다.
  const stat = runGit(capsuleRoot, ['diff', '--stat', '--', '.']);
  if (stat == null || stat.length === 0) return null;
  return stat.replace(/\n+$/, '');
}

function buildAlert(stale) {
  const lines = [
    '[PATCHWORK ALERT] CONTEXT.md was not updated for the following capsule(s):',
    '',
    ...stale.map((p) => `- ${p}`),
    '',
    'If your code change affects the capsule boundary, entry point, or domain terms, update CONTEXT.md. Otherwise ignore.',
  ];

  for (const ctxPath of stale) {
    const capsuleRoot = dirname(ctxPath);
    const diff = getCapsuleDiff(capsuleRoot);
    if (diff == null) continue;
    lines.push('', `[DIFF IN CAPSULE] ${capsuleRoot}`, diff);
  }

  return lines.join('\n');
}

async function main() {
  const raw = await readStdin();
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return silent();
  }

  // WHY: stop_hook_active 는 block 결정으로 유발한 continuation 에서 true.
  //      patchwork 는 1회 잔소리에 block 을 쓰므로 두 번째 진입은 차단해
  //      loop 방지. stopHookFired 가 1차 가드, 이건 2차 가드.
  if (input.stop_hook_active === true) return silent();
  if (input.hook_event_name && input.hook_event_name !== 'Stop') return silent();

  const { session_id, cwd } = input;
  if (!session_id) return silent();

  const projectRoot = cwd ?? process.cwd();
  ensureCacheDir(projectRoot);
  const cache = loadCacheForStop({ projectRoot, sessionId: session_id });

  if (cache.stopHookFired) return silent();

  const stale = [];
  for (const [ctxPath, info] of Object.entries(cache.tracking)) {
    let mtime;
    try {
      mtime = statSync(ctxPath).mtimeMs;
    } catch {
      // WHY: CONTEXT.md 가 사라졌으면 추적 항목 자체가 의미 없다. skip.
      continue;
    }
    if (mtime === info.contextMtimeAtWrite) stale.push(ctxPath);
  }

  if (stale.length === 0) return silent();

  // WHY: 잔소리 1회 출력 후 차단. 다음 PostToolUse 의 내부 파일 수정 시
  //      false 로 리셋되어 새 작업 사이클에서 재발화 가능 (§10.4 참조).
  saveCache({ stopHookFired: true }, { projectRoot, sessionId: session_id });

  // WHY: Stop 훅 스키마는 hookSpecificOutput 에 'Stop' 을 허용하지 않음
  //      (validator: PreToolUse / UserPromptSubmit / PostToolUse / PostToolBatch
  //      만 허용). 모델 컨텍스트로 주입하는 schema-valid 경로는
  //      `decision: 'block'` + `reason` 뿐. stopHookFired + stop_hook_active
  //      두 가드로 1회 발화만 보장하므로 사실상 1회 잔소리와 동치.
  emit({ decision: 'block', reason: buildAlert(stale) });
}

main().catch(() => silent());
