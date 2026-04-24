# frame

## 에이전트 (`agents/`)

19개 범용 에이전트 수록 (영문 + 한글본 `.ko/`). 모두 plugin-independent — 다른 플러그인·스킬에서 `Task(subagent_type="<name>", ...)` 로 호출 가능.

| 카테고리 | 에이전트 |
|---|---|
| 탐색·계획 | explore, analyst, planner, architect |
| 구현 | executor, code-simplifier, designer, writer |
| 검증 | verifier, critic, code-reviewer, security-reviewer, test-engineer |
| 디버깅·분석 | debugger, tracer, qa-tester, scientist |
| 기타 | document-specialist, git-master |

한글본은 `agents/.ko/` (숨김 디렉토리, Claude Code 가 자동 로드하지 않음 — 참고용).

## 스킬 (`skills/`)

| 스킬 | 용도 |
|---|---|
| `frame-setup` | `@ast-grep/napi` 네이티브 모듈 전역 설치 (설치 후 1회 실행) |
| `interview` | Socratic 질의응답으로 모호한 아이디어를 수학적 ambiguity 게이팅까지 구체화, spec 파일 크리스탈라이즈 |

`interview` 는 `explore` 에이전트 (본 플러그인 제공) 를 사용하여 brownfield/greenfield 판정·코드베이스 탐색 수행.

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

## MCP 서버 (`bridge/mcp-server.cjs`)

`.mcp.json` 이 단일 서버 `t` 로 등록. 14개 툴 노출:

| 그룹 | 툴 |
|---|---|
| **LSP** (12) | `hover`, `goto_definition`, `find_references`, `document_symbols`, `workspace_symbols`, `diagnostics`, `diagnostics_directory`, `servers`, `prepare_rename`, `rename`, `code_actions`, `code_action_resolve` |
| **AST Grep** (2) | `ast_grep_search`, `ast_grep_replace` |

LSP 툴은 사용자 `PATH` 의 언어 서버에 의존 (`gopls`, `typescript-language-server`, `pyright` 등). 설치 안 된 언어는 해당 LSP 호출 시 에러 반환.

AST Grep 툴은 `@ast-grep/napi` 네이티브 모듈 필요.

## 설치 후 수행 (`/hve:frame-setup`)

```bash
/hve:frame-setup
```

`scripts/install.mjs` 를 호출하여 `@ast-grep/napi@0.41.1` 을 글로벌 npm 에 설치.

- 이미 설치돼 있으면 skip
- 버전은 **정확히 0.41.1 로 고정** (공급망 대비)
- 설치 후 Claude Code 재시작 필요

## 러너 (`scripts/run.cjs`)

모든 훅의 실제 진입점 (`hooks.json` 이 호출).

- `process.execPath` 로 Node 직접 spawn — PATH/셸 의존 제거
- `CLAUDE_PLUGIN_ROOT` 가 stale 이면 캐시 디렉터리 스캔해 최신 버전 스크립트로 폴백
- `hooks.json` 의 `timeout` 파싱 후 자식 프로세스에 적용
- 모든 에러 경로 fail-open (exit 0)

## MCP 재빌드 (개발자용)

`_build/src/` 안에 MCP 서버 TypeScript 소스 포함. 툴 추가·제외 시 `_build/src/mcp/tool-registry.ts` 편집 후:

```bash
cd _build
pnpm install
node build-mcp-server.mjs
```

출력: `bridge/mcp-server.cjs`.
