# frame

## 훅

### PreToolUse (`scripts/pre-tool-enforcer.mjs`)

모든 툴 호출 직전 실행 (`matcher: "*"`, timeout 3s). 툴 이름에 따라 `<system-reminder>` 주입:

| 툴 | 주입되는 규칙 |
|---|---|
| `Bash` | Prefer dedicated tools (Read, Grep, Glob, Edit) over shell equivalents. |
| `Read` | Read multiple files in parallel when possible. |
| `Grep` | Use Grep (ripgrep) — never shell grep/rg. |
| `Write` / `Edit` | Verify the change after writing. Prefer Edit over Write for existing files. |
| 그 외 | 주입 없음 (`suppressOutput`) |

dedup 없음 — 매 호출마다 주입.

### Stop (`scripts/context-guard-stop.mjs`)

세션 Stop 지점 실행 (`matcher: "*"`, timeout 5s). 트랜스크립트 파일 크기 측정.

- `FRAME_CONTEXT_GUARD_BYTES` (기본 500000) 초과 → `additionalContext` 로 경고 주입
- 컴팩터·사용자 취소 stop → 간섭 없음
- 스크립트 내 `BLOCK_WHEN_OVER = true` 로 바꾸면 Stop 차단

## 러너 (`scripts/run.cjs`)

모든 훅의 실제 진입점 (`hooks.json` 이 호출).

- `process.execPath` 로 Node 직접 spawn — PATH/셸 의존 제거
- `CLAUDE_PLUGIN_ROOT` 가 stale 이면 캐시 디렉터리 스캔해 최신 버전 스크립트로 폴백
- `hooks.json` 의 `timeout` 파싱 후 자식 프로세스에 적용
- 모든 에러 경로 fail-open (exit 0)