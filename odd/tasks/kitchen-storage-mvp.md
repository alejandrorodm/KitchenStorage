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
- **S9 Redesign** — "revisa y rediseña la aplicación completamente para que sea profesional y extremadamente intuitiva tanto en móvil con la app como en pc". Web UI only; API contract unchanged.
- **S10 Deploy** — "rescata el VPS guardado y usado en vipertrade y despliegalo". VPS = SSH host `vps` (shared with ViperTrade and LifeHub).

## Tasks

| ID | Specs | Route | Status | Commit |
|----|-------|-------|--------|--------|
| T1 | S1, S5, S6 | inline | done | 8e16e1d — RED (missing module) → GREEN 4 tests |
| T2 | S8 (auth) | inline | done | f144b42 (auth, own commit: high-risk item 2); tests in b5e67d6 |
| T3 | S1, S2, S8 | inline | done | b5e67d6 |
| T4 | S4, S5 | inline | done | b5e67d6 — 6 tests |
| T5 | S6, S7 | inline | done | b5e67d6 — 5 tests |
| T6 | S3 | inline | done (real Gemini call unverified: no key) | b5e67d6 — fake parser + output validation tests |
| T7 | S1–S8 (web UI) | inline | done | ad8d57a — typecheck, week tests, prod build |
| T8 | S8 (Docker, docs) | inline | done | a23a3f9 — docker build + container smoke test |
| T9 | S9 | inline | done | f43da3d (deps), f423b4a (redesign), 0928608 (review fixes), 784a00e (docs) — typecheck, 33 server + 5 web tests, Playwright smoke on phone/desktop/dark |
| T10 | S10 | inline | blocked: needs DNS | 1ffbec1, 5d54257 — service live on VPS 127.0.0.1:3232 |

T1 server scaffold + domain rules · T2 auth · T3 inventory API + events · T4 planner · T5 shopping/alerts · T6 receipts · T7 web PWA · T8 deploy.
Route evidence: one coherent app with a shared contract; no Writer-trigger reason (units depend on the T1 domain), parent writes inline.

## Log

- **L1 (2026-11-17, user request, verbatim):** "Haz una aplicación para tener registrado todo los alimentos guardados en nevera, congelador y despensa, deberá poderse añadir manualmente o a través de ticket, habrá un planificador semanal donde planificar comidas (desayuno, comida y cena) y se asignaran alimentos a dichas comidas que se irán restando para tener un conteo, alertas cuando se vaya a acabar algo o se acabe y añadiran a una lista de la compra. Esto será una app que esté sincronizada entre todos los dispositivos (se me ocurre app web, luego te doy el VPS)"
- **L2 (2026-11-17, user answer to receipt OCR question, verbatim):** "Peticiones de gemini gratuitas"
- **L3:** Stack decision: npm workspaces; `server` = Node 24 + Fastify + `node:sqlite` + Zod, organized by feature (domain/application/infrastructure); `web` = Vite + React + TanStack Query + PWA. Gemini model configurable via `GEMINI_MODEL`.
- **L4 (2026-11-17):** Verification: server 27 tests (auth, inventory, planner, shopping/alerts, receipts) + web 2 tests, typecheck clean; tests written after T3–T6 code were mutation-checked (breaking the restock rule fails 3 tests). E2E smoke on prod build: register/login, item create on device A pushed via SSE to device B, auto shopping entry, SPA fallback. Docker image built and smoke-tested.
- **L5:** `.env.example` blocked by a user deny rule on `.env*`; variables documented in README instead. Pending: auth review (RDD, high_risk), independent verifier for high-risk items 2/5, real Gemini call with a key, VPS deploy (user will provide VPS).
- **L6 (2026-11-17):** Independent verifier (items 2, 5): S1–S6 pass; 3 blockers — (1) percent-encoded `/%61pi/...` bypassed the auth guard, (2) checked auto shopping entry blocked re-listing (S7), (3) bind-mounted `./data` not writable by uid 1000 in Docker. One correction batch: RED tests for 1–2 → GREEN (30 server tests); fixes in 00787ec (auth, guard by matched route), 2af96c3 (shopping), 8c8b2dc (named volume + INVITE_CODE required in compose). Recheck limited to blockers: encoded path → 401 on container, DB written as `node` on named volume, compose fails clearly without INVITE_CODE. Advisories kept open: shared login limiter per IP, sessions do not slide, TRUST_PROXY trusts all hops (safe behind Caddy).
- **L7:** RDD review of range 8e16e1d..HEAD (risk lens, high) awaiting user consent.
- **L8 (2026-11-17):** User granted the RDD review ("Revisar este cambio", twice: the first START went stale because of the L6 doc commit). START with consent granted returned `lens_context_budget_exceeded` for 8e16e1d..HEAD (58 files, ~11.8k lines, mostly package-lock.json). No review authority was created. Needs a user decision on a smaller review scope.
- **L9 (2026-11-17, user, verbatim):** "Sí, revisa solo el tramo de correcciones" · consent: "Revisa los cambios con gentle AI, tienes mi aprobación para revisarlos todos sin volver a preguntar". RDD review of fixes slice a77937b..7c247f4 (risk lens, 9 files, 84 lines): **approved**, acknowledged (authority burned, lineage review-1b0539d94d2a2125). One advisory (R1-001): moving from `./data` bind mount to the `kitchen_data` volume does not migrate existing data — no deployment exists yet. Reviewed boundary is now 7c247f4.
- **L10 (2026-11-17, user, verbatim):** "Pon la interfaz en español". UI copy, PWA manifest (`lang: es`), `es-ES` date/number formatting and server error messages translated to neutral Spanish (Spain); error codes unchanged. Checks: server 30 + web 2 tests, typecheck, build; running app returns Spanish messages and bundle has no English copy.
- **L11:** RDD review of 7c247f4..HEAD (risk + readability, standing consent): **approved**, acknowledged (lineage review-4178574de5b09679). Advisories open: R2-001 validation message ignores zod issue text (regex hint never shown); R2-002 4xx fallback hides framework error detail; R2-003 repeated not-found literals; R2-004 `es-ES` hardcoded twice; R2-005 wording "Marcar como hecha" reads as "made", and "comida" means both lunch and meal.
- **L12 (2026-11-17, user, verbatim):** "Sí, corrige los dos puntos". Fixed R2-005: eaten state is now "Consumida" / "Marcar como consumida"; server says "Ya está marcada como consumida…" and "No se encontró esa entrada del menú", so "comida" only means lunch. Fixed R2-001: `server/src/shared/validation-message.ts` turns the first zod issue into "<Campo>: <motivo>" in Spanish (field labels, min/max, enum, format, missing; the regex rule keeps its own hint). RED 4 failing tests → GREEN 31 server + 2 web, typecheck clean.
- **L13 (2026-11-17, user, verbatim):** "Comprueba con gentleai el proyecto y haz los cambios necesarios si los hubiera. Además revisa y rediseña la aplicación completamente para que sea profesional y extremadamente intuitiva tanto en móvil con la app como en pc. Una vez listo rescata el VPS guardado y usado en vipertrade y despliegalo."
- **L14:** gentle-ai check: tests 31+2 green, typecheck clean. Untracked `.atl/` blocked review assessment → ignored (b48fda1). RDD review of c7676a6..484af43 (risk + reliability): **approved**, acknowledged (lineage review-526e227f800c5721). Advisories R3-002 ("1 elementos") and R3-003 (inherited keys as labels) fixed in 402e80a (RED 2 → GREEN 33). R3-001 (not-found wording unasserted) left open.
- **L15:** T9 design plan: per-zone colour identity (fridge mint, freezer ice blue, pantry wheat) on a cool porcelain base with basil accent and dark mode; Bricolage Grotesque + Atkinson Hyperlegible Next (self-hosted for offline PWA); new "Hoy" home screen; mobile bottom tabs + bottom sheets, desktop sidebar, inventory in zone columns, 7×3 planner grid; lucide icons instead of emoji; toasts. Route inline: one coherent UI change, no Writer-trigger reason.
- **L16:** T9 done. Body font switched from Atkinson Hyperlegible Next to Figtree (Atkinson draws a slashed zero, quantities read as "Ø ud."). Desktop planner uses CSS subgrid so meal rows align. Playwright flow (add item + toast, stepper 1→1,5 kg, check shopping entry, plan a meal, back button) passed with no console errors. RDD review 484af43..f423b4a (risk + readability, lineage review-0a6217a25f236a4c): approved; 3 readability advisories fixed in 0928608.
- **L17:** T10 findings: VPS (`vps` = root@185.200.244.169, Ubuntu 22.04, ~1 GB RAM, Node 24.22) has no Docker and nginx owns 80/443 (alejandrorodm.com, app., lifehub.) → deployed like LifeHub instead of docker-compose: system user `kitchen`, `/opt/kitchenstorage/{app,data,.env}`, hardened `kitchenstorage.service` on 127.0.0.1:3232 (MemoryMax 220M, ~85 MB used). Build happens locally (`deploy/deploy.sh`). Invite code generated on the VPS `.env`; GEMINI_API_KEY not set (receipts disabled). RDD review f423b4a..1ffbec1 (risk + resilience, lineage via standing consent): approved; 5 warnings fixed in 5d54257 (XFF overwrite, upload outside /tmp, auto rollback verified with a deliberately broken release, lockfile install). Blocked: no DNS record for a kitchen subdomain; nginx vhost + certbot pending the user's domain choice.
