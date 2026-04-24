---
name: frame-setup
description: Install frame's native runtime dependency (@ast-grep/napi) globally
---

# frame setup

Installs `@ast-grep/napi` globally via npm so `ast_grep_search` / `ast_grep_replace` tools work.

LSP tools need no install — they spawn whichever language server you already have in `PATH` (e.g., `gopls`, `typescript-language-server`, `pyright`).

## Run

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/install.mjs"
```

Then tell the user to restart Claude Code.

## Notes

- Idempotent: skips install when `@ast-grep/napi` is already present in `npm root -g`.
- Uses **npm** (not pnpm) because the MCP server's banner resolves via `npm root -g`.
- If global install fails with EACCES, prompt the user to retry with `sudo` or configure a user-level npm prefix.
