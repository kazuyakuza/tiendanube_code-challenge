# Context — Current State

[Project Info: Active]

## Current Work Focus

TODO-02 "Project Foundation" (`.agent/todos/20260913/20260913-todo-2.md`) in
progress on branch `feat/project-foundation`. T1 (§1 bootstrap) is done: a
minimal bootable NestJS 11 app exists (`src/main.ts`, `src/app.module.ts`, root
tooling configs). T2 (§2 validated configuration module) is next.

## Recent Changes

- 2026-09-13: Scaffolded NestJS 11 foundation (T1 of TODO-02): root
  `package.json`/lockfile, `tsconfig{,.build}.json`, `nest-cli.json`,
  `eslint.config.mjs`, `test/jest-e2e.json`, minimal `src/main.ts` +
  `src/app.module.ts`, `.env.example` (+ local `.env`), `.gitignore`
  `coverage/`; build/lint/tests verified exit 0. Run guide:
  `docs/app-setup.md`.
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

1. TODO-02 T2: `src/config/env.validation.ts` + global `ConfigModule.forRoot`
   with fail-fast validation (`PORT`, `NUMERATOR_API_URL`, `JSON_SERVER_URL`,
   `API_KEY`, `NODE_ENV`, per tech.md env table).
2. TODO-02 T3: harden `main.ts` bootstrap — helmet, CORS, morgan, global
   `ValidationPipe`, URI versioning, Swagger, `ConfigService`-driven port.
3. TODO-02 T4: public unversioned `HEAD /health/ping` module.
4. TODO-02 T5: global `ApiKeyGuard` (`x-api-key`, 401) + `@Public()` +
   Swagger security scheme; then the `brief.md` §6 module folders land.
5. Later TODOs: transactions/receivables orchestration, Numerator CAS client,
   json-server client, unit + e2e test suites (see `brief.md` §3).
