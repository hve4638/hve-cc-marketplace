#!/usr/bin/env node
/**
 * PreToolUse Hook: Rule Reminder Enforcer
 *
 * Injects a short `<system-reminder>` before each tool execution to keep
 * plugin-specific rules fresh in the model's active context.
 *
 * Customize `rulesForTool()` below — one rule per tool is usually enough.
 *
 * Hook contract (docs/claude-code-plugin-mechanics.md):
 *   stdin  : JSON { tool_name, tool_input, session_id, cwd, ... }
 *   stdout : JSON { continue, hookSpecificOutput: { hookEventName, additionalContext } }
 *   exit 0 : always (fail-open; run.cjs clamps timeouts)
 */

import { readStdin } from './lib/stdin.mjs';

function rulesForTool(toolName) {
  switch (toolName) {
    case 'Bash':
      return 'Prefer dedicated tools (Read, Grep, Glob, Edit) over shell equivalents.';
    case 'Read':
      return 'Read multiple files in parallel when possible.';
    case 'Grep':
      return 'Use Grep (ripgrep) — never shell grep/rg.';
    case 'Write':
    case 'Edit':
      return 'Verify the change after writing. Prefer Edit over Write for existing files.';
    default:
      return null;
  }
}

async function main() {
  const input = await readStdin(1000);
  let data = {};
  try { data = JSON.parse(input); } catch { /* empty/invalid stdin — proceed */ }

  const toolName = data?.tool_name ?? '';
  const rule = rulesForTool(toolName);

  if (!rule) {
    process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }));
    return;
  }

  process.stdout.write(JSON.stringify({
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: rule,
    },
  }));
}

main().catch(() => {
  process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }));
});
