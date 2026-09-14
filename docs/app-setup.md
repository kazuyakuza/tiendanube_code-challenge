# Orchestration API — App Setup & Run Guide

Covers **what the codebase does today**: the NestJS 11 application scaffolded in
TODO-02 §1 (Project Bootstrap), the validated environment configuration of
TODO-02 §2 (Configuration Module), the hardened bootstrap of TODO-02 §3 —
helmet, env-driven CORS, morgan request logging, a global validation pipe, URI
versioning and a gated Swagger UI at `/docs` — the public unversioned
health probe of TODO-02 §4, `HEAD /health/ping`, and the global API-key
guard of TODO-02 §5: every NestJS-routed endpoint must send the `x-api-key`
header (missing or wrong → **401**), with `HEAD /health/ping` exempt via
`@Public()`. See [API behavior at this stage](#api-behavior-at-this-stage)
and [Plan references](#plan-references).

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
nothing bypasses validation at listen time. §5 (T5) added a fifth consumer:
the global `ApiKeyGuard` reads `API_KEY` through `ConfigService` on *every*
request — no consumer reads `process.env` directly.

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
| `API_KEY`           | yes      | non-empty string                                     | Key the global `ApiKeyGuard` matches against `x-api-key` on every request (T5, active) | `your-secret-api-key-here` |
| `SWAGGER_ENABLED`   | no       | `"true"` \| `"false"`, default `true`                | Swagger UI (`/docs`) on/off switch — consumed at bootstrap                 | `true`                     |
| `CORS_ORIGINS`      | no       | comma-separated origins; absent/blank ⇒ allow all    | CORS allowlist — consumed by the `main.ts` bootstrap                       | `http://localhost:5173`    |
| `TRANSACTIONS_RETURN_BODY` | no | `"true"` \| `"false"`, default `true`         | When `false`, `POST /v1/transactions` answers a bare `201 CREATED` instead of the full `{ transaction, receivable }` body (TODO-03 §2.4; plumbing only — runtime consumer arrives in TODO-04) | `true` |

**Fail-fast behavior:** with an invalid `.env` the application **refuses to
start**. Validation throws a single `Invalid environment configuration` error
that names **every** offending variable with its violated constraint — for
example `- PORT: PORT must be an integer number` or a missing `API_KEY` — and
points at `.env.example` as the reference. There is no partial startup and no
silent fallback for required variables; fix `.env` and boot again.

**Committed vs. local:** only `.env.example` (placeholders) is committed; your
own `.env` is gitignored. Never put real secrets in `.env.example`.

**Consumed now vs. later:** five variables already have live consumers of
the validated `ConfigService`. The `main.ts` bootstrap (TODO-02 §3,
implemented) reads `PORT` (listen port, `getOrThrow`), `NODE_ENV` (selects
the morgan log format), `CORS_ORIGINS` (CORS allowlist; absent ⇒ allow all)
and `SWAGGER_ENABLED` (mounts `/docs` or not; absent ⇒ enabled); the global
`ApiKeyGuard` (TODO-02 §5, implemented) checks `API_KEY` on every request.
Still validated but **not yet consumed**: the two service URLs
(external-service clients of later TODOs).

## Run modes

| Mode | Command | What happens |
|------|---------|--------------|
| Dev (watch) | `npm run start:dev` | Rebuild + restart on change, listens on the **validated `PORT`** from `.env` (`http://localhost:3001` with the example values) |
| Prod-style | `npm run build && npm run start:prod` | Compile to `dist/`, then run `node dist/main` |

Port `3001` was chosen to avoid conflicts with the provided services
(numerator-api on `3000`, json-server on `8080`).

## API behavior at this stage

With TODO-02 §3–§5 implemented, the HTTP surface behaves as follows
**today**:

- **`HEAD /health/ping` answers `200` with an empty body** (TODO-02 §4 —
  implemented). The route is **unversioned**: the controller declares
  `version: VERSION_NEUTRAL` (global-plan decision G8-R — the installed
  NestJS 11.2.3 has no `@SkipVersioncheck()`), so it lives outside `/v1`.
  It is **public** because the method-level `@Public()` decorator on
  `ping()` exempts it from the now-live global `ApiKeyGuard` (TODO-02 §5,
  T5) — without the decorator the guard would answer this route with `401`.
- **Every other route 404s.** No business controllers are registered yet,
  so any other path — `/`, `/v1/anything`, even `/v1/health/ping` — returns
  the NestJS default 404 (a `GET` on `/health/ping` 404s too: the probe
  answers `HEAD` alone). Guards run only on **matched** routes, so an
  unknown path 404s *before* the API-key check ever happens. Business
  routes from later TODOs will be served under `/v1/...` via URI versioning
  (`defaultVersion: '1'`, deliberately **no** global prefix) — and they
  arrive **protected** automatically: the global guard covers every route it
  matches. The guard itself is live now, but no committed endpoint is
  guard-protected today (the only registered route is the public probe and
  per plan decision G10 no placeholder protected route was committed), so
  `401` becomes observable from outside only once the first `/v1` route
  lands in the next TODO. T5 proved the full 401/200 matrix with a
  throwaway protected route that was deleted before committing (T5 plan
  §10).
- **`/docs` is the one real page** (when Swagger is enabled, the default).
  Swagger serves itself outside the Nest router entirely, so versioning
  never prefixes it and the API-key guard never applies to it — the UI
  stays reachable without a key. The UI lists the health probe as a `head`
  operation on `/health/ping` — deliberately left visible (T4 decision C) —
  and now carries a working **Authorize** button (T5, TODO-02 §5.3): see
  [Authorizing in Swagger UI](#authorizing-in-swagger-ui-x-api-key).
- **Every response — including the health `200` and every 404 — carries helmet
  security headers**
  (e.g. `x-content-type-options: nosniff`, `cross-origin-resource-policy`)
  and passes through the global `ValidationPipe` and CORS middleware.

### The API key guard (`x-api-key`)

`ApiKeyGuard` (`src/common/guards/api-key.guard.ts`) is registered globally
in `src/app.module.ts` through the `APP_GUARD` token. Behavior matrix
(TODO-02 §5.1): **every route requires the `x-api-key` header except
`/health/ping` (`@Public()`); a missing or invalid key → `401` — on matched
routes** (unknown paths 404 before the guard runs, and `/docs` lives
outside it).

- The expected value is `API_KEY` from `.env`, compared with a plain exact
  string match — deliberate for this challenge scope (plan decision G9:
  hashing / timing-safe comparison are out of scope).
- Rejection throws `UnauthorizedException`, so the reply is **401** with
  Nest's JSON body
  `{"statusCode":401,"error":"Unauthorized","message":"Missing or invalid x-api-key header"}`.
  **403 trap:** a guard that merely returned `false` would make Nest answer
  *403 Forbidden* — the throw is what keeps §5.1's "401 Unauthorized" true;
  never "simplify" it into a boolean return.
- A duplicated `x-api-key` header only passes when its **first** value is
  the exact key.
- No committed endpoint is guard-protected at this stage (only the public
  probe is registered; G10 kept the verification placeholder route out of
  the repo), so a live `401` appears the moment the first `/v1` route lands
  in the next TODO. T5 verified the full matrix against a throwaway
  protected route before teardown (T5 plan §10).

Quick probes (PowerShell: `curl` aliases to `Invoke-WebRequest` — always use
`curl.exe`):

```powershell
curl.exe -I http://localhost:3001/health/ping   # 200, empty body — no key sent; @Public() keeps the probe open
curl.exe -i http://localhost:3001/              # 404 + helmet security headers
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3001/v1/health/ping   # 404 — proves the probe is not under /v1
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3001/docs/   # 200 — Swagger UI is not a guarded route
```

The request shape for the protected `/v1` routes of the next TODO — today
they still 404, because no such route is committed yet:

```powershell
curl.exe -i http://localhost:3001/v1/<route>                                  # 401 once <route> exists (no key)
curl.exe -i -H "x-api-key: <API_KEY value from your .env>" http://localhost:3001/v1/<route>   # passes the guard once <route> exists
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

### Authorizing in Swagger UI (`x-api-key`)

T5 (TODO-02 §5.3) wired the OpenAPI side of the guard in `main.ts`
`setupSwagger`: an `API-Key` apiKey scheme (header `x-api-key`) plus a
document-level security requirement, built from the shared constants in
`src/common/api-key.constants.ts`. To authenticate the UI:

1. Open `http://localhost:3001/docs/`.
2. Click the **Authorize** button in the top bar.
3. In the `API-Key` input, paste your local `.env` `API_KEY` value **exactly**
   and confirm.

From then on every **Try it out** call sends `x-api-key: <value>` — the
document-level requirement is what makes the header actually attach
(scheme declarations alone are inert in Swagger UI). Sanity-check the
schema from the CLI without a browser:

```powershell
curl.exe -s http://localhost:3001/docs-json | Select-String 'x-api-key' -SimpleMatch   # shows "name":"x-api-key","in":"header"
```

Cosmetic trade-off (recorded in T5 decision D10): because the security
requirement applies to the whole document, the public health probe also
renders a padlock in the UI — that badge is Swagger chrome only; the
endpoint itself stays guard-exempt.

## Verify

With the app running, check the behavior described in
[API behavior at this stage](#api-behavior-at-this-stage):

```bash
curl -I http://localhost:3001/health/ping
```

Expected: **`HTTP/1.1 200 OK`** with **no body** — the unversioned health
probe (TODO-02 §4), public via `@Public()` under the live API-key guard
(TODO-02 §5), is up. Then:

```bash
curl -i http://localhost:3001/
```

Expected: **`HTTP 404`** — every other unknown route still 404s (a real reply,
not a connection error; matched routes only are guard-checked, so unknown
paths 404 rather than 401) with **helmet security headers** on the response,
and the morgan request line printed on the server console. Note: a live
**401** is not externally observable yet — the guard is active, but no
protected endpoint is committed at this stage (G10); the first `/v1` route of
the next TODO will expose it. Then:

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
- T5 API-key guard plan (§5 guard/decorator/constants, binding decisions
  D1–D12, the G10 temp-route verification protocol in §10 — the throwaway
  protected route it used is deliberately **not** in the repo; includes the
  post-review correction that `APP_GUARD` comes from `@nestjs/core`):
  [`.kilo/plans/20260913-project-foundation-t5-api-key-guard.md`](../.kilo/plans/20260913-project-foundation-t5-api-key-guard.md)
- T1 source TODO: [`.agent/todos/20260913/20260913-todo-2.md`](../.agent/todos/20260913/20260913-todo-2.md) §1;
  T2 source TODO: same file §2; T3 source TODO: same file §3;
  T4 source TODO: same file §4; T5 source TODO: same file §5

## Related docs

- [Challenge statement](../README.md) — original task brief (localized: [es-ar](../README-es-ar.md), [pt-br](../README-pt-br.md)); unchanged by this app work.
- [How to set up Git](how-to-set-up-git.md) — repository/credential setup.
- [How to write TODO files](how-to-write-todo-files.md) — format used by `.agent/todos/`.
- Target architecture of the completed API (status block marks the parts
  already implemented): [`.agent/project-info/architecture.md`](../.agent/project-info/architecture.md).
