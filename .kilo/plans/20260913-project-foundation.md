# Global Plan — TODO 02: Project Foundation

> Source TODO: `.agent/todos/20260913/20260913-todo-2.md`
> Branch: `feat/project-foundation` (created in Step 2)
> Front-end related: **NO** for all tasks → sub-steps 4.1a / 4.5a are skipped.

## 1. Task Inventory (TODO Pattern B — numbered `##` sections)

| # | Task | Depends on | Front-end |
|---|------|-----------|-----------|
| T1 | §1 Project Bootstrap (NestJS scaffold, deps, scripts) | — | No |
| T2 | §2 Configuration Module (validated `.env`) | T1 | No |
| T3 | §3 Application Bootstrap `main.ts` (security, logging, pipes, versioning, Swagger, port) | T1, T2 | No |
| T4 | §4 Health Module (`HEAD /health/ping`, public, unversioned) | T3 | No |
| T5 | §5 API Key Guard (`x-api-key`, 401, `@Public()`, Swagger scheme) | T2, T3 | No |

Execution order is strictly **T1 → T2 → T3 → T4 → T5** (each task is code-dependent
on the previous; do not parallelize).

Non-task sections (Goal, Context, §6, §7, §8) are constraints/context only and must be
respected: **no business logic, no persistence libs, no DTOs, no external-service
clients, no unit/e2e test suites in this TODO.**

## 2. Global Pre-Analysis

### 2.1 Repository state (verified)

- `src/` contains only `.gitkeep`; no `package.json`, `tsconfig.json`, `nest-cli.json`.
- Challenge assets at root that MUST NOT be moved/overwritten: `README*.md`,
  `docker-compose.yml`, `config/`, `numerator-api/`, `docs/`, `.agent/`, `.kilo/`, `.opencode/`.
- `node` v22.22.3 / `npm` 10.9.8 available. `.gitignore` already covers `.env*`,
  `node_modules`, `dist/`, `build/`.
- Pending working-tree changes (to be committed in Step 2): deletions of
  `.agent/todos/.gitkeep`, `.kilo/plans/.gitkeep`; untracked TODO-2 file.

### 2.2 Global technical & architecture decisions (binding for all 4.1b plans)

- **G1 — Scaffolding method**: `nest new`/`npx nest generate app` is NOT used (it
  cannot target a non-empty root and tech.md forbids it). Files are scaffolded
  **manually at repo root**: `package.json`, `tsconfig.json`, `tsconfig.build.json`,
  `nest-cli.json`, `src/`, `test/`, `.env.example`, `.env`.
- **G2 — Versions**: NestJS latest stable (v11.x), TypeScript 5.x, Node 22 runtime.
  Exact dependency list/versions decided by architect in T1 plan; install via
  project-local `npm install` only (never global).
- **G3 — Required dev deps** (minimum): `@nestjs/cli`, `typescript`, `ts-node`,
  `@types/node`, `@types/express`, `@types/morgan`, Jest tooling
  (`jest`, `ts-jest`, `@types/jest`, `supertest`, `@types/supertest`), ESLint 9
  flat-config tooling (`eslint`, `typescript-eslint` packages) so `npm run lint`
  works. Prettier is optional; do not add unless lint setup requires it.
- **G4 — Env validation**: `src/config/env.validation.ts` with a class-validator
  decorated class + exported `validate()` consumed by
  `ConfigModule.forRoot({ isGlobal: true, cache: true, validate })` in `AppModule`.
  Must fail fast at bootstrap with a clear error. Numeric env coercion via
  `class-transformer` (`@Type(() => Number)`), NOT `parseInt` scattering.
- **G5 — Env schema**: required: `NODE_ENV` (enum development|production|test),
  `PORT` (int > 0), `NUMERATOR_API_URL` (url), `JSON_SERVER_URL` (url), `API_KEY`
  (non-empty string). Optional additions decided globally:
  `SWAGGER_ENABLED` (boolean-ish `"true"|"false"`, default `true`) and
  `CORS_ORIGINS` (optional comma-separated list; absent ⇒ allow all origins,
  per TODO §3.1 "easy to tighten later"). Both documented in `.env.example`.
- **G6 — Bootstrap order in `main.ts`** (§3): create Nest app → `helmet()` →
  CORS (per G5) → `app.use(morgan(...))` (format `dev` in development,
  `combined` otherwise) → global `ValidationPipe({ whitelist,
  forbidNonWhitelisted, transform })` → `enableVersioning({ type: URI,
  defaultVersion: '1' })` → Swagger (title/description/version, UI at `/docs`,
  gated by `SWAGGER_ENABLED`) → `listen(PORT)` via `ConfigService`.
- **G7 — Versioning**: URI versioning only; **no** `setGlobalPrefix` (versioning
  already yields `/v1/...`). Health is unversioned via `@SkipVersioncheck()`.
- **G8 — Health**: `src/health/` module + controller; `@Controller('health')`,
  `@SkipVersioncheck()`, `@Head('ping')`, `@HttpCode(200)`, empty body, JSDoc
  with the curl example. Public even before guard exists.
- **G9 — API Key Guard**: `src/common/guards/api-key.guard.ts` implementing
  `CanActivate`; `src/common/decorators/public.decorator.ts` (`@Public()` via
  `SetMetadata` + a shared metadata-key constant — no magic strings, per
  "avoid magic numbers" rule). Guard registered **globally** with
  `APP_GUARD` in `AppModule` (cleanest option of TODO §5.2). Reads expected key
  through injected `ConfigService`. Missing/mismatched header →
  `UnauthorizedException` (401). Exact string comparison (documented; no
  hash-based timing hardening needed for this challenge scope).
- **G10 — No placeholder protected route**: per TODO §5.2, registering the guard
  is sufficient. Verification (4.5b) may temporarily add a throwaway protected
  route to prove 401/200 behavior, then remove it and confirm it is not
  committed.
- **G11 — Swagger security scheme**: added in T5 (TODO §5.3): API-key scheme,
  header name `x-api-key` (`apiKey: { name: 'x-api-key', in: 'header' }`),
  applied globally via `addSecurityRequirements`.
- **G12 — Scripts**: `start:dev` (`nest start --watch`), `start:prod`
  (`npm run build && node dist/main`), `build`, `lint` (fix-capable variant is
  fine), `test`, `test:e2e`, `test:cov` with Nest defaults; Jest configured with
  `passWithNoTests: true` so scripts exit 0 since tests come in a later TODO.
  `package.json` `version`: `0.1.0`.
- **G13 — `.gitignore` addition during T1**: append `coverage/` (test:cov
  artifact). No other ignore changes; `.env`, `node_modules`, `dist` already covered.
- **G14 — `.env` vs `.env.example`**: both created locally; only `.env.example`
  is committed. `.env` dev values: `PORT=3001`, `NUMERATOR_API_URL=http://localhost:3000`,
  `JSON_SERVER_URL=http://localhost:8080`, `API_KEY=dev-local-api-key`,
  `NODE_ENV=development`, `SWAGGER_ENABLED=true`.
- **G15 — Project-structure maintenance**: after each task creates folders under
  `src/`, update `.agent/project-structure.md` (Update Workflow in WORKFLOWS.md).
- **G8-R (2026-09-13 CORRIGENDUM, binding; supersedes G8/§T4 wording)**: the decorator
  `@SkipVersioncheck()` cited in G8/G7-adjacent wording **does not exist** in the
  installed NestJS 11.2.3 (verified: `grep SkipVersion` over
  `node_modules/@nestjs/**` → no exports; only `VERSION_NEUTRAL` exists, exported from
  `@nestjs/common`). Health unversioning MUST use
  `@Controller({ path: 'health', version: VERSION_NEUTRAL })` instead. All later
  tasks/plans (T4) bind this mechanism.
- **G16 — Code rules**: all `.kilo/rules/` apply to every produced file
  (≤200 lines/file, ≤50-line methods, ≤2 params, ≤depth 2, private members by
  default, no commented code, self-documenting names).
- **G17 — Out of scope guardrail**: any implementation that touches
  transactions/receivables/numerator/json-server clients, DTOs for payments, or
  test suites is a scope deviation and must be rejected in 4.3/4.5.

### 2.3 Global risks

- R1: `@nestjs/config` validate fn receives string-typed raw env — class-validator
  on `PORT` fails without `transform: true` in `plainToInstance`. T2 plan must
  encode this explicitly (known Nest pitfall).
- R2: Morgan as Express middleware must be registered via `app.use()` **before**
  `app.init/listen`; with versioning it still logs every route. T3 plan must
  place `app.use(morgan(...))` after `ValidationPipe`/CORS registration but
  before listen, and confirm `HEAD /health/ping` still returns 200 empty body.
- R3: Swagger UI paths (`/docs*`) are served outside Nest routing → unaffected by
  APP_GUARD. T5 verification must confirm `/docs` stays reachable without key.
- R4: ESLint 9 + Nest 11 flat config drift. T1 plan must pin a working minimal
  flat config (`eslint.config.mjs`) validated by `npm run lint` passing.

## 3. Per-Task Pre-Analysis

### T1 — Project Bootstrap
- Deliverables: root `package.json` (+ lockfile), `nest-cli.json`,
  `tsconfig.json`, `tsconfig.build.json`, skeleton `src/main.ts`,
  `src/app.module.ts`, `test/` folder placeholder config, `.env.example`, `.env`,
  `coverage/` in `.gitignore`.
- All §1.2 dependencies installed exactly once (later TODOs reuse them).
- Acceptance: `npm run build` and `npm run lint` exit 0; `npm run start:dev`
  boots the empty app on 3001; existing root assets untouched (`git status` clean
  except intended new/modified files).
- Do NOT configure helmet/morgan/validation/versioning/swagger/health yet —
  they belong to T2–T5 cycles.

### T2 — Configuration Module
- Deliverables: `src/config/env.validation.ts`; `AppModule` registers
  global `ConfigModule.forRoot({ validate })`; typed accessor conventions for
  later tasks (inject `ConfigService`).
- Acceptance: app starts with valid `.env`; startup **fails fast with readable
  error** when `PORT` is non-numeric, `JSON_SERVER_URL` malformed, or `API_KEY`
  removed. (Manually toggled locally, never committed.)

### T3 — Application Bootstrap
- Deliverables: full `src/main.ts` per G6; no new modules.
- Acceptance: startup logs with morgan on each request; unknown/typical request
  shows 404 handling default; `/docs` renders (near-empty Swagger); CORS headers
  present; responses include helmet security headers; `PORT` taken from config.

### T4 — Health Module
- Deliverables: `src/health/health.module.ts`, `health.controller.ts`, wired
  into `AppModule`.
- Acceptance: `curl -I http://localhost:3001/health/ping -X HEAD` → `200` with
  **empty body**; endpoint NOT under `/v1`; logged by morgan.

### T5 — API Key Guard
- Deliverables: `src/common/guards/api-key.guard.ts`,
  `src/common/decorators/public.decorator.ts` (+ metadata-key constant location),
  global registration via `APP_GUARD`, `@Public()` on health,
  Swagger `x-api-key` scheme wired in `main.ts`/Swagger factory.
- Suggested structure: put the config key name for the API key in a typed
  constant, reused by guard and `.env` docs.
- Acceptance (G10 method): temporary protected route returns 401 without
  header / with wrong key, 2xx with correct `x-api-key`; health stays 200
  without key; `/docs` reachable; temp route removed afterwards (verified via
  `git diff` before commit).

## 4. Execution Map (each step = one separate `task` invocation)

```text
Step 2: Git Feature Branch Setup                      => implementer
Step 3: Version Update                                => implementer (no-op per G12: package.json not yet present → justified skip, initial 0.1.0 set in T1)
T1: 4.1b Implementation Plan                          => architector   → .kilo/plans/20260913-pf-t1-bootstrap.md
T1: 4.2 Implementation                                => implementer
T1: 4.3 Code Review & Simplification                  => code-reviewer & code-simplifier (fixes => implementer)
T1: 4.4 Documentation                                 => docs-specialist
T1: 4.5b Overall Plan Adherence                       => architector
T1: 4.6 Task Completion ([DONE] + commit)             => implementer
T2: 4.1b → 4.2 → 4.3 → 4.4 → 4.5b → 4.6               (same agent mapping; plan file: 20260913-pf-t2-config.md)
T3: ...                                                               (20260913-pf-t3-bootstrap.md)
T4: ...                                                               (20260913-pf-t4-health.md)
T5: ...                                                               (20260913-pf-t5-api-key-guard.md)
Step 5: TODO File Completion (rename -DONE, merge to main, push origin) => implementer
Step 6: Summary + next-TODO hint                      => planner
```

Per-task 4.1b plans MUST embed: this global plan's G-decisions, the task's
acceptance criteria from §3 above, the `.kilo/rules/` constraints, and a
JUNIOR-developer-proof step list (exact files, snippets, commands, expected
outputs) per critical-workflow §4.1b.

## 5. Approval Gate

- Global plan approval: required now (TODO does not contain the
  auto-approve string).
- Per-task plan approval: user chooses — approve-all-per-task-plans or
  review-each (options below).
