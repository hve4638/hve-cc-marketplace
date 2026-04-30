---
name: reflect
disable-model-invocation: true
argument-hint: "[optional: slug hint for the retrospection topic]"
---

<reflect_instruction>
# reflect

Extract user corrections and factual errors from the session, and turn each item into a child guardrail skill (`reflect-<slug>/SKILL.md`). In future sessions the children auto-trigger via description matching and prevent the same mistake.

Runtime assumption: a host with description-matching auto-trigger (Claude Code, Codex CLI, etc.). Without that mechanism, children behave as plain documents only.

## reflect vs children

- reflect: explicit invocation (`disable-model-invocation: true`). Performs the retrospective thinking.
- reflect-* children: auto-trigger candidates. Carry only future-facing instructions (no retrospective narration).

The four retrospection slots (Step 1) are reflect's internal thinking aids. **Do not write them into child output.**

---

## Storage spec

- Path: `.claude/skills/reflect-<slug>/SKILL.md` (project-local enforced; never user-global)
- Child prefix: `reflect-`
- Child language: English only (no `SKILL.ko.md` for children)
- Slug: kebab-case, ≤30 chars, English. Scope to the narrowest trigger context.

---

## Self-exploration principle

Retrospection extraction (Step 1) grounds itself in the session context alone. No git, grep, web, or file re-reads. Items requiring out-of-session information are excluded (purpose: block guesses and reinterpretation).

Later-step reads/writes of the catalog and existing child SKILL.md files are bookkeeping operations, not subject to this principle.

---

## Retrospection categories

Leave an axis blank if nothing fits — do not force-fill.

### 1. Points the user corrected

Extract from utterances where the user explicitly corrected, refuted, or redirected.

- Examples: "no, that's not it", "X is the right one", "not that way".
- Only corrections of the Agent's wrong action or assumption count. Plain priority changes or pivots are excluded.
- Praise or confirmations are excluded.

### 2. Misknown or outdated facts

Factual errors that became objectively evident inside the session.

- Calls to nonexistent functions/options/paths confirmed by errors.
- Assumptions about old behaviors of tools/APIs/models contradicted by actual output.
- Category 1 takes priority. If a user correction is itself a factual error, record it under 1 only (avoid duplication).

---

## Workflow

### Step 1. Extract retrospection items

Sweep the session context for items in either category. Use these four slots as internal thinking aids (do not put them in the child):

1. `Past action` — the prior action or assumption (one line)
2. `Signal` — how the mistake came to light (user utterance / error message / output mismatch)
3. `Correct form` — what is correct
4. `Generalization` — neighboring situations where the same mistake could recur

### Step 2. Decide the slug

Auto-pick an English slug that names the narrowest trigger context.

- Good: `git-rebase-no-edit-flag`, `bash-find-regex-order`, `tsx-jsx-key-prop`
- Bad: `general-tips`, `mistakes`, `learning-20260430`

### Step 3. Merge decision

Check whether the new item folds into the same guardrail as an existing child in the catalog.

Criterion: do the two items' `Correct form` slots fit accurately into a single line?

- One line accurately covers both → merge candidate
- Combining forces an enumeration that loses one side's exact answer → split

If a merge candidate, present the combined single-line rule to the user and ask them to choose merge / split / skip. If a slug already exists exactly, always confirm with the user (no automatic overwrite).

#### Decision examples

| A's Correct form | B's Correct form | Combined single line | Decision |
|---|---|---|---|
| Confirm flag is valid for `git rebase` | Confirm flag is valid for `git rebase` | "Verify the flag belongs to `git rebase` before using it" | Merge |
| Use `'foo' in d` | Use `np.float64` | "Avoid deprecated APIs" | Split (single line drops both exact alternatives) |

### Step 4. Write the child SKILL.md

Only `Correct form` and `Generalization` from the slots flow into the child. The WHY clause in the description is an abstraction of the failure mode drawn from `Past action` / `Signal`.

Skeleton:

```yaml
---
name: reflect-<slug>
description: "<trigger + WHY. Do not put rules here.>"
---

# Rule
<what to do / not to do. The body is the center.>

# Not a violation
<one or two cases where this rule does not apply. May be omitted entirely.>
```

#### description-writing rules

- Use imperative voice (`Use this skill when ...`, `Consult this skill to ...`). Declarative (`This skill does X`) is forbidden.
- State the Agent's intent, not the skill's implementation.
- Spell out the trigger categories: `"... when the task involves {trigger A}, {trigger B}, or {trigger C}"`.
- Include a WHY clause: `"Consult it to avoid {invalid flag, unknown switch error, ...}"`. Drawn from the `Past action` / `Signal` slots.
- Include at least one of: tool name, command, error message (so the description is distinctive against other skills).
- 100~200 words recommended, ≤1024 chars. No `<` or `>`.
- Do not list concrete queries; name trigger categories only.

#### Do not put in the description

- Stacked ALL-CAPS `MUST` / `ALWAYS` / `NEVER` (noise)
- Safety-net clauses (`"even when the user doesn't explicitly ask ..."`) — induces over-triggering
- Action rules themselves — strips the body of its purpose

#### body-writing rules

The body may carry only items and mechanisms encountered in the session itself. Importing outside general knowledge (other deprecated items not seen in the session, other invalid flags, etc.) is forbidden — record only verified corrections, never guesses.

Mechanism abstractions (e.g., "verify it actually exists before calling it") are abstractions of session-observed cases and are allowed.

#### Examples

❌ Description with rules baked in (body becomes redundant):

```
"Use this skill when writing git rebase commands. The --no-edit flag is invalid for git rebase — omit it. Consult it to avoid an unknown switch error."
```

⭕ Trigger + WHY only (rules live in the body):

```
"Use this skill when writing or proposing `git rebase` commands. Consult it to avoid passing an invalid flag combination that aborts the rebase with an 'unknown switch' error."
```

In the latter, "which flag is invalid" lives in the body's Rule section.

### Step 5. Update the catalog

Append a row to the catalog table at the bottom of this `SKILL.md` (or update the existing row's `Last updated` on merge). The catalog is index-only — rules themselves live in each child SKILL.md (single source of truth).

### Step 6. Report and stop

Briefly report to the user and stop. Do not propose further retrospection.

- N items → N child skills (M merged, K new, L skipped)
- One line per child: slug and description

---

## Empty retrospection

If neither user corrections nor factual errors are present, do not create a child skill — just report that in one line. Form-filling retrospections accumulate as system noise.

---

## Boundaries

- Different from handoff (hands working context to the next session) — reflect does not write to handoff.
- Different from MEMORY.md (permanent personal/project knowledge) — reflect does not modify MEMORY.md.
- Different from the manage-skills family (verify skills and meta documents) — reflect does not touch meta documents (CLAUDE.md, etc.); it only creates guardrail child skills.

Children (`reflect-*`) are auto-trigger candidates via description matching, so do not put `disable-model-invocation` in their frontmatter.

---

## Catalog

Index of child skills reflect has produced. Step 5 self-updates this section. Rules themselves live in each child SKILL.md (single source of truth) — this catalog is just a fast-lookup index.

`Scope key` = the tool, command, or API the child triggers on.

| Slug | Scope key | Last updated |
|------|-----------|--------------|

(No reflect-* skills generated yet.)

<!-- Once children exist, add rows above:
| `reflect-git-rebase-flag-validation` | `git rebase` flags | 2026-04-30 |
-->
</reflect_instruction>

$ARGUMENTS
