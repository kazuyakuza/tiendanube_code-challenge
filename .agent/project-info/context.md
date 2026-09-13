# Context — Current State

[Project Info: Active]

## Current Work Focus

Bootstrapping the project information set and the NestJS application defined in
`brief.md`. No application code exists yet: `src/` contains only `.gitkeep`.

## Recent Changes

- 2026-09-13: Project info initialized. Created `product.md`, `context.md`,
  `architecture.md`, `tech.md`; removed `.initialized` marker; fixed
  `brief.md` §3.2 Fee Rules.
- 2026-09-13: USER DECISION — `discount` is the **fee percentage**
  (debit_card → "2", credit_card → "4", stored as string), not a fee amount.
  `total` = `subtotal × (1 − discount/100)`. `brief.md` was corrected accordingly.

## Recorded Facts

- The Numerator mock (`numerator-api/numerator.js`) starts at value **3**; the
  json-server seed (`config/db.json`) already holds ids "1"–"3" for both
  `transactions` and `receivables`, so the next generated IDs will be "4", "5", …
- json-server conventions: string ids, string numeric values (e.g. `"340.50"`),
  masked card numbers (last 4 digits), receivable fields `status`, `create_date`,
  `subtotal`, `discount`, `total`, `transaction_id`.
- Known discrepancy: the `README.md` receivable example (subtotal "250",
  discount "10", total "240") reads as an amount and contradicts the adopted
  percentage interpretation (which would yield "240" only for a 4% fee of
  subtotal 250 → total "240"). The USER DECISION above prevails: treat
  `discount` as a percentage. The README example is superseded.

## Immediate Next Steps

1. Scaffold the NestJS app per `brief.md` §6 structure (modules: `config`,
   `common`, `health`, `transactions`, `numerator`, `json-server`).
2. Configure environment validation (`@nestjs/config` + class-validator) for
   `PORT`, `NUMERATOR_API_URL`, `JSON_SERVER_URL`, `API_KEY`, `NODE_ENV`.
3. Implement Numerator client with test-and-set CAS retry loop (see
   `architecture.md`).
4. Implement `POST /v1/transactions` orchestration + receivable fee rules.
5. Add security (helmet, CORS, API key guard), morgan logging, Swagger at `/docs`.
6. Unit + e2e tests (Jest + Supertest).
