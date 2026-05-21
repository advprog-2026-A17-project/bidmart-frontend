#!/bin/sh
set -eu

LOCK_MARKER="node_modules/.package-lock.sha256"
LOCK_SHA=$(sha256sum package-lock.json | awk '{print $1}')

clear_node_modules() {
  # node_modules is a Docker volume mount; delete contents, not the mount point.
  find node_modules -mindepth 1 -maxdepth 1 -exec rm -rf {} +
}

install_deps() {
  clear_node_modules
  npm ci --prefer-offline --no-audit --no-fund
  echo "$LOCK_SHA" > "$LOCK_MARKER"
}

needs_install=false
if [ ! -f node_modules/vite/package.json ]; then
  needs_install=true
elif [ ! -f "$LOCK_MARKER" ] || [ "$(cat "$LOCK_MARKER")" != "$LOCK_SHA" ]; then
  needs_install=true
fi

if [ "$needs_install" = true ]; then
  install_deps
fi

exec npm run dev -- --host 0.0.0.0 --port 5173
