#!/usr/bin/env bash
# Usage: bootstrap.sh <slug>
# Stdout: absolute path of created worktree
# Stderr: progress + errors
# Exit: 0 on success, non-zero on failure
#
# Slug includes a timestamp prefix (e.g., 20260509-1234-pricing-rules) and is
# composed by the skill in Step 1. The skill is also responsible for writing
# the spec to <repo_root>/.agent-memory/tdd-spec/<slug>.md before invoking
# this script.
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "error: slug required" >&2
  exit 1
fi

slug="$1"

case "$slug" in
  *[!a-zA-Z0-9_-]*|"")
    echo "error: slug must contain only [a-zA-Z0-9_-]: $slug" >&2
    exit 1
    ;;
esac

if [ "${CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS:-}" != "1" ]; then
  echo "error: CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 required (export it and restart Claude Code)" >&2
  exit 1
fi

repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "error: not inside a git repository" >&2
  exit 1
}

spec_path="${repo_root}/.agent-memory/tdd-spec/${slug}.md"
if [ ! -f "$spec_path" ]; then
  echo "error: spec file not found: $spec_path" >&2
  exit 1
fi

repo_name=$(basename "$repo_root")
parent_dir=$(dirname "$repo_root")
unique_slug="$slug"
worktree_path="${parent_dir}/${repo_name}-pairtdd-${unique_slug}"

i=2
while [ -e "$worktree_path" ] || git -C "$repo_root" show-ref --verify --quiet "refs/heads/pairtdd/${unique_slug}"; do
  unique_slug="${slug}-${i}"
  worktree_path="${parent_dir}/${repo_name}-pairtdd-${unique_slug}"
  i=$((i + 1))
done
branch="pairtdd/${unique_slug}"

git worktree add "$worktree_path" -b "$branch" >&2
git -C "$worktree_path" commit --allow-empty -m "pairtdd: start ${unique_slug}" >&2

echo "$worktree_path"
