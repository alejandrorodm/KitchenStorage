# Kitchen Storage MVP
Objective: household web app (PWA) tracking fridge/freezer/pantry stock, receipt import, weekly meal planner, alerts and shopping list, synced across devices.
Branch: `feat/kitchen-storage-mvp` · Delivery: ask-on-risk (no remote yet; chain strategy asked when a PR is prepared) · Test runner: Vitest (`npm test`).

## Specs

- **S1 Inventory** — "tener registrado todo los alimentos guardados en nevera, congelador y despensa". Each food item has name, location (fridge | freezer | pantry), quantity, unit, low-stock threshold.
- **S2 Manual entry** — "deberá poderse añadir manualmente". Create, edit, delete and adjust quantity of items from the UI.
- **S3 Receipt entry** — "o a través de ticket". Upload a receipt photo; parsed with Gemini free-tier API ("Peticiones de gemini gratuitas"); user reviews lines before they are added. Lines merge into an existing item with the same name, location and unit.
- **S4 Weekly planner** — "habrá un planificador semanal donde planificar comidas (desayuno, comida y cena)". Week view, 7 days × 3 meals.
- **S5 Food allocation and count** — "se asignaran alimentos a dichas comidas que se irán restando para tener un conteo". Assumption: allocations to not-yet-eaten meals reduce the *available* count (quantity − planned); marking a meal as eaten deducts the quantities from stock (undo restores them).
- **S6 Alerts** — "alertas cuando se vaya a acabar algo o se acabe". Item is `low` when available ≤ threshold and > 0, `out` when available ≤ 0. Shown as in-app alerts with badge.
- **S7 Shopping list** — "y añadiran a una lista de la compra". Low/out items are added automatically (one entry per item); entries are removed automatically when the item is back above threshold; manual entries can be added, checked and deleted.
- **S8 Sync** — "una app que esté sincronizada entre todos los dispositivos (se me ocurre app web, luego te doy el VPS)". Single shared household dataset, login required, live updates pushed to every open device (SSE). Docker deployment for a VPS.

## Tasks

| ID | Specs | Route | Status | Commit |
|----|-------|-------|--------|--------|
| T1 | S1, S5, S6 | inline | pending | |
| T2 | S8 (auth) | inline | pending | |
| T3 | S1, S2, S8 | inline | pending | |
| T4 | S4, S5 | inline | pending | |
| T5 | S6, S7 | inline | pending | |
| T6 | S3 | inline | pending | |
| T7 | S1–S8 (web UI) | inline | pending | |
| T8 | S8 (Docker, docs) | inline | pending | |

T1 server scaffold + domain rules · T2 auth · T3 inventory API + events · T4 planner · T5 shopping/alerts · T6 receipts · T7 web PWA · T8 deploy.
Route evidence: one coherent app with a shared contract; no Writer-trigger reason (units depend on the T1 domain), parent writes inline.

## Log

- **L1 (2026-11-17, user request, verbatim):** "Haz una aplicación para tener registrado todo los alimentos guardados en nevera, congelador y despensa, deberá poderse añadir manualmente o a través de ticket, habrá un planificador semanal donde planificar comidas (desayuno, comida y cena) y se asignaran alimentos a dichas comidas que se irán restando para tener un conteo, alertas cuando se vaya a acabar algo o se acabe y añadiran a una lista de la compra. Esto será una app que esté sincronizada entre todos los dispositivos (se me ocurre app web, luego te doy el VPS)"
- **L2 (2026-11-17, user answer to receipt OCR question, verbatim):** "Peticiones de gemini gratuitas"
- **L3:** Stack decision: npm workspaces; `server` = Node 24 + Fastify + `node:sqlite` + Zod, organized by feature (domain/application/infrastructure); `web` = Vite + React + TanStack Query + PWA. Gemini model configurable via `GEMINI_MODEL`.
