# Orchestration API — App Setup & Run Guide

Covers **what the codebase does today**: the NestJS 11 application scaffolded in
TODO-02 §1 (Project Bootstrap). Features from later sections of
`.agent/todos/20260913/20260913-todo-2.md` (validated config, security/logging
middleware, Swagger, health endpoint, API-key guard) are **not implemented yet**
and are not documented here. See [Plan references](#plan-references).

## Table of Contents

- [Prerequisites](#prerequisites)
- [External services](#external-services)
- [Install](#install)
- [Environment file](#environment-file)
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

`.env` is gitignored; `.env.example` is the only committed env file and carries
only placeholder/example values (see its comments for each key: `NODE_ENV`,
`PORT`, `NUMERATOR_API_URL`, `JSON_SERVER_URL`, `API_KEY`, `SWAGGER_ENABLED`,
and the optional `CORS_ORIGINS` note).

**Current-phase truth:** the app does not read `.env` yet — environment
validation is TODO-02 §2 (a later task). Right now `src/main.ts` listens on the
`PORT` **process environment variable** if set, otherwise on the built-in
default `3001`. Creating `.env` now just prepares the values consumed once §2
lands.

## Run modes

| Mode | Command | What happens |
|------|---------|--------------|
| Dev (watch) | `npm run start:dev` | Rebuild + restart on change, listens on `http://localhost:3001` |
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
- T1 bootstrap plan (this guide's scope):
  [`.kilo/plans/20260913-project-foundation-t1-bootstrap.md`](../.kilo/plans/20260913-project-foundation-t1-bootstrap.md)
- T1 source TODO: [`.agent/todos/20260913/20260913-todo-2.md`](../.agent/todos/20260913/20260913-todo-2.md) §1

## Related docs

- [Challenge statement](../README.md) — original task brief (localized: [es-ar](../README-es-ar.md), [pt-br](../README-pt-br.md)); unchanged by this app work.
- [How to set up Git](how-to-set-up-git.md) — repository/credential setup.
- [How to write TODO files](how-to-write-todo-files.md) — format used by `.agent/todos/`.
- Target architecture of the completed API (planned, not implemented):
  [`.agent/project-info/architecture.md`](../.agent/project-info/architecture.md).
