---
name: pickup
description: "Load context from a previous handoff folder into the current session. If multiple handoff folders exist, show them newest-first and ask the user to choose; if exactly one, load it immediately. After a successful load, move the folder into _archive/ so it does not re-surface. Pair skill to handoff; explicit invocation only."
---

<pickup_instruction>
# pickup

Read context from a previous handoff and resume it in the current session.

After picking up, briefly summarize the loaded content and do not proceed with the work itself.

---

## Flow

### 1. Scan candidates
Enumerate the direct subfolders of `.agent-memory/handoff/`. **Exclude** `_archive/`.

- Lexicographic sort on folder names suffices to find the latest (timestamps are the prefix, so chronological order follows).
- Do not use symlinks or pointer files (cross-platform portability).

### 2. Select
- **0 candidates** → tell the user there is nothing to pick up, and stop.
- **1 candidate** → load immediately (skip confirmation).
- **2+ candidates** → present them newest-first and ask the user to choose.

#### Candidate listing format
```
1. 2026-04-25T1610_new-work
2. 2026-04-25T1430_handoff-plugin-design
```

Accept either a numeric choice or a partial name match.

### 3. Load
- Read the selected folder's **`INDEX.md` first**.
- Follow INDEX's entry-point guidance and dependency ordering to walk the `NN-*.md` documents.
- Treat the loaded content as the working base for the current session.

### 4. Archive
After confirming a successful load, move the folder into `.agent-memory/handoff/_archive/`.

- Purpose: prevent the same handoff from re-surfacing on a later call.
- Do not move on failure or abort (atomicity).
- Create `_archive/` if it does not exist.
- Example: `mv .agent-memory/handoff/<folder> .agent-memory/handoff/_archive/`.

---

## Re-load policy

Archived handoffs are excluded from candidate scanning by default. (Except when the user mentions one directly.)

---

## Boundaries

- **handoff** — the saving counterpart.
- **pickup** — the restoring counterpart.
- Does not interfere with other session-continuity mechanisms.
</pickup_instruction>

$ARGUMENTS
