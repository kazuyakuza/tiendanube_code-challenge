# Context — Current State

[Project Info: Active]

## Current Work Focus

**TODO-04 IN PROGRESS** — external clients (Numerator API + json-server), on
branch `feat/external-clients` (v `0.3.0`). **Task 1 — Numerator client —**
**implemented and documented** (4.2 commits fa9f723 / c18eda4 / b36b53c /
d56eab3; 4.3 review: no fixes; 4.3 simplification: none; 4.4 docs: this cycle).
`src/numerator/` ships `NumeratorService.getNextId()` — CAS retry loop with
10 total attempts by default, retries ONLY genuine conflicts, 20 ms-base /
160 ms-capped backoff, domain error classes — alongside a minimal
`NumeratorModule`. The app still performs **no outbound HTTP at runtime**:
`NumeratorModule` is not yet imported in `AppModule` and the `HttpModule`
timeout config awaits **Task 3** (which must use `HttpModule.register` —
`@nestjs/axios` v4 has no `forRoot`; decision T1-D7); **Task 2**
(json-server client) is not started. Remaining Task 1 steps: 4.5b
plan-adherence (architector) and 4.6 `[DONE]` mark on §Task 1 of
`20260913-todo-4.md` (file stays untracked per G19). TODO-03 and TODO-02
were closed earlier (both merged to `main` and pushed).

## Recent Changes

- 2026-09-13: TODO-04 cycle Task 1 — Numerator client (branch
  `feat/external-clients`; 4.2 commits fa9f723 config knobs, c18eda4 constants
  /errors/interfaces, b36b53c service + module, d56eab3 structure map).
  New `src/numerator/`: `numerator.service.ts` (`getNextId(): Promise<string>`
  per TODO §1.3 — re-`GET` current value every attempt, validate finite
  number + safe-integer candidate, `PUT test-and-set { oldValue, newValue }`,
  retry ONLY genuine conflict (HTTP 400 + numeric `currentNumerator`, plan
  G5; invalid-params 400 fails fast), backoff `min(base × 2^idx, 160 ms)`,
  conflict warn-logs attempt/current/candidate), `numerator.module.ts`
  (minimal, bare `HttpModule` — T1-D1), `numerator.constants.ts` (single
  source for defaults 10/20/160/400 — T1-D5), `errors/numerator.errors.ts`
  (`NumeratorUnavailableError` / `NumeratorRetriesExhaustedError` /
  `InvalidNumeratorValueError`), `interfaces/` (mock wire shapes +
  2-params-rule param objects). Config: OPTIONAL env `MAX_RETRIES` (default
  10) + `NUMERATOR_BASE_BACKOFF_MS` (default 20) validated in
  `env.validation.ts`, `ConfigKeys.MaxRetries` / `NumeratorBaseBackoffMs`,
  commented `.env.example` entries; `NUMERATOR_API_URL` gained its first
  consumer (`getOrThrow` in the service constructor). 4.3: review = NO
  fixes, simplification = NONE. Deviations/decisions T1-D1…T1-D8 per
  plan §5 (T1-D3 structure map pulled into Task 1; T1-D4 standalone
  `isAxiosError` (axios 1.20); T1-D6 architecture reconciliation — landed
  in 4.4; T1-D7 `HttpModule.register` not `forRoot` (v4) — Task 3 input;
  T1-D8 strictNullChecks-safe narrowing). 4.4 docs: JSDoc polish (service
  header mock-source/runbook links; failure-context §refs); `docs/app-setup.md`
  new "External clients (TODO-04)" section (semantics, config flow, curl
  contract exercises transcribed from `numerator-api/api.js` — NOT
  live-verified, services may be down, docker runs only via user), env-table
  rows, status sweeps on "app does not call services yet" wording;
  `architecture.md` T1-D6 revision + cycle entry + tree markers; `tech.md`
  two env rows. Task 2/Task 3 documented strictly as PENDING. 4.5b/4.6 were
  still open when this bullet was written.

- 2026-09-13: TODO-03 cycle TD — transaction DTO & validation contract
  layer (branch `feat/transaction-dtos`; 4.2 commits e73ed43 enums,
  1187b14 `maskCardNumber`, 0718237 custom validators, cfdaf77
  `CreateTransactionDto`, e486a64 response DTOs, 80907e5 env plumbing,
  5af8d3b structure map; 4.3 fix 709835a — public test PAN
  `4111111111111111` request example + matching `'1111'` response example).
  New: `src/common/enums/` (`PaymentMethod`, `ReceivableStatus`),
  `src/common/constants/payment-fee.constants.ts` ("2"/"4" percent
  strings), `src/common/utils/card-number.util.ts`,
  `src/transactions/dto/` request DTO + 3 output-only response DTOs +
  `validators/` (`IsPositiveDecimalString`, `IsFutureExpirationDate` —
  MM/YY end-of-month UTC future validity). `TRANSACTIONS_RETURN_BODY`
  added as optional boolean env (default `true`; `false` ⇒ future bare
  `201 CREATED`), mirroring `SWAGGER_ENABLED` — plumbing only, TODO-04
  owns the consumer. 4.3 review adjudication: docker-scripts /
  `health.controller.ts` findings REJECTED (pre-existing user edits
  checkpointed in step 2 — `30001` in the health curl JSDoc remains a
  flagged user typo, not workflow scope); simplification NONE. 4.4 docs:
  JSDoc headers on every new file, new "DTO & validation layer (TODO-03)"
  section in `docs/app-setup.md`, architecture/context updates. 4.5b
  plan-adherence: ADHERENT WITH ACCEPTED DEVIATIONS. 4.6: `[DONE]` marks
  added to §§1–4. **Not** created (TODO §6): module/controller/service,
  tests, endpoint wiring. Merged to `main` and pushed (step 5).

- 2026-09-13: Global API-key guard (T5 of TODO-02, commit 4ac069f):
  `ApiKeyGuard` (`src/common/guards/api-key.guard.ts`) registered app-wide
  via the `APP_GUARD` provider in `app.module.ts`. Every matched route must
  send `x-api-key` matching env `API_KEY` exactly (plain `===` compare per
  plan G9 — no crypto/timing hardening); missing/wrong key
  → **401** `UnauthorizedException('Missing or invalid x-api-key header')`
  (guard returning `false` would yield 403 — deliberate throw). New
  `@Public()` decorator + shared `IS_PUBLIC_KEY` const
  (`src/common/decorators/public.decorator.ts`), read by the guard via
  `Reflector.getAllAndOverride([handler, class])`, exempts
  `HEAD /health/ping`. Wire-format constants live in
  `src/common/api-key.constants.ts` (`API_KEY_HEADER`, Swagger scheme name
  `API-Key`). Swagger `setupSwagger` adds the `apiKey` scheme +
  document-level security requirement → working **Authorize** button;
  "Try it out" now sends the header (padlock on the public probe is
  cosmetic — T5 decision D10). Guard proven per G10 with a temporary
  protected route that was deleted, never committed. Plan fix recorded:
  the T5 §6 snippet originally imported `APP_GUARD` from `@nestjs/common`;
  it is exported by **`@nestjs/core`** (correction now annotated in the
  plan file). Docs: guard section + Swagger authoring how-to in
  `docs/app-setup.md`; stale "guard not implemented" JSDoc sweeps landed.

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

- TODO-03 is complete: all tasks `[DONE]`, merged to `main`, pushed to
  `origin`. Feature branch `feat/transaction-dtos` deleted post-merge.
  (TODO-02 likewise closed earlier — merged to `main` at `d5abceb`, pushed.)
- Flagged user-owned accepted deviations: (a) `30001` in
  `health.controller.ts` curl JSDoc — pre-existing user typo, not workflow
  scope; (b) `docker:*` scripts in `package.json` — pre-existing user
  edits checkpointed in step 2. Both retained unchanged.

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

1. **Continue TODO-04** (`20260913-todo-4.md` — external clients; note: NOT
   the transactions-orchestration file its controllers/fees are explicitly
   out of scope there; pointer corrected from the stale pre-cycle wording
   of this list): finish Task 1 with 4.5b adherence + 4.6 `[DONE]`, then
   **Task 2 — json-server client** (`createTransaction` /
   `createReceivable`, transport-only payloads, fail-fast on 4xx/5xx) and
   **Task 3 — module registration** (both modules into `AppModule`;
   `HttpModule.register({ timeout: HTTP_TIMEOUT_MS })` per T1-D7/G12;
   structure map per G15) with their full 4.x cycles.
2. Step 5: close TODO-04 — rename `20260913-todo-4.md` with the `-DONE`
   suffix in the working tree ONLY (file is untracked/user-owned per G19),
   merge `feat/external-clients` → `main`, push to `origin` only.
3. Later transactions-orchestration module — makes `POST /v1/transactions`
   reachable (the TODO-03 DTO contract then answers **400** on invalid
   payloads via the global `ValidationPipe` and renders in Swagger `/docs`),
   wires both clients (two IDs reserved before any write), fee math,
   masking on the write path, maps the clients' domain errors to HTTP
   responses (global plan G18) and becomes the first runtime consumer of
   `TRANSACTIONS_RETURN_BODY`. TODO-05 (`20260913-todo-5.md`) exists
   untracked — user-owned, not yet integrated into any workflow.

Both `.agent/todos/20260913/20260913-todo-4.md` and
`.agent/todos/20260913/20260913-todo-5.md` are **UNTRACKED** user-owned
future work — kept out of this workflow and its commits.
