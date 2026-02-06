#!/bin/sh
set -eu

# Writes /usr/share/nginx/html/env.js based on container environment variables.
# Keep keys aligned with what the frontend expects.

ENV_JS_PATH="/usr/share/nginx/html/env.js"

# Minimal JSON escaping for JS strings
escape() {
  # Escapes backslash, double-quote, and newlines
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e ':a;N;$!ba;s/\n/\\n/g'
}

VITE_SUPABASE_URL_VALUE="${VITE_SUPABASE_URL:-}"
VITE_SUPABASE_ANON_KEY_VALUE="${VITE_SUPABASE_ANON_KEY:-}"
VITE_INSTAGRAM_APP_ID_VALUE="${VITE_INSTAGRAM_APP_ID:-}"
VITE_INSTAGRAM_REDIRECT_URI_VALUE="${VITE_INSTAGRAM_REDIRECT_URI:-}"
VITE_TELEGRAM_BOT_USERNAME_VALUE="${VITE_TELEGRAM_BOT_USERNAME:-}"
VITE_TELEGRAM_WEBAPP_SHORT_NAME_VALUE="${VITE_TELEGRAM_WEBAPP_SHORT_NAME:-}"

cat > "$ENV_JS_PATH" <<EOF
// Generated at container start.
// This file is loaded by index.html before the app code.
window.__ENV__ = {
  VITE_SUPABASE_URL: "$(escape "$VITE_SUPABASE_URL_VALUE")",
  VITE_SUPABASE_ANON_KEY: "$(escape "$VITE_SUPABASE_ANON_KEY_VALUE")",
  VITE_INSTAGRAM_APP_ID: "$(escape "$VITE_INSTAGRAM_APP_ID_VALUE")",
  VITE_INSTAGRAM_REDIRECT_URI: "$(escape "$VITE_INSTAGRAM_REDIRECT_URI_VALUE")",
  VITE_TELEGRAM_BOT_USERNAME: "$(escape "$VITE_TELEGRAM_BOT_USERNAME_VALUE")",
  VITE_TELEGRAM_WEBAPP_SHORT_NAME: "$(escape "$VITE_TELEGRAM_WEBAPP_SHORT_NAME_VALUE")"
};
EOF

# If you ever need to debug what got injected:
# echo "Wrote $ENV_JS_PATH" >&2
