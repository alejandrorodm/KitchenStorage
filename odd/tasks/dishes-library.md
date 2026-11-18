# Dish library and fresh AI dish ideas
Objective: a household "Mis platos" section the user fills by hand or with a + on any AI idea, and AI dish ideas inspired by a real recipe database (TheMealDB) while still offering several dishes made with what is at home.
Branch: `feat/dishes-library` · Delivery: single-pr (as in previous features; forecast ~900 authored lines over 3 work-unit commits) · Test runner: Vitest (`npm test`).

## Specs

- **S1 My dishes** — "añade una sección de platos, para poder añadir yo los que quiera". Each household keeps a list of dishes. A dish has a title (required), and optionally a description, minutes, ingredients and steps. Members can create, edit and delete them; the list is shared live with the household's devices. Titles are unique per household (case/accent-insensitive) (assumption: avoids duplicates when pressing + twice).
- **S2 + on AI ideas** — "cuando pregunte a la IA todas las opciones tendrán un botón + para poder añadir estas comidas". Every AI suggestion shows a + button that saves it into My dishes (title, description, minutes, ingredients = uses + missing, steps, source link). Once saved it shows as saved instead of +.
- **S3 Recipe database** — "conecta a la IA de sugerencias de platos a bases de datos de cocina culinaria para dar ideas frescas". Suggestions use TheMealDB (user's choice: free, no account, test key `1`) as inspiration: the stock is translated to English ingredient names, recipes containing them are fetched, and the AI adapts them in Spanish. A suggestion inspired by a recipe links to it. If TheMealDB fails or finds nothing, suggestions still work from the AI alone.
- **S4 Matching dishes first** — "teniendo en cuenta que mínimo hay que dar unos cuantos que cumplan con todos o gran parte de los ingredientes que se tienen". At least 3 of the suggestions use mainly available food (at most 2 non-staple ingredients missing) (assumption: "unos cuantos" = 3, "gran parte" = ≤2 missing). Suggestions are shown with the fewest missing ingredients first.

## Tasks

| ID | Specs | Route | Status | Commit |
|----|-------|-------|--------|--------|
| T1 | S1 | inline | done | e9a6f8c — RED: dishes.test.ts 7 failing → GREEN 99 server; migration v6; assess medium, under_budget |
| T2 | S3, S4 | inline | done | 21acb6c — RED: 8 assistant tests + recipes.test.ts → GREEN 108 server; live probe of TheMealDB returned 5 recipes (e.g. Spanish Tortilla); assess medium, under_budget |
| T3 | S1, S2, S3 | inline | done | 5af65ee — RED: suggestionToDish/splitLines missing → GREEN 17 web; tsc + build OK; no browser check (Chrome extension unavailable) |

Route evidence: one developer, dependent units (T3's web builds on T1/T2's APIs), no Writer trigger reason. Risk: T1 adds migration v6 (item 1, additive table only).

## Log

- **L1** (2026-11-18) user: "además añade una sección de platos, para poder añadir yo los que quiera, y cuando pregunte a la IA todas las opciones tendrán un botón + para poder añadir estas comidas. además conecta a la IA de sugerencias de platos a bases de datos de cocina culinaria para dar ideas frescas (teniendo en cuenta que mínimo hay que dar unos cuantos que cumplan con todos o gran parte de los ingredientes que se tienen)"
- **L2** user chose "TheMealDB (Recommended)" as the recipe database. Probe: `filter.php?i=chicken_breast` and `lookup.php?i=52772` answer JSON with key `1`.
- **L3** UI plan: the existing "Ideas" tab becomes "Platos" with My dishes and the AI ideas (no 6th tab).
- **L4** T1–T3 done; independent verifier launched for the whole feature (migration v6 is item 1).
- **L5** Verifier: S1–S4 pass, no blockers; migration v6 keeps all data (FK check empty, user_version 6). Native review (risk, reliability) approved and acknowledged, advisories only.
- **L6** 15183f7 fixes the verifier advisories: S4 is now enforced (one retry when fewer than 3 ideas need ≤2 purchases, keeping the better answer), saved ingredients cap 60 (30+30 from the AI), racing duplicate titles answer 409. 112 server + 17 web tests pass. Pending: push, PR, merge, deploy (user decision); phone check of the Platos tab.
