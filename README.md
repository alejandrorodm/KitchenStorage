# Kitchen Storage

Household app to track what is in the **fridge, freezer and pantry**, plan **breakfast, lunch and dinner** for the week, get **alerts** when food runs low and keep a **shopping list** that fills itself. Installable as a PWA on phones and desktops; every open device updates live.

## Features

| Area | What it does |
|------|--------------|
| Today | Home screen with today's three meals, what is running out and what is left to buy. |
| Inventory | Add, edit, delete and +/- items manually. Each item has a place, quantity, unit and a "warn me at" threshold. |
| Receipts | Take a photo of a receipt; Gemini reads the food lines, you review them, and they are added to stock (merged with items of the same name, place and unit). |
| Planner | Week view (Mon–Sun × breakfast/lunch/dinner). Assign food from stock to each meal. |
| Count | Planned food is subtracted from the **available** count right away. **Mark as eaten** takes it out of stock; **Undo** puts back exactly what was taken. |
| Alerts | An item is *running low* when available ≤ threshold and *out of stock* when available ≤ 0. Shown on the Today screen and as a badge on the Food (Alimentos) section. |
| Shopping list | Low/out items are added automatically and removed once restocked. Manual entries can be added, checked and cleared. |
| Sync | One shared household dataset. Changes are pushed to all devices via Server-Sent Events. |
| Layout | Phones: bottom tab bar, day picker in the planner and bottom-sheet dialogs. Desktop: sidebar, storage zones side by side and the full week as a grid. Light and dark themes follow the device. |

## Architecture

```
server/   Node 24 + Fastify + node:sqlite (no native build), organised by feature:
  src/<feature>/domain          pure rules (stock status, name matching)
  src/<feature>/application     use cases + ports (repository / receipt parser interfaces)
  src/<feature>/infrastructure  SQLite repositories, HTTP routes, Gemini adapter
  src/app.ts                    composition root, SSE endpoint, static web hosting
web/      Vite + React + TanStack Query PWA
  src/components/{atoms,molecules,organisms}  presentational components
  src/features/*                              containers (data + state)
```

## Configuration

Environment variables (put them in a `.env` file at the repository root):

| Variable | Required | Description |
|----------|----------|-------------|
| `INVITE_CODE` | yes | Code needed to create an account (min 6 characters). Share it only with your household. |
| `GEMINI_API_KEY` | no | Free key from <https://aistudio.google.com/apikey>. Without it, receipt reading is disabled. |
| `GEMINI_MODEL` | no | Defaults to `gemini-flash-latest`. |
| `DOMAIN` | compose | Public domain pointing at the VPS; Caddy gets the HTTPS certificate for it. |
| `DATABASE_PATH` | no | Defaults to `data/kitchen.sqlite`. |
| `PORT` | no | Defaults to `3000`. |
| `COOKIE_SECURE`, `TRUST_PROXY` | no | Set to `true` behind HTTPS/reverse proxy (compose does this). |

> On the Gemini free tier Google may use the submitted receipt images to improve its products.

## Development

```bash
npm install
INVITE_CODE=dev-invite npm run dev -w server   # API on :3000
npm run dev -w web                             # UI on :5173 (proxies /api)
npm test                                       # server + web tests
npm run typecheck
```

## Deploy on a VPS

Requirements: Docker with Compose, ports 80/443 open, and a DNS record for your domain pointing to the VPS.

```bash
git clone <repo> kitchen-storage && cd kitchen-storage
cat > .env <<'EOF'
INVITE_CODE=pick-a-long-secret
GEMINI_API_KEY=your-key
DOMAIN=kitchen.yourdomain.com
EOF
docker compose up -d --build
```

Open `https://<DOMAIN>`, create an account with the invite code, and use "Add to Home screen" / "Install app" on each device.

Data lives in the `kitchen_data` Docker volume (`/app/data/kitchen.sqlite` inside the container). To back it up:

```bash
docker compose stop app
docker compose cp app:/app/data ./backup-$(date +%F)
docker compose start app
```

## Deploy without Docker (systemd + nginx)

For a small VPS that already runs nginx. The app is built locally and only the result is copied, so the server needs Node 24 but no build tools.

One-time setup on the VPS (as root):

1. `useradd --system --home-dir /opt/kitchenstorage --shell /usr/sbin/nologin kitchen`, then `mkdir -p /opt/kitchenstorage/data` and `chown kitchen:kitchen /opt/kitchenstorage/data`.
2. Create `/opt/kitchenstorage/.env` (mode 640, group `kitchen`) with `INVITE_CODE`, `GEMINI_API_KEY`, `DATABASE_PATH=/opt/kitchenstorage/data/kitchen.sqlite`, `WEB_DIST_PATH=/opt/kitchenstorage/app/web/dist`, `HOST=127.0.0.1`, `PORT=3232`, `COOKIE_SECURE=true`, `TRUST_PROXY=true`.
3. Copy `deploy/kitchenstorage.service` to `/etc/systemd/system/` and run `systemctl enable kitchenstorage`.
4. Copy `deploy/nginx-site.conf` to `/etc/nginx/sites-available/<domain>`, replace `<DOMAIN>`, link it into `sites-enabled`, run `nginx -t && systemctl reload nginx`, then `certbot --nginx -d <domain>`.

Each release, from your machine:

```bash
deploy/deploy.sh vps   # "vps" is the SSH host
```

The script installs dependencies from `package-lock.json`, uploads into `/opt/kitchenstorage` (not the shared `/tmp`) and waits up to 30 s for `/api/health`. If the new build does not come up, it puts the previous one back, restarts it and keeps the failed build in `/opt/kitchenstorage/app.failed`.

## Android app (APK)

Every push runs the **Android APK** GitHub Actions workflow, which builds a signed APK and attaches it to the run as the artifact `kitchen-storage-apk-<run number>`. Download it from the run page under *Actions* and install it on the phone. Each build has a higher version code, so a newer APK installs over the previous one.

The app is a Trusted Web Activity: a thin Android shell that opens https://kitchen.alejandrorodm.com full screen. It always shows the live site, so ordinary releases only need `deploy/deploy.sh`; a new APK is needed only when the name, colours or icons change. Details, signing keys and local builds: [`deploy/android/README.md`](deploy/android/README.md).
