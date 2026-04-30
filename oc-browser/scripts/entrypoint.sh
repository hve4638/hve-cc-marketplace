#!/usr/bin/env bash
set -Eeuo pipefail

cleanup() {
  trap - EXIT INT TERM
  for pid in "${WS_PID:-}" "${VNC_PID:-}" "${XVFB_PID:-}"; do
    [ -n "$pid" ] && kill -TERM "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Seed openclaw config on first boot — enable --no-sandbox because the container
# runs as non-root in a constrained namespace where Chromium's user-namespace
# sandbox is unavailable. Openclaw reads this from ~/.openclaw/openclaw.json.
mkdir -p "$HOME/.openclaw"
if [ ! -f "$HOME/.openclaw/openclaw.json" ]; then
  cat > "$HOME/.openclaw/openclaw.json" <<'JSON'
{
  "browser": {
    "noSandbox": true
  }
}
JSON
fi

Xvfb :99 -screen 0 1280x800x24 -ac -nolisten tcp &
XVFB_PID=$!

if [ "${OC_VIEW:-0}" = "1" ]; then
  x11vnc -display :99 -rfbport 5900 -localhost -nopw -shared -forever -bg -q
  VNC_PID=$(pgrep -f 'x11vnc -display :99' | head -1 || true)
  websockify --web /usr/share/novnc/ 6080 localhost:5900 &
  WS_PID=$!
fi

exec openclaw gateway --allow-unconfigured
