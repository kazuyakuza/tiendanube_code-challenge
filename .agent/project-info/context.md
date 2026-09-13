# Context — Current State

[Project Info: Active]

## Current Work Focus

TODO-02 "Project Foundation" (`.agent/todos/20260913/20260913-todo-2.md`) in
progress on branch `feat/project-foundation`. T1 (§1 bootstrap) and T2 (§2
validated configuration module) are done: the app boots through a global,
cached `ConfigModule` that validates `.env` fail-fast
(`src/config/env.validation.ts` + `src/config/config.keys.ts`). T3 (§3
`main.ts` hardening) is next.

## Recent Changes

- 2026-09-13: Validated configuration module (T2 of TODO-02):
  `src/config/env.validation.ts` (class-validator schema — 5 required vars
  `NODE_ENV`/`PORT`/`NUMERATOR_API_URL`/`JSON_SERVER_URL`/`API_KEY` + optional
  `SWAGGER_ENABLED`/`CORS_ORIGINS`; URL fields require a protocol per plan
  addendum A4-R, so protocol-less base URLs fail at startup) and
  `src/config/config.keys.ts` (`ConfigKeys` constants for later consumers);
  global `ConfigModule.forRoot({ isGlobal, cache, validate })` in
  `AppModule`; fail-fast bootstrap error names every offending variable.
  `main.ts` untouched per decision A9 (still reads `process.env.PORT` until
  T3). Docs: new "Environment configuration" section in `docs/app-setup.md`.

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

1. TODO-02 T3: harden `main.ts` bootstrap — helmet, CORS (`CORS_ORIGINS` via
   `ConfigKeys`), morgan, global `ValidationPipe`, URI versioning, Swagger
   (gated by `SWAGGER_ENABLED`), `ConfigService`-driven PORT (replace the
   temporary `process.env.PORT` + `DEFAULT_PORT` read per decision A9).
2. TODO-02 T4: public unversioned `HEAD /health/ping` module.
3. TODO-02 T5: global `ApiKeyGuard` (`x-api-key`, 401, reads
   `ConfigKeys.ApiKey`) + `@Public()` + Swagger security scheme; then the
   `brief.md` §6 module folders land.
4. Later TODOs: transactions/receivables orchestration, Numerator CAS client
   (`ConfigKeys.NumeratorApiUrl`), json-server client (`ConfigKeys.JsonServerUrl`),
   unit + e2e test suites (see `brief.md` §3).
