#!/usr/bin/env bash
set -euo pipefail

# Run ESG portal + quick trycloudflare tunnel and print a ready-to-send link with token.
# Usage:
#   ./run-one-command.sh security   # security company survey
#   ./run-one-command.sh property   # property management survey
#   ./run-one-command.sh default    # default survey

SURVEY_KIND="${1:-security}"

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "[ERR] .env not found in $ROOT" >&2
  echo "Create it first (copy from .env.example)." >&2
  exit 1
fi

# Load .env (simple KEY=VALUE lines)
set -a
# shellcheck disable=SC1091
source .env
set +a

PORT="${PORT:-3000}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"

if [[ -z "$ADMIN_TOKEN" ]]; then
  echo "[ERR] ADMIN_TOKEN is empty in .env. Set ADMIN_TOKEN=... first." >&2
  exit 1
fi

# Start server (if not already healthy)
if ! curl -s "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
  echo "[INF] starting esg-portal on port ${PORT}..."
  (npm run start >/tmp/esg-portal.log 2>&1 &) 
  # wait up to ~10s
  for _ in {1..40}; do
    if curl -s "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
      break
    fi
    sleep 0.25
  done
fi

if ! curl -s "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
  echo "[ERR] esg-portal not responding on http://127.0.0.1:${PORT}" >&2
  echo "Check /tmp/esg-portal.log" >&2
  exit 1
fi

echo "[INF] starting quick tunnel (this terminal must stay open)..."

# Start cloudflared in background and capture logs
CLOUDFLARED_LOG="/tmp/cloudflared-esg.log"
: > "$CLOUDFLARED_LOG"
(cloudflared tunnel --url "http://127.0.0.1:${PORT}" 2>&1 | tee -a "$CLOUDFLARED_LOG") &
CLOUDFLARED_PID=$!

# Extract trycloudflare URL from logs
PUBLIC_URL=""
for _ in {1..80}; do
  PUBLIC_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$CLOUDFLARED_LOG" | tail -n 1 || true)
  if [[ -n "$PUBLIC_URL" ]]; then
    break
  fi
  sleep 0.25
done

if [[ -z "$PUBLIC_URL" ]]; then
  echo "[ERR] could not get trycloudflare URL. Check $CLOUDFLARED_LOG" >&2
  kill "$CLOUDFLARED_PID" >/dev/null 2>&1 || true
  exit 1
fi

# Persist PUBLIC_BASE_URL so /api/admin/links returns public URL next time
if grep -q '^PUBLIC_BASE_URL=' .env; then
  sed -i "s|^PUBLIC_BASE_URL=.*|PUBLIC_BASE_URL=${PUBLIC_URL}|" .env
else
  echo "PUBLIC_BASE_URL=${PUBLIC_URL}" >> .env
fi

# Create access link token
JSON=$(curl -s -X POST "http://127.0.0.1:${PORT}/api/admin/links" \
  -H "x-admin-token: ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"label":"ESG问卷","maxSubmissions":3,"expiresHours":168}')

TOKEN=$(echo "$JSON" | sed -n 's/.*"token"[[:space:]]*:[[:space:]]*"\([a-f0-9]\{32\}\)".*/\1/p')
if [[ -z "$TOKEN" ]]; then
  echo "[ERR] failed to parse token from response:" >&2
  echo "$JSON" >&2
  kill "$CLOUDFLARED_PID" >/dev/null 2>&1 || true
  exit 1
fi

PATH_PART="/"
case "$SURVEY_KIND" in
  security) PATH_PART="/security.html" ;;
  property) PATH_PART="/property.html" ;;
  default|main|index) PATH_PART="/" ;;
  *)
    echo "[ERR] unknown survey kind: $SURVEY_KIND (use security|property|default)" >&2
    kill "$CLOUDFLARED_PID" >/dev/null 2>&1 || true
    exit 1
    ;;
esac

FINAL_LINK="${PUBLIC_URL}${PATH_PART}?t=${TOKEN}"

cat <<EOF

====================
Ready-to-send link:
${FINAL_LINK}
====================

Notes:
- Keep THIS terminal open (cloudflared tunnel runs here). Closing it will break the link.
- Client submissions will be saved into this computer (SQLite + uploads).
EOF

# Keep foreground attached to tunnel logs
wait "$CLOUDFLARED_PID"
