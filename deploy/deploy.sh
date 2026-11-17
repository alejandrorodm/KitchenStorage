#!/usr/bin/env bash
# Builds the app locally and installs it on a VPS that runs it with systemd behind nginx.
# The VPS needs Node 24 in /usr/bin/node; nothing is compiled there (it has little RAM).
# All runtime dependencies are pure JavaScript, so node_modules built here run on the VPS.
# Usage: deploy/deploy.sh [ssh-host]   (default host: vps)
set -euo pipefail

HOST="${1:-vps}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE" "$STAGE.tgz"' EXIT
chmod 755 "$STAGE" # mktemp creates it 0700 and tar keeps that mode; the service user must read it

cd "$ROOT"
npm run build
mkdir -p "$STAGE/server" "$STAGE/web"
cp package.json package-lock.json "$STAGE/"
cp server/package.json "$STAGE/server/"
cp web/package.json "$STAGE/web/"
cp -r server/dist "$STAGE/server/"
cp -r web/dist "$STAGE/web/"
# Exact versions from the lockfile, server runtime dependencies only.
(cd "$STAGE" && npm ci --omit=dev --workspace=server --no-audit --no-fund)
git rev-parse --short HEAD > "$STAGE/REVISION"
tar -C "$STAGE" -czf "$STAGE.tgz" .
# Upload into a root-only directory, not the shared /tmp.
scp -q "$STAGE.tgz" "$HOST:/opt/kitchenstorage/release.tgz"

ssh "$HOST" 'set -e
cd /opt/kitchenstorage
rm -rf app.new && mkdir app.new
tar --no-same-owner -xzf release.tgz -C app.new && rm release.tgz

healthy() {
  # The VM is slow: allow up to 30 s for the server to start listening.
  for i in $(seq 30); do curl -sf 127.0.0.1:3232/api/health >/dev/null && return 0; sleep 1; done
  return 1
}

rm -rf app.old && { [ -d app ] && mv app app.old || true; } && mv app.new app
systemctl restart kitchenstorage
if healthy; then
  echo "Deployed revision $(cat app/REVISION)"
  exit 0
fi

echo "Health check failed for $(cat app/REVISION); rolling back" >&2
[ -d app.old ] || { echo "No previous build to roll back to" >&2; exit 1; }
rm -rf app.failed && mv app app.failed && mv app.old app
systemctl restart kitchenstorage
healthy && echo "Rolled back to $(cat app/REVISION); failed build kept in /opt/kitchenstorage/app.failed" >&2
exit 1'
