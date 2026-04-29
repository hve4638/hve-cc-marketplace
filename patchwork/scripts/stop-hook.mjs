#!/usr/bin/env node
import { statSync } from 'fs';
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

function buildAlert(stale) {
  const lines = [
    '[PATCHWORK ALERT] 다음 캡슐의 CONTEXT.md 가 갱신되지 않았다:',
    '',
    ...stale.map((p) => `- ${p}`),
    '',
    '코드 변경에 캡슐 경계·진입점·도메인 용어 변동이 있으면 갱신.',
    '없다면 무시.',
  ];
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

  // WHY: stop_hook_active 는 Stop 훅이 block 결정으로 유발한 continuation
  //      에서 true 로 박힌다. patchwork 는 block 안 쓰지만 방어적으로 가드.
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

  // WHY: Stop 훅의 additionalContext 는 hookSpecificOutput 안에 wrap 한
  //      형태로만 LLM prompt 에 주입된다 (frame context-guard-stop.mjs 패턴).
  emit({
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'Stop',
      additionalContext: buildAlert(stale),
    },
  });
}

main().catch(() => silent());
