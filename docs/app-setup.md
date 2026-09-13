# Orchestration API — App Setup & Run Guide

Covers **what the codebase does today**: the NestJS 11 application scaffolded in
TODO-02 §1 (Project Bootstrap) plus the validated environment configuration of
TODO-02 §2 (Configuration Module). Features from later sections of
`.agent/todos/20260913/20260913-todo-2.md` (security/logging middleware,
Swagger, health endpoint, API-key guard) are **not implemented yet** and are not
documented here. See [Plan references](#plan-references).

## Table of Contents

- [Prerequisites](#prerequisites)
- [External services](#external-services)
- [Install](#install)
- [Environment file](#environment-file)
- [Environment configuration](#environment-configuration)
- [Run modes](#run-modes)
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

**Current-phase truth:** the app now loads and validates `.env` at startup. The
global `ConfigModule` (TODO-02 §2, implemented) reads `.env` during bootstrap —
before the listening port is resolved — and every variable below is validated
then. One temporary nuance remains until §3 (T3): `src/main.ts` still reads the
port directly from `process.env.PORT` (falling back to `3001`) instead of via
`ConfigService`; the `.env` value reaches `process.env` through the
`ConfigModule` load, so the documented behavior already holds.

## Environment configuration

The schema lives in `src/config/env.validation.ts` (class-validator) and is
enforced at bootstrap by the global, cached `ConfigModule.forRoot({ validate })`
registered in `src/app.module.ts`. Environment consumers inject `ConfigService`
and reference keys through `ConfigKeys` (`src/config/config.keys.ts`) — never
literal key strings (see `brief.md` §4.1 and global-plan decisions G4/G5).

| Variable            | Required | Rules / default                                      | Purpose                                        | Example                  |
|---------------------|----------|------------------------------------------------------|------------------------------------------------|--------------------------|
| `NODE_ENV`          | yes      | enum: `development` \| `production` \| `test`        | Environment name                               | `development`            |
| `PORT`              | yes      | integer > 0 (coerced from the raw env string)        | App listen port                                | `3001`                   |
| `NUMERATOR_API_URL` | yes      | valid URL **including protocol** (TLD not required)  | Numerator API base URL                         | `http://localhost:3000`  |
| `JSON_SERVER_URL`   | yes      | valid URL **including protocol** (TLD not required)  | json-server base URL                           | `http://localhost:8080`  |
| `API_KEY`           | yes      | non-empty string                                     | Key the future `x-api-key` guard will check    | `your-secret-api-key-here` |
| `SWAGGER_ENABLED`   | no       | `"true"` \| `"false"`, default `true`                | Swagger UI (`/docs`) on/off switch             | `true`                   |
| `CORS_ORIGINS`      | no       | comma-separated origins; absent ⇒ allow all origins  | CORS allowlist                                 | `http://localhost:5173`  |

**Fail-fast behavior:** with an invalid `.env` the application **refuses to
start**. Validation throws a single `Invalid environment configuration` error
that names **every** offending variable with its violated constraint — for
example `- PORT: PORT must be an integer number` or a missing `API_KEY` — and
points at `.env.example` as the reference. There is no partial startup and no
silent fallback for required variables; fix `.env` and boot again.

**Committed vs. local:** only `.env.example` (placeholders) is committed; your
own `.env` is gitignored. Never put real secrets in `.env.example`.

**Validation vs. consumption:** validation of all seven variables is active
**now** (TODO-02 §2). Their *consumers* arrive in upcoming steps:
`PORT`/`CORS_ORIGINS`/`SWAGGER_ENABLED` are used by the hardened `main.ts`
bootstrap in §3 (T3), `API_KEY` is enforced by the API-key guard in §5 (T5),
and the two service URLs are consumed by the Numerator/json-server clients in
later TODOs.

## Run modes

| Mode | Command | What happens |
|------|---------|--------------|
| Dev (watch) | `npm run start:dev` | Rebuild + restart on change, listens on the **validated `PORT`** from `.env` (`http://localhost:3001` with the example values) |
| Prod-style | `npm run build && npm run start:prod` | Compile to `dist/`, then run `node dist/main` |

Port `3001` was chosen to avoid conflicts with the provided services
(numerator-api on `3000`, json-server on `8080`).

## Verify

With the app running, probe the root path:

```bash
curl -i http://localhost:3001/
```

Expected: **`HTTP 404`** — the server is up and answering, but no routes are
registered yet at this stage (a real reply, not a connection error).

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
- T1 source TODO: [`.agent/todos/20260913/20260913-todo-2.md`](../.agent/todos/20260913/20260913-todo-2.md) §1;
  T2 source TODO: same file §2

## Related docs

- [Challenge statement](../README.md) — original task brief (localized: [es-ar](../README-es-ar.md), [pt-br](../README-pt-br.md)); unchanged by this app work.
- [How to set up Git](how-to-set-up-git.md) — repository/credential setup.
- [How to write TODO files](how-to-write-todo-files.md) — format used by `.agent/todos/`.
- Target architecture of the completed API (planned, not implemented):
  [`.agent/project-info/architecture.md`](../.agent/project-info/architecture.md).
