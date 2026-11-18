# Households and admin panel
Objective: turn the single shared kitchen into separate households joined by invite codes, with an admin account and panel to generate codes.
Branch: `feat/households` · Delivery: ask-on-risk · Test runner: Vitest (`npm test`).

## Specs

- **S1 Households** — "A, varias casas". Each household has its own inventory, meal plan and shopping list; a user belongs to exactly one household and never sees or changes another household's data (API and live events).
- **S2 Own household code** — "tener mi propio código para mi casa". Every household has a join code; registering with it adds the new user to that household. Members can see their household (name, code, members) and regenerate the code.
- **S3 Admin-generated codes** — "y generar para quien lo necesite". An admin can generate single-use invite codes; registering with one creates a new household for that user ("Casa de <usuario>"). The admin can list codes (pending / used by whom) and revoke unused ones, and see the list of households.
- **S4 Admin panel** — "me gustaría tener un panel de admin". Admin-only section in the web UI; non-admins get 403 from the admin API and do not see the section.
- **S5 Admin account** — "con mi cuenta ya creada usuario: Alex; contraseña:[redacted]". Created on the server with a CLI command (password never committed); the first admin takes over the pre-existing data (legacy household).
- **S6 Registration stays closed** — "ya decidir en un futuro si abrirlo o no". Registration still requires a valid code; `INVITE_CODE` env var is no longer used.
- **S7 Migration** — existing data (users, items, meals, shopping) moves into one legacy household without loss.

## Tasks

| ID | Specs | Route | Status | Commit |
|----|-------|-------|--------|--------|
| T1 | S1, S7 | inline | done | 88da6e4 — RED: 24 failing (module missing) → GREEN 45 server tests |
| T2 | S2, S3, S5, S6 | inline | done | 88da6e4 (with T1: shared auth/household code) — CLI checked on scratch DB |
| T3 | S2, S3, S4 | inline | done | 1979311 — web typecheck, 7 tests, build; local smoke (admin → invite → register → households) |
| T4 | S5 (deploy + account) | inline | done | deployed 5564d47; admin Alex created on VPS; prod login/household/admin API verified |

Route evidence: no Writer trigger (units depend on each other); parent writes inline. Risk: items 1 (data migration) and 2 (auth, tenant isolation) → independent verifier at feature end.

## Log

- L1 (2026-11-18): "no puedo probar porque necesito un código de invitación para la aplicación (no me parece mal) pero me gustaría tener un panel de admin con mi cuenta ya creada usuario: Alex; contraseña:[redacted] y tener mi propio código para mi casa y generar para quien lo necesite, y ya decidir en un futuro si abrirlo o no"
- L2 (2026-11-18): asked "varias casas (A) o una cocina compartida (B)"; user: "A, varias casas".
- L3: design — tables `households`, `invites`; `household_id` on users/food_items/meals/shopping_items; meals rebuilt for UNIQUE(household_id, date, meal_type); per-request services bound to the household; SSE events filtered by household. Codes: 8 chars from an unambiguous alphabet, stored canonical, shown as XXXX-XXXX.
- L4: T1–T3 done. Native assess over 7dd657a..HEAD: risk high (auth hot path + item 1 escalation), review_due. Independent verifier launched before native review.
- L5: Independent verifier: no blockers, S1–S7 PASS (migration byte-identical, isolation probes 404, invite race 201/403). Advisories kept as follow-ups: meal_allocations statements filter by meal id only (safe while ids are server-checked); household_id columns nullable on altered tables; code generation outside a transaction (UNIQUE backstop).
- L6 (2026-11-18): user: "cuando acabe, despliégalo y crea mi cuenta". Next — native review, DB backup, deploy from branch, create admin on VPS.
- L7: Native review (risk, reliability) approved and acknowledged. Prod DB was empty (v1, 0 rows); backup in /opt/kitchenstorage/backups. Deployed 5564d47 from feat/households; Alex created in "Casa de Alex". Push/PR/merge left to the user.
