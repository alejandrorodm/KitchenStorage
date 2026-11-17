#!/usr/bin/env bash
# Builds the app locally and installs it on a VPS that runs it with systemd behind nginx.
# The VPS needs Node 24 in /usr/bin/node; nothing is compiled there (it has little RAM).
# Usage: deploy/deploy.sh [ssh-host]   (default host: vps)
set -euo pipefail

HOST="${1:-vps}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
chmod 755 "$STAGE" # mktemp creates it 0700 and tar keeps that mode; the service user must read it

cd "$ROOT"
npm run build
mkdir -p "$STAGE/server" "$STAGE/web"
cp -r server/dist "$STAGE/server/"
cp -r web/dist "$STAGE/web/"
node -e "const p=require('./server/package.json'); delete p.devDependencies; require('fs').writeFileSync('$STAGE/server/package.json', JSON.stringify(p, null, 2))"
(cd "$STAGE/server" && npm install --omit=dev --no-audit --no-fund)
git rev-parse --short HEAD > "$STAGE/REVISION"
tar -C "$STAGE" -czf "$STAGE.tgz" .
scp -q "$STAGE.tgz" "$HOST:/tmp/kitchenstorage.tgz"
rm -f "$STAGE.tgz"

ssh "$HOST" 'set -e
cd /opt/kitchenstorage
rm -rf app.new && mkdir app.new
tar --no-same-owner -xzf /tmp/kitchenstorage.tgz -C app.new && rm /tmp/kitchenstorage.tgz
rm -rf app.old && { [ -d app ] && mv app app.old || true; } && mv app.new app
systemctl restart kitchenstorage
# The VM is slow: allow up to 30 s for the server to start listening.
for i in $(seq 30); do curl -sf 127.0.0.1:3232/api/health >/dev/null && break; sleep 1; done
curl -sf 127.0.0.1:3232/api/health >/dev/null || { echo "Health check failed; previous build kept in /opt/kitchenstorage/app.old"; exit 1; }
echo "Deployed revision $(cat app/REVISION)"'
