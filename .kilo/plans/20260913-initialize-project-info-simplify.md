# Simplification Plan — Initialize Project Info (Task 1, step 4.3)

## Scope

Markdown project-info docs only: `.agent/project-info/brief.md`, `product.md`,
`context.md`, `architecture.md`, `tech.md`.

Goal: remove cross-file duplication that can diverge, by making one file
canonical per fact and linking from the others. No facts are removed; required
facts (fee percentage decision, ports 3000/8080, numerator starts at 3, env
vars, CAS strategy, README discrepancy note, next steps) all remain present in
the repo.

## Canonical sources after this plan

| Fact                    | Canonical location            | Other files                     |
|-------------------------|-------------------------------|---------------------------------|
| Fee rules table         | `brief.md` §3.2 Fee Rules     | `product.md` links              |
| External services/ports | `tech.md` (External Services) | `brief.md` §5 one-line summary  |
| Env variables table     | `tech.md` (Env Variables)     | `brief.md` §4.1 inline names    |
| Project structure tree  | `brief.md` §6 (unchanged)     | `architecture.md` (detail, unchanged) |

## HARD CONSTRAINTS (do not violate)

- Do NOT edit `context.md`, `architecture.md`, or `tech.md`. This plan touches
  ONLY `brief.md` and `product.md`.
- Do NOT touch the `<!-- DO NOT DELETE NEXT SECTION -->` / "Important Note for
  AI Agents" block at the bottom of `brief.md`.
- Do NOT remove any env var name, port number, or fee percentage value from the
  repo. The edits below restate them inline or move them to the canonical file.
- Do NOT modify any other file. No commits beyond what the caller instructs.

---

## Step 1 — brief.md §4.1: collapse env var bullet list

File: `.agent/project-info/brief.md`

Replace (exact current text, lines 69–77):

```markdown
- All configuration via `.env` file.
- Environment variables must be validated at bootstrap using a dedicated class (`class-validator` + `class-transformer`).
- Example variables:
  - `PORT`
  - `NUMERATOR_API_URL`
  - `JSON_SERVER_URL`
  - `API_KEY`
  - `NODE_ENV`
  - etc.
```

With:

```markdown
- All configuration via `.env` file.
- Environment variables must be validated at bootstrap using a dedicated class (`class-validator` + `class-transformer`).
- Variables: `PORT`, `NUMERATOR_API_URL`, `JSON_SERVER_URL`, `API_KEY`, `NODE_ENV` (full table with examples in `tech.md`).
```

Rationale: removes the open-ended "etc." list; variable names stay inline in
brief.md; the authoritative table (with examples) stays in `tech.md`.

## Step 2 — brief.md §5: replace duplicated services table with summary + link

File: `.agent/project-info/brief.md`

Replace (exact current text, lines 101–106):

```markdown
## 5. External Dependencies (provided)

| Service       | Base URL (default)                  | Responsibility                     |
|---------------|---------------------------|------------------------------------|
| json-server   | `http://localhost:8080`   | Transactions & Receivables storage |
| Numerator API | `http://localhost:3000`   | Unique sequential ID generation    |
```

With:

```markdown
## 5. External Dependencies (provided)

- **json-server** at `http://localhost:8080` — transactions & receivables storage.
- **Numerator API** at `http://localhost:3000` — unique sequential ID generation.

> Docker images and setup details: see `tech.md` (External Services).
```

Rationale: ports 3000/8080 remain stated inline in brief.md; the richer table
(images, compose notes) lives only in `tech.md`.

## Step 3 — brief.md line 26: fix table cell alignment (cosmetic)

File: `.agent/project-info/brief.md`

Replace (exact current text, line 26):

```markdown
| Testing                   | Jest (unit) + Supertest (e2e)               |                         |
```

With (empty Notes cell, padded to match the other rows):

```markdown
| Testing                   | Jest (unit) + Supertest (e2e)               |                                            |
```

## Step 4 — product.md: link fee table to brief.md §3.2 instead of duplicating

File: `.agent/project-info/product.md`

Replace (exact current text, lines 26–37):

```markdown
## Fee Rules

| Payment Method | Fee  | Receivable Status | Payment Date       |
|----------------|------|-------------------|--------------------|
| `debit_card`   | 2%   | `paid`            | Same day (D+0)     |
| `credit_card`  | 4%   | `waiting_funds`   | Creation + 30 days |

- `discount` holds the **fee percentage** as a string: `"2"` for debit_card, `"4"`
  for credit_card (matches the seed data in `config/db.json`).
- `total` = `subtotal × (1 − discount/100)`. Example: subtotal "340.50",
  discount "2" → total "333.69" (340.50 × 0.98).
- The fee is calculated based on the transaction's total amount.
```

With:

```markdown
## Fee Rules

The canonical fee rules table (fee %, receivable status, payment date per
payment method) lives in `brief.md` §3.2 — Fee Rules. Do not duplicate it here.

- `discount` holds the **fee percentage** as a string: `"2"` for debit_card, `"4"`
  for credit_card (matches the seed data in `config/db.json`).
- `total` = `subtotal × (1 − discount/100)`. Example: subtotal "340.50",
  discount "2" → total "333.69" (340.50 × 0.98).
- The fee is calculated based on the transaction's total amount.
```

Rationale: single fee table remains (in `brief.md`, the file corrected by the
USER DECISION). product.md keeps its unique content: discount-as-string note,
worked example, seed-data reference. The percentages "2"/"4" remain visible in
product.md via the bullets, so no reader loses the key decision.

---

## Verification (implementer must run all checks)

1. Re-read both edited files; confirm they match the "With" blocks exactly.
2. Grep checks (expectations after edits):
   - `2%` and `4%` appear in exactly ONE table: `brief.md` (product.md keeps
     `"2"`/`"4"` only inside bullet text).
   - `localhost:8080` and `localhost:3000` appear in `tech.md` table, the new
     `brief.md` §5 bullets, and `tech.md` env examples — no third table.
   - `NODE_ENV`, `API_KEY`, `PORT` still present in both `brief.md` (inline) and
     `tech.md` (table).
3. Confirm untouched files unchanged: `context.md`, `architecture.md`, `tech.md`.
4. Confirm the "Important Note for AI Agents" block in `brief.md` is intact.
5. Line counts: both edited files must be ≤ previous counts (they only shrink).

## Out of scope (explicitly NOT simplified, with reason)

- Structure trees (`brief.md` §6 vs `architecture.md`): intentional detail
  layering; `brief.md §6` is a referenced anchor from `tech.md`/`context.md`.
- Security/Observability overlap (`brief.md` §4.2–4.4 vs `architecture.md`):
  requirements vs design — intentional.
- `context.md`: log + required facts; no edits.
- CAS details: single full spec in `architecture.md`; `brief.md` §3.3 summary stays.
