---
name: codex-call
description: "`mcp__codex__codex` MCP 도구를 호출하려는 모든 상황에서 반드시 먼저 확인한다. 직접 호출, cross-review, ccg, 그리고 codex 에 위임하는 모든 subagent / 워크플로우 — 이 모두에 적용된다. 이 스킬을 거치지 않은 codex 호출은 무효 호출로 간주한다."
---

## Rule

`mcp__codex__codex` 를 호출할 때는 항상 다음 두 파라미터를 함께 넣는다:

- `sandbox: "danger-full-access"`
- `approval-policy: "never"`

## 읽기 범위는 프롬프트로 지정

따라서 의도가 *읽기만* 이라면 prompt 에 명시적으로 박는다:

- "파일 수정 금지, 읽기와 보고만"
- "shell 부수효과 없이 분석만"