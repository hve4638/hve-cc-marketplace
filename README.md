# cc-toolkit

Claude Code 용 개인 플러그인 마켓플레이스.

## 플러그인

| 이름 | 설명 |
|---|---|
| [`core`](./core) | 기본 번들 — 범용 에이전트 19 + 훅 기반 규칙 리마인더·컨텍스트 가드 + MCP 서버 (LSP 12 + AST Grep 2) + 공통 슬래시 스킬 (commit/PR, review, handoff, docs, rules) |
| [`inlay`](./inlay) | 코드 작업 방법론 가드레일 — inlay (INLAY.md), 의도 주석 (`WHY:`), 도메인 용어 |
| [`expert`](./expert) | 고급·특수 툴 — Python REPL MCP. 향후 ralph 같은 무거운 워크플로 스킬 예정 |
| [`hud`](./hud) | statusline — git/ctx%/rate-limit/모델명/subagent 트리 |
| [`research`](./research) | 리서치 워크플로 (journal, plan, report, commit) |
| [`aris`](./aris) | 학술 논문 자동화 (Autonomous Research In Sleep) |
| [`wiki`](./wiki) | 영속 마크다운 지식 베이스 (`.wiki/`) — auto-capture + 세션 훅 3종 |

## 설치

```bash
# 1. 마켓플레이스 추가
/plugin marketplace add https://github.com/hve4638/cc-toolkit

# 2. 원하는 플러그인 설치
/plugin install core@hve
/plugin install inlay@hve
/plugin install expert@hve
/plugin install hud@hve
/plugin install research@hve
/plugin install aris@hve
/plugin install wiki@hve
```

## 설치 후 설정

| 플러그인 | 후속 명령 |
|---|---|
| core | `/hve:core-setup` — `@ast-grep/napi@0.41.1` 글로벌 설치 + Codex CLI 설치 + Codex MCP 등록 (user 스코프) |
| hud | `/hve:hud setup` — statusline wrapper + settings.json 등록 |

## 갱신

```bash
/plugin marketplace update hve
```
