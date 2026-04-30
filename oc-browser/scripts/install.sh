#!/usr/bin/env bash
# install.sh — global, one-time install:
#   1. preflight (Docker installed + reachable)
#   2. build openclaw-browser:local image
#   3. symlink `oc-as`, `oc-list`, `oc-rm`, and `oc` onto PATH
#
# This script does NOT create any project volume. The shared volume
# (.agent-memory/oc-volume/) is created lazily by `oc-as` on first use
# inside a project.
#
# Idempotent. Called from the /oc-setup skill.
set -Eeuo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_TAG="${OC_IMAGE:-openclaw-browser:local}"

# ── Preflight ───────────────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  echo "✗ docker is not installed." >&2
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "✗ docker daemon is not reachable as this user." >&2
  echo "  sudo systemctl start docker" >&2
  echo "  sudo usermod -aG docker \"\$USER\"  (then re-login)" >&2
  exit 1
fi

# ── Pick an install dir on PATH ─────────────────────────────────────────
pick_install_dir() {
  local d
  for d in "$HOME/.local/bin" "$HOME/bin"; do
    case ":$PATH:" in
      *":$d:"*)
        mkdir -p "$d" 2>/dev/null
        if [ -d "$d" ] && [ -w "$d" ]; then echo "$d"; return; fi
        ;;
    esac
  done
  local IFS=':'
  for d in $PATH; do
    [ -z "$d" ] && continue
    [ -d "$d" ] && [ -w "$d" ] && { echo "$d"; return; }
  done
  mkdir -p "$HOME/.local/bin"
  echo "$HOME/.local/bin"
}

INSTALL_DIR="$(pick_install_dir)"

# ── chmod bundled scripts ───────────────────────────────────────────────
chmod +x "$HERE/oc-as" "$HERE/oc-list" "$HERE/oc-rm" "$HERE/oc" "$HERE/entrypoint.sh" "$HERE/install.sh"

# ── Build the image ─────────────────────────────────────────────────────
echo "→ building $IMAGE_TAG (Docker layer cache will skip steps already done)"
docker build -t "$IMAGE_TAG" "$HERE"

# ── Symlink CLIs onto PATH ──────────────────────────────────────────────
ln -sf "$HERE/oc-as"   "$INSTALL_DIR/oc-as"
ln -sf "$HERE/oc-list" "$INSTALL_DIR/oc-list"
ln -sf "$HERE/oc-rm"   "$INSTALL_DIR/oc-rm"
ln -sf "$HERE/oc"      "$INSTALL_DIR/oc"

# ── Summary ─────────────────────────────────────────────────────────────
SIZE="$(docker image ls --format '{{.Size}}' "$IMAGE_TAG" | head -1 || echo '?')"
echo
echo "✓ install complete"
echo "  • image  : $IMAGE_TAG ($SIZE)"
echo "  • oc-as  : $INSTALL_DIR/oc-as   →  $HERE/oc-as"
echo "  • oc-list: $INSTALL_DIR/oc-list →  $HERE/oc-list"
echo "  • oc-rm  : $INSTALL_DIR/oc-rm   →  $HERE/oc-rm"
echo "  • oc     : $INSTALL_DIR/oc      →  $HERE/oc           (native passthrough; for use inside an already-isolated env)"
echo
echo "Per-project state lives at  <project>/.agent-memory/oc-volume/<name>/"
echo "and is created automatically on first 'oc-as <name> ...' call."
echo

case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *)
    echo "⚠  $INSTALL_DIR is not on the current shell's PATH."
    echo "   Add to your shell rc:    export PATH=\"$INSTALL_DIR:\$PATH\""
    echo "   Or open a new terminal if your distro adds ~/.local/bin automatically."
    echo
    ;;
esac

echo "Try:  cd /tmp && oc-as smoke browser doctor && oc-list"
echo "Then: cd /tmp && oc-rm -f --rm-shared smoke"
