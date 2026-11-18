# Food categories and AI helpers
Objective: group food items into household categories (seeded with the basics), let the AI pick categories (receipts and a "classify" button) and suggest dishes from what is in stock.
Branch: `feat/food-categories-ai` · Delivery: single-pr (assumption, as in previous features; ~1.4k lines across 3 work-unit commits) · Test runner: Vitest (`npm test`).

## Specs

- **S1 Categories** — "crea secciones para los alimentos (proteínas, verduras, frutas)". Every household has categories; each food item may belong to one (or none). The inventory can be viewed grouped by category.
- **S2 Default categories** — "crea tu primero las fundamentales". New and existing households start with: Proteínas, Verduras, Frutas, Lácteos, Cereales y pasta, Legumbres, Bebidas, Salsas y condimentos, Dulces y snacks (assumption: this exact list).
- **S3 Custom categories** — "podré crear categorías nuevas si quiero". Members can create, rename and delete categories; deleting one leaves its items without a category. Names are unique per household (case/accent-insensitive).
- **S4 Receipt categories** — "al escanear un ticket con IA que me ponga automáticamente la categoría que considere por producto dentro de las que hay". The receipt reader receives the household's categories and assigns one of them (or none) per line; the review screen shows and lets the user change it; confirming stores it (a merged item keeps its own category unless it had none).
- **S5 AI classify button** — "pon un botón de IA en los alimentos para que los que no tengan sección poder encajonarlos". A button in the food page classifies every uncategorized item into an existing category; items the AI cannot place stay uncategorized. Already categorized items are never changed.
- **S6 Dish suggestions** — "además una sección para recomendaciones de platos de IA". A section where the AI suggests dishes using the available stock (optionally guided by a free-text wish), each with the ingredients it uses, what is missing and short steps; missing ingredients can be added to the shopping list.
- **S7 Without AI** — when GEMINI_API_KEY is not set, categories still work by hand; AI actions answer 503 and the UI explains it is not configured.

## Tasks

| ID | Specs | Route | Status | Commit |
|----|-------|-------|--------|--------|
| T1 | S1, S2, S3 | inline | done | 6761b32 — RED: categories.test.ts module missing → GREEN 73 server + 12 web; native review (risk, reliability) approved + acknowledged |
| T2 | S4, S5, S7 | inline | done | 4a2df38 — RED: assistant.test.ts module missing → GREEN 86 server; 3 receipt tests updated for the new `category` field; assess: medium, under_budget. Includes the /api/dishes/suggest server endpoint (shared assistant module) |
| T3 | S6, S7 | inline | done | b433a02 — web Ideas page + normalizeForMatch (RED: module missing → GREEN 13 web); assess: medium, under_budget |

Route evidence: one developer, sequential dependent units (T2/T3 build on T1's categories and the AI adapter), no Writer trigger reason. Risk: T1 adds migration v5 (item 1) — independent verifier at the feature end.

## Log

- **L1** (2026-11-18) — "crea secciones para los alimentos (proteínas, verduras, frutas) y al escanear un ticket con IA que me ponga automáticamente la categoría que considere por producto dentro de las que hay. podré crear categorías nuevas si quiero pero crea tu primero las fundamentales y pon un botón de IA en los alimentos para que los que no tengan sección poder encajonarlos y además una sección para recomendaciones de platos de IA"
- **L2** (2026-11-18) — T1–T3 implemented. Visual browser check not done (Chrome extension not connected); local API smoke on a scratch DB confirmed default categories, item category assignment and the 503 `ai_disabled` answer without GEMINI_API_KEY. Real Gemini calls not exercised locally (no local .env); adapters covered by stubbed-fetch tests.
- **L3** (2026-11-18) — Independent verifier: S1–S7 PASS, no blockers (migration v5 probed on a baseline-built v4 DB and a v1 DB: no data loss, 9 categories per household, FK check empty, idempotent; household isolation and unchanged existing outputs except the new `categoryId`). Advisory applied: migration v5 now seeds a frozen name list instead of the live DEFAULT_CATEGORIES.
