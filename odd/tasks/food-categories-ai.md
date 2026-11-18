# Food categories and AI helpers
Objective: group food items into household categories (seeded with the basics), let the AI pick categories (receipts and a "classify" button) and suggest dishes from what is in stock.
Branch: `feat/food-categories-ai` · Delivery: ask-on-risk · Test runner: Vitest (`npm test`).

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
| T1 | S1, S2, S3 | inline | pending | |
| T2 | S4, S5, S7 | inline | pending | |
| T3 | S6, S7 | inline | pending | |

Route evidence: one developer, sequential dependent units (T2/T3 build on T1's categories and the AI adapter), no Writer trigger reason. Risk: T1 adds migration v5 (item 1) — independent verifier at the feature end.

## Log

- **L1** (2026-11-18) — "crea secciones para los alimentos (proteínas, verduras, frutas) y al escanear un ticket con IA que me ponga automáticamente la categoría que considere por producto dentro de las que hay. podré crear categorías nuevas si quiero pero crea tu primero las fundamentales y pon un botón de IA en los alimentos para que los que no tengan sección poder encajonarlos y además una sección para recomendaciones de platos de IA"
