#!/usr/bin/env node
import { basename, dirname, resolve } from 'path';
import { readContextChain, formatForHook } from '../_build/src/lib/read-context.mjs';
import {
  loadCache,
  saveCache,
  cleanupOrphans,
  ownFileExists,
  ensureCacheDir,
} from '../_build/src/lib/state-file.mjs';

const INTERCEPT = new Set(['Read', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
  process.exit(0);
}

function readStdin() {
  return new Promise((resolveStdin) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolveStdin(data));
  });
}

function extractPath(toolName, toolInput) {
  if (!toolInput) return null;
  if (toolName === 'NotebookEdit') return toolInput.notebook_path ?? null;
  return toolInput.file_path ?? null;
}

async function main() {
  const raw = await readStdin();
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return emit({ continue: true });
  }

  const { session_id, agent_id, cwd, tool_name, tool_input } = input;
  if (!session_id) return emit({ continue: true });
  if (!INTERCEPT.has(tool_name)) return emit({ continue: true });

  const filePath = extractPath(tool_name, tool_input);
  if (!filePath) return emit({ continue: true });

  // WHY: CONTEXT.md 를 직접 수정하는 호출에서 chain 을 박으면 그 자기
  //      본문이 prompt 에 또 들어가 의미상 순환이 생긴다. Read 는 본문
  //      만 보여주므로 정상 chain 으로 다룬다.
  if (WRITE_TOOLS.has(tool_name) && basename(filePath) === 'CONTEXT.md') {
    return emit({ continue: true });
  }

  const projectRoot = cwd ?? process.cwd();
  ensureCacheDir(projectRoot);

  // WHY: 메인 세션의 자기 캐시 파일이 아직 없을 때 = 세션의 첫 PreToolUse.
  //      이 시점에 한 번만 orphan cleanup 을 돌린다. 서브에이전트는 자기
  //      own 파일만 다루므로 cleanup 책임 안 짐.
  if (!agent_id && !ownFileExists(projectRoot, session_id, null)) {
    cleanupOrphans({ projectRoot });
  }

  const ctx = { projectRoot, sessionId: session_id, agentId: agent_id };
  const cache = loadCache(ctx);
  const startDir = dirname(resolve(filePath));
  const entries = readContextChain(startDir, { cache });

  const changed = entries.some((e) => e.status !== 'unchanged');
  if (changed) saveCache({ hashes: cache.hashes }, ctx);

  const additionalContext = formatForHook(entries);
  if (!additionalContext) return emit({ continue: true });

  // WHY: Claude Code 는 additionalContext 를 top-level 이 아니라
  //      hookSpecificOutput 안에 wrap 한 형태로만 LLM prompt 에 주입한다.
  //      top-level 키는 스키마 외라 drop 됨 (hook 출력 docs 의 PreToolUse 형식).
  emit({
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext,
    },
  });
}

main().catch(() => emit({ continue: true }));
