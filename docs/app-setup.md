# Orchestration API — App Setup & Run Guide

Covers **what the codebase does today**: the NestJS 11 application scaffolded in
TODO-02 §1 (Project Bootstrap), the validated environment configuration of
TODO-02 §2 (Configuration Module), the hardened bootstrap of TODO-02 §3 —
helmet, env-driven CORS, morgan request logging, a global validation pipe, URI
versioning and a gated Swagger UI at `/docs` — plus the public unversioned
health probe of TODO-02 §4, `HEAD /health/ping` (see
[API behavior at this stage](#api-behavior-at-this-stage)). The API-key guard
(§5) is **not implemented yet**; until it lands, every route — health
included — is public. See [Plan references](#plan-references).

## Table of Contents

- [Prerequisites](#prerequisites)
- [External services](#external-services)
- [Install](#install)
- [Environment file](#environment-file)
- [Environment configuration](#environment-configuration)
- [Run modes](#run-modes)
- [API behavior at this stage](#api-behavior-at-this-stage)
- [Verify](#verify)
- [npm scripts](#npm-scripts)
- [Plan references](#plan-references)
- [Related docs](#related-docs)

## Prerequisites

- **Node.js LTS v22+** (verified with v22.22.3) with **npm 10+** (verified with 10.9.8). The app uses npm (`package-lock.json`); do not mix package managers at the repo root.
- **Docker** — required only for the provided services below. No other databases or services are needed.

## External services

The challenge ships two mock services plus a debug sidecar, defined in
`docker-compose.yml` at the repo root. Start them from the repo root:

```bash
docker compose up
```

| Service       | URL                     | Role                                   |
|---------------|-------------------------|----------------------------------------|
| json-server   | `http://localhost:8080` | Fake DB: transactions + receivables    |
| Numerator API | `http://localhost:3000` | Sequential ID generation (mock)        |

The NestJS app does **not** talk to these services yet (wired in later TODOs).

## Install

```bash
npm install
```

Project-local install only — never global. Creates `node_modules/` and
`package-lock.json` at the repo root.

## Environment file

Copy the template and adjust values as needed:

```bash
cp .env.example .env
```

`.env` is gitignored (local only); `.env.example` is the only committed env
file and carries only placeholder/example values (see its comments for each
key: `NODE_ENV`, `PORT`, `NUMERATOR_API_URL`, `JSON_SERVER_URL`, `API_KEY`,
`SWAGGER_ENABLED`, and the optional `CORS_ORIGINS` note).

**Current-phase truth:** the app loads and validates `.env` at startup and now
**consumes** it. The global `ConfigModule` (TODO-02 §2, implemented) reads
`.env` during bootstrap — before the listening port is resolved — and every
variable below is validated then. As of §3 (T3, implemented) the hardened
`src/main.ts` reads `PORT`, `NODE_ENV`, `CORS_ORIGINS` and `SWAGGER_ENABLED`
exclusively through the validated `ConfigService` + `ConfigKeys`; the former
temporary direct `process.env.PORT` read (with its `3001` fallback) is gone, so
nothing bypasses validation at listen time.

## Environment configuration

The schema lives in `src/config/env.validation.ts` (class-validator) and is
enforced at bootstrap by the global, cached `ConfigModule.forRoot({ validate })`
registered in `src/app.module.ts`. Environment consumers inject `ConfigService`
and reference keys through `ConfigKeys` (`src/config/config.keys.ts`) — never
literal key strings (see `brief.md` §4.1 and global-plan decisions G4/G5).

| Variable            | Required | Rules / default                                      | Purpose                                                                    | Example                    |
|---------------------|----------|------------------------------------------------------|----------------------------------------------------------------------------|----------------------------|
| `NODE_ENV`          | yes      | enum: `development` \| `production` \| `test`        | Environment name; also selects the morgan log format (`dev` vs `combined`) | `development`              |
| `PORT`              | yes      | integer > 0 (coerced from the raw env string)        | App listen port — consumed by the `main.ts` bootstrap                      | `3001`                     |
| `NUMERATOR_API_URL` | yes      | valid URL **including protocol** (TLD not required)  | Numerator API base URL (future client wiring)                              | `http://localhost:3000`    |
| `JSON_SERVER_URL`   | yes      | valid URL **including protocol** (TLD not required)  | json-server base URL (future client wiring)                                | `http://localhost:8080`    |
| `API_KEY`           | yes      | non-empty string                                     | Key the future `x-api-key` guard will check (T5 — not yet active)          | `your-secret-api-key-here` |
| `SWAGGER_ENABLED`   | no       | `"true"` \| `"false"`, default `true`                | Swagger UI (`/docs`) on/off switch — consumed at bootstrap                 | `true`                     |
| `CORS_ORIGINS`      | no       | comma-separated origins; absent/blank ⇒ allow all    | CORS allowlist — consumed by the `main.ts` bootstrap                       | `http://localhost:5173`    |

**Fail-fast behavior:** with an invalid `.env` the application **refuses to
start**. Validation throws a single `Invalid environment configuration` error
that names **every** offending variable with its violated constraint — for
example `- PORT: PORT must be an integer number` or a missing `API_KEY` — and
points at `.env.example` as the reference. There is no partial startup and no
silent fallback for required variables; fix `.env` and boot again.

**Committed vs. local:** only `.env.example` (placeholders) is committed; your
own `.env` is gitignored. Never put real secrets in `.env.example`.

**Consumed now vs. later:** the `main.ts` bootstrap (TODO-02 §3, implemented)
already consumes four variables through the validated `ConfigService`:
`PORT` (listen port, `getOrThrow`), `NODE_ENV` (selects the morgan log
format), `CORS_ORIGINS` (CORS allowlist; absent ⇒ allow all) and
`SWAGGER_ENABLED` (mounts `/docs` or not; absent ⇒ enabled). Still validated
but **not yet consumed**: `API_KEY` (its consumer is the API-key guard of §5,
T5 — not implemented) and the two service URLs (external-service clients of
later TODOs).

## Run modes

| Mode | Command | What happens |
|------|---------|--------------|
| Dev (watch) | `npm run start:dev` | Rebuild + restart on change, listens on the **validated `PORT`** from `.env` (`http://localhost:3001` with the example values) |
| Prod-style | `npm run build && npm run start:prod` | Compile to `dist/`, then run `node dist/main` |

Port `3001` was chosen to avoid conflicts with the provided services
(numerator-api on `3000`, json-server on `8080`).

## API behavior at this stage

With TODO-02 §3 and §4 implemented, the HTTP surface behaves as follows
**today**:

- **`HEAD /health/ping` answers `200` with an empty body** (TODO-02 §4 —
  implemented). The route is **unversioned**: the controller declares
  `version: VERSION_NEUTRAL` (global-plan decision G8-R — the installed
  NestJS 11.2.3 has no `@SkipVersioncheck()`), so it lives outside `/v1`.
  It is **public** simply because no guard exists yet; TODO-02 §5 (T5) will
  register the API-key guard and exempt this route with `@Public()`.
- **Every other route 404s.** No business controllers are registered yet,
  so any other path — `/`, `/v1/anything`, even `/v1/health/ping` — returns
  the NestJS default 404 (a `GET` on `/health/ping` 404s too: the probe
  answers `HEAD` alone). Business routes from later TODOs will be served
  under `/v1/...` via URI versioning (`defaultVersion: '1'`, deliberately
  **no** global prefix). The T5 guard (§5) is what will eventually make
  `API_KEY` observably enforced; until then **all routes are public**.
- **`/docs` is the one real page** (when Swagger is enabled, the default).
  Swagger serves itself outside the versioned router, so versioning never
  prefixes it. The UI lists the health probe as a `head` operation on
  `/health/ping` — deliberately left visible (T4 decision C).
- **Every response — including the health `200` and every 404 — carries helmet
  security headers**
  (e.g. `x-content-type-options: nosniff`, `cross-origin-resource-policy`)
  and passes through the global `ValidationPipe` and CORS middleware.

Quick probes (PowerShell: `curl` aliases to `Invoke-WebRequest` — always use
`curl.exe`):

```powershell
curl.exe -I http://localhost:3001/health/ping   # 200, empty body
curl.exe -i http://localhost:3001/              # 404 + helmet security headers
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3001/v1/health/ping   # 404 — proves the probe is not under /v1
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3001/docs/   # 200
```

(`-I` makes curl send a HEAD request and print only the response headers —
required for the health probe, which answers `HEAD` alone. `-i` prints status
+ headers for the generic 404 check; `-s -o NUL -w "%{http_code}"` prints only
the status code. The `/docs/` URL needs the trailing slash — the bare `/docs`
answers a 301 redirect.)

Each probe also prints a morgan line on the server console, e.g.:

```text
GET / 404 150 - 3.421 ms
```

Meaning (dev format): method, path, status, response size in bytes, elapsed
time. In `production`/`test` the `combined` format replaces this with the
Apache-style line (client IP, timestamp, request, status, size, referrer,
user-agent).

### Enabling / disabling Swagger (`/docs`)

`SWAGGER_ENABLED` is optional and defaults to `true`; only `false` disables
the UI. Set it in `.env`:

```env
SWAGGER_ENABLED=false
```

or override per-process without touching any file (process env wins over
`.env` in `ConfigService`):

```powershell
$env:SWAGGER_ENABLED = 'false'; npm run start:dev
Remove-Item Env:SWAGGER_ENABLED   # back to the .env/default value
```

Confirm either state from another terminal:

```powershell
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3001/docs/   # 200 when enabled, 404 when disabled
```

## Verify

With the app running, check the behavior described in
[API behavior at this stage](#api-behavior-at-this-stage):

```bash
curl -I http://localhost:3001/health/ping
```

Expected: **`HTTP/1.1 200 OK`** with **no body** — the unversioned, public
health probe (TODO-02 §4) is up. Then:

```bash
curl -i http://localhost:3001/
```

Expected: **`HTTP 404`** — every other unknown route still 404s (a real reply,
not a connection error) with **helmet security headers** on the response, and
the morgan request line printed on the server console. Then:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/docs/
```

Expected: **`200`** with the default configuration (`SWAGGER_ENABLED` unset
or `true`); see the Swagger subsection above for the disabled case.

Quality gates (all must exit `0`):

```bash
npm run build
npm run lint
npm test
npm run test:e2e
```

`npm test` and `npm run test:e2e` exit `0` with **"No tests found"**: the Jest
configs set `passWithNoTests: true` because unit/e2e suites are explicitly out
of scope for TODO-02 and arrive in later work.

## npm scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `build` | `nest build` | Compile TS → `dist/` (uses `tsconfig.build.json`) |
| `start` | `nest start` | Run without watch |
| `start:dev` | `nest start --watch` | Dev watch mode |
| `start:debug` | `nest start --debug --watch` | Debug inspector + watch |
| `start:prod` | `node dist/main` | Run compiled output (build first) |
| `lint` | `eslint "{src,test}/**/*.ts" --fix` | Lint (flat config: `eslint.config.mjs`) |
| `test` / `test:watch` / `test:cov` | `jest …` | Unit config embedded in `package.json` (`src/**/*.spec.ts`) |
| `test:e2e` | `jest --config ./test/jest-e2e.json` | e2e config (`test/`) |

## Plan references

- Global plan (TODO-02, binding decisions G1–G17):
  [`.kilo/plans/20260913-project-foundation.md`](../.kilo/plans/20260913-project-foundation.md)
- T1 bootstrap plan (scaffold scope):
  [`.kilo/plans/20260913-project-foundation-t1-bootstrap.md`](../.kilo/plans/20260913-project-foundation-t1-bootstrap.md)
- T2 configuration plan (env schema, decisions A1–A10 + A4-R URL strictness):
  [`.kilo/plans/20260913-project-foundation-t2-config.md`](../.kilo/plans/20260913-project-foundation-t2-config.md)
- T3 bootstrap plan (§3 hardening, decisions A–N + addendum A3-R ConfigService
  call-site patterns: `getOrThrow` for required keys, `get(key, default)` for
  `SWAGGER_ENABLED`):
  [`.kilo/plans/20260913-project-foundation-t3-bootstrap.md`](../.kilo/plans/20260913-project-foundation-t3-bootstrap.md)
- T3 simplification plan (S1: `splitOrigins` folded into `resolveCorsOrigins`):
  [`.kilo/plans/20260913-project-foundation-t3-simplify.md`](../.kilo/plans/20260913-project-foundation-t3-simplify.md)
- T4 health plan (§4 probe; decision G8-R unversioning via `VERSION_NEUTRAL`,
  Swagger-visibility decision C):
  [`.kilo/plans/20260913-project-foundation-t4-health.md`](../.kilo/plans/20260913-project-foundation-t4-health.md)
- T4 simplification plan (health curl how-to moved into `ping()` JSDoc):
  [`.kilo/plans/20260913-project-foundation-t4-simplify.md`](../.kilo/plans/20260913-project-foundation-t4-simplify.md)
- T1 source TODO: [`.agent/todos/20260913/20260913-todo-2.md`](../.agent/todos/20260913/20260913-todo-2.md) §1;
  T2 source TODO: same file §2; T3 source TODO: same file §3;
  T4 source TODO: same file §4

## Related docs

- [Challenge statement](../README.md) — original task brief (localized: [es-ar](../README-es-ar.md), [pt-br](../README-pt-br.md)); unchanged by this app work.
- [How to set up Git](how-to-set-up-git.md) — repository/credential setup.
- [How to write TODO files](how-to-write-todo-files.md) — format used by `.agent/todos/`.
- Target architecture of the completed API (status block marks the parts
  already implemented): [`.agent/project-info/architecture.md`](../.agent/project-info/architecture.md).
