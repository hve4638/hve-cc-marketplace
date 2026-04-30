---
name: oc-setup
description: One-time global install for the oc-browser plugin. Verifies Docker is installed and runnable, builds the `openclaw-browser:local` Docker image, and places `oc-as`, `oc-list`, `oc-rm`, and `oc` onto a directory currently on PATH. Per-project state (`.agent-memory/oc-volume/`) is created later by `oc-as` itself, not here. Use ONLY when the user explicitly asks to set up / install / configure / initialize oc-browser, or when /oc-setup is invoked, or when the `oc-as` skill detects `oc-as` is missing.
---

# oc-setup

Idempotent **one-time global install**: Docker check → image build → symlink `oc-as`, `oc-list`, `oc-rm`, and `oc` onto PATH.

This does NOT create any project volume. The shared volume `.agent-memory/oc-volume/` is created lazily by `oc-as` on first use inside a project.

When this skill runs, **execute the workflow below**. Do not just summarize.

## Phase 1 — Preflight

### 1a. Docker installed?

```bash
docker --version
```

If this fails (`command not found`), STOP and tell the user:

```
Docker is not installed. On Ubuntu, install with:

    sudo apt-get update && sudo apt-get install -y docker.io
    sudo systemctl enable --now docker
    sudo usermod -aG docker "$USER"

Then log out and back in, and re-run /oc-setup.
```

Do not attempt to install Docker yourself.

### 1b. Docker daemon reachable as this user?

```bash
docker info >/dev/null 2>&1
```

If this fails:

- `permission denied ... docker.sock` → `sudo usermod -aG docker "$USER"` then re-login. STOP.
- `Cannot connect to the Docker daemon` → `sudo systemctl start docker`. STOP.
- Other → show stderr verbatim. STOP.

## Phase 2 — Run the install script

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/install.sh"
```

This (idempotent):

1. `chmod +x` on `oc-as`, `oc-list`, `oc-rm`, `oc`, `entrypoint.sh`, `install.sh`.
2. Picks an install dir on PATH (prefers `~/.local/bin`).
3. Builds `openclaw-browser:local` from the plugin's `scripts/` dir.
4. Symlinks `oc-as`, `oc-list`, `oc-rm`, and `oc` into the install dir.
5. Warns if the chosen dir is not on PATH.

If the build fails, show stderr to the user. Do not auto-retry.

## Phase 3 — Smoke test

```bash
oc-as --help
oc-list
```

If `oc-as` is `command not found`, the install dir is not on the current shell's PATH. The script printed the resolved path — instruct the user to either open a new terminal or `export PATH="<install-dir>:$PATH"`. Then have them re-run the smoke step.

`oc-list` should print `(no oc-browser-* containers)` on a fresh install.

Optionally exercise an end-to-end check from a throwaway directory (creates `.agent-memory/oc-volume/smoke/` there):

```bash
mkdir -p /tmp/oc-smoke && cd /tmp/oc-smoke
oc-as smoke browser doctor
oc-list                           # should now show one oc-browser-oc-smoke-smoke entry
```

If it passes, clean up:

```bash
oc-rm -f --rm-shared smoke
```

If `oc-as smoke browser doctor` fails, show the error and stop. Common causes:

- Image built fine but Chromium can't start under the user namespace → enable unprivileged user namespaces, or relax `cap-drop` (advanced).
- `npm i -g openclaw@latest` failed during build → re-run install.sh after `docker rmi openclaw-browser:local`.

## Phase 4 — Report

After the smoke passes, tell the user:

- ✓ Image: `openclaw-browser:local` (size from `docker image ls`)
- ✓ CLIs: `<install-dir>/oc-as`, `<install-dir>/oc-list`, `<install-dir>/oc-rm`, `<install-dir>/oc` (the last is for use inside an already-isolated env)
- Per-project state lives at `<project>/.agent-memory/oc-volume/<name>/`, created on first `oc-as <name> ...` call.
- Suggest adding `.agent-memory/` to `.gitignore`.
- Example: `cd <your-project> && oc-as host:work browser open https://example.com --label demo` (host X) or `oc-as vnc:work browser ...` (VNC) or plain `oc-as work browser ...` (headless).
- Cleanup pattern: `oc-list` to see active, `oc-rm <name>` to remove (container + docker volume; add `--rm-shared` to also delete host files, `--keep-volume` to preserve cookies/profile, `--all` to wipe everything in the project).

Suggest (do not auto-add) adding `Bash(oc-as *)`, `Bash(oc-list)`, and `Bash(oc-rm *)` to `~/.claude/settings.json` permissions.

## Re-running

This skill is idempotent. Re-running:

- Skips Docker install.
- Re-builds the image only if its inputs changed (Docker layer cache).
- Re-creates the symlinks (`ln -sf`).
- Leaves any existing `oc-browser-*` containers and volumes untouched.

To wipe and start over:

```bash
# Remove all oc-browser-* containers and their home volumes
docker ps -a --filter name=oc-browser- -q | xargs -r docker rm -f
docker volume ls --filter name=oc-browser-home- -q | xargs -r docker volume rm
docker rmi openclaw-browser:local 2>/dev/null
# Per-project shared dirs:
#   rm -rf <project>/.agent-memory/oc-volume   (do this in each project that used oc-as)
```

then re-invoke `/oc-setup`.
