import { readFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { atomicWriteFileSync, ensureDirSync } from './atomic-write.mjs';

const CACHE_SUBDIR = '.agent-memory/patchwork-cache';

// WHY: session_id = UUID v4, agent_id = 짧은 hex (≥6 자). 사용자가 수동으로
//      둔 다른 *.json 파일은 cleanup 대상에서 제외해야 한다.
const FILE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:-[0-9a-f]{6,})?\.json$/i;

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function emptyState() {
  return { hashes: {}, tracking: {}, stopHookFired: false };
}

function readJsonOrEmpty(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      hashes: parsed.hashes ?? {},
      tracking: parsed.tracking ?? {},
      stopHookFired: parsed.stopHookFired ?? false,
    };
  } catch {
    return emptyState();
  }
}

export function getCacheDir(projectRoot) {
  return join(projectRoot, CACHE_SUBDIR);
}

function baseFile(projectRoot, sessionId) {
  return join(getCacheDir(projectRoot), `${sessionId}.json`);
}

function ownFile(projectRoot, sessionId, agentId) {
  return join(getCacheDir(projectRoot), `${sessionId}-${agentId}.json`);
}

function targetFile(projectRoot, sessionId, agentId) {
  return agentId
    ? ownFile(projectRoot, sessionId, agentId)
    : baseFile(projectRoot, sessionId);
}

export function loadCache({ projectRoot, sessionId, agentId }) {
  const base = readJsonOrEmpty(baseFile(projectRoot, sessionId));
  if (!agentId) return base;

  const own = readJsonOrEmpty(ownFile(projectRoot, sessionId, agentId));
  // WHY: 서브에이전트는 base 를 read-only 로 보고 own 만 갱신한다.
  //      own 이 base 를 덮어써야 자기 변경이 우선 반영된다.
  return {
    hashes: { ...base.hashes, ...own.hashes },
    tracking: { ...base.tracking, ...own.tracking },
    stopHookFired: own.stopHookFired ?? false,
  };
}

export function loadCacheForStop({ projectRoot, sessionId }) {
  // WHY: Stop 훅은 메인 컨텍스트에서만 발화하지만 서브에이전트가 만진
  //      캡슐도 함께 검사해야 미갱신 누락이 없다. 같은 session_id 의 own
  //      파일 (`${sessionId}-*.json`) 을 모두 union 한다. stopHookFired
  //      플래그는 메인 파일 값만 — 잔소리 1회 차단은 메인 책임이다.
  const dir = getCacheDir(projectRoot);
  const base = readJsonOrEmpty(baseFile(projectRoot, sessionId));
  const merged = {
    hashes: { ...base.hashes },
    tracking: { ...base.tracking },
    stopHookFired: base.stopHookFired ?? false,
  };
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return merged;
  }
  const prefix = `${sessionId}-`;
  for (const name of entries) {
    if (!name.startsWith(prefix) || !name.endsWith('.json')) continue;
    const own = readJsonOrEmpty(join(dir, name));
    Object.assign(merged.hashes, own.hashes);
    Object.assign(merged.tracking, own.tracking);
  }
  return merged;
}

export function saveCache(updates, { projectRoot, sessionId, agentId }) {
  // WHY: 서브에이전트는 own 파일만 atomic write. base 를 건드리면 메인과
  //      서브의 race window 가 생기고 격리 모델이 깨진다.
  const path = targetFile(projectRoot, sessionId, agentId);
  const cur = readJsonOrEmpty(path);
  if (updates.hashes) Object.assign(cur.hashes, updates.hashes);
  if (updates.tracking) Object.assign(cur.tracking, updates.tracking);
  if (typeof updates.stopHookFired === 'boolean') cur.stopHookFired = updates.stopHookFired;
  atomicWriteFileSync(path, JSON.stringify(cur));
}

export function compactReset({ projectRoot, sessionId, agentId }) {
  const path = targetFile(projectRoot, sessionId, agentId);
  const cur = readJsonOrEmpty(path);
  // WHY: 압축 후 캡슐 메시지가 사라졌으므로 다음 PreToolUse 가 풀 chain
  //      을 다시 emit 해야 한다. stopHookFired 는 세션 자체 1 회 발화
  //      플래그라 압축 무관하게 보존.
  const next = { hashes: {}, tracking: {}, stopHookFired: cur.stopHookFired };
  atomicWriteFileSync(path, JSON.stringify(next));
}

export function ownFileExists(projectRoot, sessionId, agentId) {
  try {
    statSync(targetFile(projectRoot, sessionId, agentId));
    return true;
  } catch {
    return false;
  }
}

export function cleanupOrphans({ projectRoot, ttlMs = DEFAULT_TTL_MS }) {
  const dir = getCacheDir(projectRoot);
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  const cutoff = Date.now() - ttlMs;
  for (const name of entries) {
    // WHY: 화이트리스트로 가드 — 사용자가 수동으로 둔 .json 을
    //      삭제하면 patchwork 가드를 넘어 데이터 손실로 이어진다.
    if (!FILE_PATTERN.test(name)) continue;
    const full = join(dir, name);
    try {
      if (statSync(full).mtimeMs < cutoff) unlinkSync(full);
    } catch {
      // WHY: 동시 삭제·접근 실패는 다음 회차에 다시 시도할 기회가 있다.
    }
  }
}

export function ensureCacheDir(projectRoot) {
  ensureDirSync(getCacheDir(projectRoot));
}
