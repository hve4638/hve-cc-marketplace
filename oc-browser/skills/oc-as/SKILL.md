---
name: oc-as
description: Operate an isolated, headed Chromium inside a Docker container via `oc-as <name> browser <action>`. The `<name>` may be prefixed to choose how the browser is displayed: `host:<rest>` renders directly on the host's X server, `vnc:<rest>` exposes noVNC on a free port (`vnc:<port>:<rest>` for an explicit port), and bare `<rest>` runs headless (legacy). Each resolved name is its own container (cookies, cache, profile). Project-scoped automatically — same `<name>` in different projects → different containers. Lifecycle is fully manual: created on first call, removed via `oc-rm <name>`. Use `oc-list` to see what's alive. A sibling `oc browser <action>` command exists for already-isolated environments (e.g. Claude itself running inside a container) — it skips Docker entirely and runs `npx openclaw` directly. Use whenever the user asks to browse a URL, take a screenshot, scrape a JS-rendered page, fill a form, automate a web flow, log into a site, render a PDF, click/type on a real page, or otherwise drive a real browser. Do NOT use for plain HTML/JSON fetches that `WebFetch` or `curl` already handle. If `oc-as` returns `command not found`, route to /oc-setup and stop.
---

# oc-as

`oc-as <name> browser <action>` drives an isolated, headed Chromium running in container `oc-browser-<projTag>-<name>`. The container is created on first call and persists until the user explicitly removes it.

## How project scoping works

On each call, `oc-as`:

1. Walks up from the current working directory to find a `.agent-memory/oc-volume/` directory.
2. If not found, creates it in the current PWD (and prints a one-line notice to stderr).
3. Uses the directory's parent (the project root) basename as `<projTag>` in the container name.
4. Bind-mounts `<volume-root>/<name>/shared/` → `/home/oc/shared/` and `<volume-root>/<name>/media/` → `/home/oc/.openclaw/media/` inside the container (full mapping in the "File exchange" table below).

So:
- Same project, same name → same container (re-attach across calls).
- Same project, different name → different container (separate cookies/tabs).
- Different project, same name → different container (project basename differs).
- All host-side state lives under `<project>/.agent-memory/oc-volume/`. gitignore it.

To see what's alive across all projects:

```bash
oc-list
```

## Picking a name

`<name>` is yours within a project. Reuse it for follow-up calls.

- One name per task: `work`, `research`, `demo`, `signup-test`.
- Same name → same container in this project.
- Multiple Claude sessions/calls hitting the same name in the same project share that container — only do this when sharing is intended.

Naming rules for `<rest>`: `[a-zA-Z0-9][a-zA-Z0-9_.-]{0,24}`.

## Display modes (prefixes)

The first arg to `oc-as` may be prefixed to pick how Chromium is shown. The prefix is encoded into the resolved container name, so different modes for the same `<rest>` get different containers and don't collide.

| Form | Container suffix | What it does |
|---|---|---|
| `<rest>` | `<rest>` | Headless gateway only. No display, no VNC. Useful for pure automation/screenshots from scripts. (Legacy default — kept for back-compat.) |
| `host:<rest>` | `host_<rest>` | Renders Chromium on the host's X server. Reads `$DISPLAY`; falls back to `:0` if `/tmp/.X11-unix/X0` exists. Mounts `/tmp/.X11-unix:ro`. Fails fast with guidance if no host X is reachable. |
| `vnc:<rest>` | `vnc_<port>_<rest>` | Exposes noVNC on a free host port from `6080-6099` (auto-picked). Re-attaching with the same `vnc:<rest>` finds the existing container and reuses its port. |
| `vnc:<port>:<rest>` | `vnc_<port>_<rest>` | Same as `vnc:<rest>` but pins the host port. Fails if the port is busy. Range: `1024-65535`. |

`host:` mode requires the container UID (1000, user `oc`) to be allowed by the host X server. Easiest: from the host's graphical session, `xhost +SI:localuser:<your-user>` once — but this only works cleanly when your host user's UID is 1000. On other UIDs the mapping breaks; use a looser option like `xhost +local:` or rebuild the image with the host UID.

VNC mode prints `oc-as: VNC at http://127.0.0.1:<port>/vnc.html` to stderr on every call, so the URL stays visible.

`vnc:<rest>` (no explicit port) is the recommended VNC entry point — it auto-picks free ports, so multiple VNC instances coexist without manual port juggling.

Examples:
```bash
oc-as host:work browser open https://example.com --label demo
oc-as vnc:research browser doctor              # picks 6080 first, then 6081, ...
oc-as vnc:5901:fixed browser status             # explicit port
oc-as headless browser screenshot               # bare <rest>, no display
```

## Extra docker flags

If you need additional docker run flags (GPU passthrough, memory limits, etc.), pass them via the `OC_DOCKER_EXTRA` env var, e.g. `OC_DOCKER_EXTRA="-e KEY=val --gpus all"`. **Applied at container creation only** — ignored if the container already exists, so to change them, `oc-rm <name>` and recreate.

## Container-free passthrough: `oc`

When the caller is **already inside a container** (a dev container, a sandboxed Claude environment, etc.), spinning up another Docker layer is wasteful or impossible. The plugin ships a sibling command for that case:

```bash
oc browser <action> [args...]
```

`oc`:

- Bypasses Docker. Runs `npx -y openclaw@<pinned-version>` directly in the current environment.
- Has **no `<name>` argument and no project scoping** — the surrounding container *is* the isolation boundary, so an extra state-dir split would only invite gateway socket conflicts.
- Inherits openclaw's default profile path (`~/.openclaw/`) — fine inside a container, where that home is already isolated.
- Detects `/.dockerenv` on every non-readonly call. If it's missing (i.e. you're on a real host), it prints a warning and sleeps 3s before forwarding. Set `OC_NO_HOST_WARN=1` to silence.
- Pre-checks `npx` and a Chromium binary (`chromium` / `chromium-browser` / `google-chrome`) on PATH. Fails fast with install hints when either is missing.
- Override the pin via `OC_PIN=<version> oc browser ...` if you need a different release for a single call.

When to use which:

| Caller's environment | Pick |
|---|---|
| Bare host, want isolation between tasks | `oc-as <name> browser ...` |
| Inside a container (Claude or otherwise) | `oc browser ...` |
| Need host X / VNC display modes | `oc-as host:<name>` / `oc-as vnc:<name>` (containers only) |

`oc` does not interact with `oc-list` / `oc-rm` — those remain Docker-only. There is nothing to clean up; ending the surrounding container is the cleanup.

## Operating loop

For any multi-step task:

1. **State first.** `oc-as <name> browser status` (or `doctor` on suspicion).
2. **Open with a label.** `oc-as <name> browser open <url> --label <l>` — gives a stable handle.
3. **Snapshot, then act.** `oc-as <name> browser snapshot --target-id <l> --format aria` and pick a ref.
4. **Re-snapshot after every UI change.** Navigation / DOM-mutating click / modal / form submit → snapshot again.
5. **Stale ref → one retry.** Re-snapshot once and retry. Still failing → report the page state.
6. **Manual blockers → stop and report.** Login, 2FA, captcha, camera/mic, account chooser. Never guess credentials, never loop.

## Command reference

All browser actions take the form `oc-as <name> browser <action> [flags...]`.

Lifecycle (the browser process, not the container):
```bash
oc-as <name> browser doctor [--deep]
oc-as <name> browser status
oc-as <name> browser start [--headless]
oc-as <name> browser stop
oc-as <name> browser reset-profile
```

Tabs:
```bash
oc-as <name> browser tabs
oc-as <name> browser open <url> --label <l>
oc-as <name> browser focus <l|t1|targetId>
oc-as <name> browser close <l|t1|targetId>
```

Inspect:
```bash
oc-as <name> browser snapshot --target-id <l> [--format aria] [--efficient] [--labels] [--limit <n>] [--urls]
oc-as <name> browser screenshot [--full-page | --ref <r> | --labels]
oc-as <name> browser pdf
```

`screenshot` and `pdf` write to `~/.openclaw/media/browser/<uuid>.<ext>` inside the container — bind-mounted to host (see "File exchange"). They print the resulting `MEDIA:` / `PDF:` line on stdout.

Act (use refs from the latest snapshot on the same `--target-id`; the flag is kebab-cased — `--targetId` is rejected):
```bash
oc-as <name> browser navigate <url> --target-id <l>
oc-as <name> browser click <ref> --target-id <l> [--double]
oc-as <name> browser type <ref> "<text>" --target-id <l> [--submit]
oc-as <name> browser press <key> --target-id <l>
oc-as <name> browser hover <ref> --target-id <l>
oc-as <name> browser select <ref> "<option>"... --target-id <l>
oc-as <name> browser fill --fields '[{"ref":"1","value":"Ada"}]' --target-id <l>
oc-as <name> browser wait --text "<phrase>" --target-id <l>
oc-as <name> browser highlight <ref> --target-id <l>
```

Files / dialogs / downloads — paths are container-side and constrained by openclaw, NOT under `/home/oc/shared/`. `oc-as` does not bind-mount these directories today, so files are not directly visible from the host (use `docker cp` if needed):

```bash
oc-as <name> browser upload <container-path>          # under /tmp/openclaw-<uid>/uploads/
oc-as <name> browser dialog --accept                  # or --dismiss; arms the next dialog
oc-as <name> browser download <ref> <container-path>  # under /tmp/openclaw-<uid>/downloads/
oc-as <name> browser waitfordownload <container-path> # same constraint
```

Debug:
```bash
oc-as <name> browser console [--level error]
oc-as <name> browser errors
oc-as <name> browser requests
oc-as <name> browser trace start
oc-as <name> browser trace stop
oc-as <name> browser evaluate --fn '(el) => el.textContent' --ref <r>
```

Pass `--json` to most commands for machine-readable output. The `openclaw browser --help` examples list the canonical invocations — when in doubt, that is the source of truth, not this file.

## File exchange

Two host-visible directories live under `<project>/.agent-memory/oc-volume/<resolved>/`:

| Use | Container path | Host path |
|---|---|---|
| Generic shared scratch (you can put anything here) | `/home/oc/shared/` | `<project>/.agent-memory/oc-volume/<resolved>/shared/` |
| `screenshot` / `pdf` outputs (auto-routed) | `/home/oc/.openclaw/media/browser/<uuid>.<ext>` | `<project>/.agent-memory/oc-volume/<resolved>/media/browser/<uuid>.<ext>` |

`<resolved>` is the suffix that ends up in the container name (e.g. `host_work`, `vnc_6080_research`, or plain `work`).

`screenshot` and `pdf` print a `MEDIA:` / `PDF:` line containing the **container** path. The matching host path is the same uuid filename under `<project>/.agent-memory/oc-volume/<resolved>/media/browser/`. Surface that host path to the user.

`upload`/`download`/`waitfordownload` use openclaw's internal `/tmp/openclaw-<uid>/{uploads,downloads}/` — these are NOT bind-mounted by `oc-as` today. To move files in/out of those dirs, use `docker cp` against the resolved container, or stage in `/home/oc/shared/` and reference that.

## Discovering active instances

```bash
oc-list
```

Shows every `oc-browser-*` container, its docker status, and the host directory bound to `/home/oc/shared/`. Use this before picking a `<name>` if you're unsure what's already in use.

## Cleanup (`oc-rm`)

Use `oc-rm` — it mirrors the `oc-as` naming and bundles the three steps (container, docker volume, optional host dir) into one command, scoped to the current project.

```bash
oc-rm <name>                  # confirm prompt
oc-rm -f <name>               # skip confirmation
```

Default removes the container + docker home volume (cookies/profile). The host-side `.agent-memory/oc-volume/<resolved>/` is **kept** unless `--rm-shared` is passed, so screenshots/downloads survive by default.

Name forms (same as `oc-as`):

| Form | Matches |
|---|---|
| `<rest>` | exact `<rest>` (plain mode) |
| `host:<rest>` | exact `host_<rest>` |
| `vnc:<port>:<rest>` | exact `vnc_<port>_<rest>` |
| `vnc:<rest>` | every `vnc_*_<rest>` (any port) |

Useful flags:

- `--rm-shared` — also delete `.agent-memory/oc-volume/<resolved>/`.
- `--keep-volume` — keep the docker home volume (cookies/profile preserved for re-use).
- `--all` — every `oc-browser-<projTag>-*` container, plus stale leftover volumes/dirs in this project.
- `-f, --force` — skip the y/N confirmation.

Examples:

```bash
oc-rm host:work                          # default: container + volume; shared dir kept
oc-rm vnc:research                       # remove every port for 'research'
oc-rm -f --rm-shared host:demo           # nuke everything for host_demo
oc-rm --keep-volume vnc:5901:fixed       # keep cookies for next time
oc-rm --all                              # wipe this project
```

If the name doesn't match anything in this project, `oc-rm` exits with an error rather than silently doing nothing — guards against typos.

## Anti-bot caveats

This is headed Chromium on Xvfb in a container. `navigator.webdriver` is true, IP is from a datacenter range, UA may leak `HeadlessChrome`. Strict sites (X/Twitter, Cloudflare-gated, Google login) often refuse — report the block, don't loop retries.

## When NOT to use

- Plain HTML/JSON the model already fetches via `WebFetch` or `curl`.
- Bulk scraping (hundreds of pages) — write a dedicated script.
- Anything needing a non-browser GUI app.

## If `oc-as` is missing

If `oc-as` returns `command not found`, do not improvise. Route to `/oc-setup` and stop.
