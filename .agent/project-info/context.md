# Context — Current State

[Project Info: Active]

## Current Work Focus

TODO-02 "Project Foundation" (`.agent/todos/20260913/20260913-todo-2.md`) in
progress on branch `feat/project-foundation`. T1 (§1 scaffold), T2 (§2
validated configuration), T3 (§3 hardened `main.ts` bootstrap: helmet,
env-driven CORS, morgan, global ValidationPipe, URI versioning, Swagger at
`/docs` gated by `SWAGGER_ENABLED`, validated `ConfigService` PORT) and T4
(§4 public unversioned `HEAD /health/ping` — `200` with empty body,
unversioned via `VERSION_NEUTRAL`) are done. T5 (§5 global API-key guard +
`@Public()` + Swagger security scheme) is the last task of TODO-02.

## Recent Changes

- 2026-09-13: Public unversioned health probe (T4 of TODO-02, commits f2ee009
  + 7bf9128): new `src/health/` module — `HealthModule` + `HealthController`
  answering `HEAD /health/ping` with `200 OK` and an empty body. Unversioned
  via `version: VERSION_NEUTRAL` on the controller metadata (G8-R: the
  global-plan `@SkipVersioncheck()` does not exist in the installed
  `@nestjs/common`; no `main.ts` change needed). Public **by absence of any
  guard** — when T5 lands, `HealthController` must get `@Public()` to stay
  reachable. Swagger lists the probe (T4 decision C); simplify step moved the
  curl how-to into the `ping()` JSDoc. Docs: "API behavior at this stage" in
  `docs/app-setup.md` corrected (health answers; every other route public
  until T5).

- 2026-09-13: Hardened application bootstrap (T3 of TODO-02, commits 84bfb15
  + 7c78932): `src/main.ts` wires helmet defaults, env-driven CORS
  (`CORS_ORIGINS` CSV allowlist; absent/blank ⇒ allow all), morgan
  (`NODE_ENV`-conditional format: `dev` in development, `combined`
  otherwise), a global `ValidationPipe`
  (whitelist/forbidNonWhitelisted/transform), URI versioning
  `defaultVersion: '1'` (no `setGlobalPrefix`), Swagger UI at `/docs` gated
  by `SWAGGER_ENABLED`, and listens on the validated PORT. All env reads go
  through `ConfigService` + `ConfigKeys` per plan addendum A3-R
  (`getOrThrow` for required keys; `get(key, default)` for `SWAGGER_ENABLED`);
  simplify step S1 folded `splitOrigins` into `resolveCorsOrigins`. Docs: new
  "API behavior at this stage" section in `docs/app-setup.md` (everything
  404s except `/docs` — no controllers yet).

- 2026-09-13: Validated configuration module (T2 of TODO-02):
  `src/config/env.validation.ts` (class-validator schema — 5 required vars
  `NODE_ENV`/`PORT`/`NUMERATOR_API_URL`/`JSON_SERVER_URL`/`API_KEY` + optional
  `SWAGGER_ENABLED`/`CORS_ORIGINS`; URL fields require a protocol per plan
  addendum A4-R, so protocol-less base URLs fail at startup) and
  `src/config/config.keys.ts` (`ConfigKeys` constants for later consumers);
  global `ConfigModule.forRoot({ isGlobal, cache, validate })` in
  `AppModule`; fail-fast bootstrap error names every offending variable.
  `main.ts` untouched per decision A9 (still reads `process.env.PORT` until
  T3 — that temporary read is gone, superseded by the T3 entry above). Docs:
  new "Environment configuration" section in `docs/app-setup.md`.

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

1. TODO-02 T5 (last task): global `ApiKeyGuard` (`x-api-key`, 401, reads
   `ConfigKeys.ApiKey`) + `@Public()` decorator + Swagger security scheme
   (extend the `DocumentBuilder` chain in `main.ts` `setupSwagger` — reserved
   extension point). `HealthController` MUST get `@Public()` so
   `HEAD /health/ping` keeps answering once the guard lands (today it is
   public only because no guard exists); then the `brief.md` §6 module
   folders land.
2. Later TODOs: transactions/receivables orchestration, Numerator CAS client
   (`ConfigKeys.NumeratorApiUrl`), json-server client (`ConfigKeys.JsonServerUrl`),
   unit + e2e test suites (see `brief.md` §3).
3. After TODO-02 closes: user-owned future TODO files
   `.agent/todos/20260913/20260913-todo-3.md` and
   `.agent/todos/20260913/20260913-todo-4.md` exist **UNTRACKED** (kept out of
   this workflow and its commits; the user owns them).
