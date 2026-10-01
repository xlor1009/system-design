#!/bin/sh
set -e

# Railway volumes at /data are often root-owned on first mount.
export DATA_DIR="${DATA_DIR:-/data}"
mkdir -p "$DATA_DIR/uploads"

if [ "$(id -u)" = "0" ]; then
  chown -R nextjs:nodejs "$DATA_DIR" 2>/dev/null || true
  if command -v setpriv >/dev/null 2>&1; then
    exec setpriv --reuid=nextjs --regid=nodejs --init-groups -- "$@"
  fi
  if command -v runuser >/dev/null 2>&1; then
    exec runuser -u nextjs -- "$@"
  fi
fi

exec "$@"
