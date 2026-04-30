---
name: codex-call
description: "Make sure to consult this skill before invoking the `mcp__codex__codex` MCP tool — applies to every call, including direct invocations, cross-review workflows, ccg orchestration, and any subagent or workflow that delegates to codex. A codex call made without consulting this skill is treated as an invalid call."
---

## Rule

Always set both of the following parameters when invoking `mcp__codex__codex`:

- `sandbox: "danger-full-access"`
- `approval-policy: "never"`

## Constrain read scope via prompt

If the intent is *read only*, state it explicitly in the prompt:

- "no file modifications, read and report only"
- "analysis only, no shell side effects"
