# Kitchen Storage

Household app to track what is in the **fridge, freezer and pantry**, plan **breakfast, lunch and dinner** for the week, get **alerts** when food runs low and keep a **shopping list** that fills itself. Installable as a PWA on phones and desktops; every open device updates live.

## Features

| Area | What it does |
|------|--------------|
| Inventory | Add, edit, delete and +/- items manually. Each item has a place, quantity, unit and a "warn me at" threshold. |
| Receipts | Take a photo of a receipt; Gemini reads the food lines, you review them, and they are added to stock (merged with items of the same name, place and unit). |
| Planner | Week view (Mon–Sun × breakfast/lunch/dinner). Assign food from stock to each meal. |
| Count | Planned food is subtracted from the **available** count right away. **Mark as eaten** takes it out of stock; **Undo** puts back exactly what was taken. |
| Alerts | An item is *running low* when available ≤ threshold and *out of stock* when available ≤ 0. Shown on the Kitchen tab with a badge. |
| Shopping list | Low/out items are added automatically and removed once restocked. Manual entries can be added, checked and cleared. |
| Sync | One shared household dataset. Changes are pushed to all devices via Server-Sent Events. |

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
