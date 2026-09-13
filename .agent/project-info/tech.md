# Tech — Stack, Setup & Constraints

## Stack (per brief.md §2)

| Concern      | Choice                                  |
|--------------|-----------------------------------------|
| Runtime      | Node.js (LTS) + TypeScript              |
| Framework    | NestJS (latest stable)                  |
| HTTP Client  | Axios via `@nestjs/axios`               |
| Config       | `@nestjs/config` + class-validator      |
| Validation   | `class-validator` + `class-transformer` |
| Logging      | `morgan`                                |
| Security     | `helmet` + CORS + API Key guard         |
| Versioning   | URI versioning (`/v1/...`)              |
| Docs         | Swagger (`@nestjs/swagger`), UI `/docs` |
| Testing      | Jest (unit) + Supertest (e2e)           |

## External Services (provided, via docker compose)

| Service       | URL                     | Notes                                   |
|---------------|-------------------------|-----------------------------------------|
| json-server   | `http://localhost:8080` | Fake DB: transactions + receivables     |
| Numerator API | `http://localhost:3000` | Unique sequential ID generation (mock)  |

- `json-server`: image `vimagick/json-server`, serves `config/db.json`.
- `numerator-api`: image `node:20-alpine`, runs `yarn install && node api.js`
  inside `numerator-api/` (dependencies vendored by the container, not committed).
- `tcpdump` sidecar: ngrep capture of port 8080 traffic (debug aid).

## Environment Variables (planned `.env`)

| Variable            | Purpose                        | Example                  |
|---------------------|--------------------------------|--------------------------|
| `PORT`              | App listen port                | `3001`                   |
| `NUMERATOR_API_URL` | Numerator base URL             | `http://localhost:3000`  |
| `JSON_SERVER_URL`   | json-server base URL           | `http://localhost:8080`  |
| `API_KEY`           | Key for `x-api-key` guard      | (local secret)           |
| `NODE_ENV`          | Environment name               | `development`            |

`.env` files are gitignored (see `.gitignore`); never commit secrets.

## Development Setup Commands

1. Start provided services (repo root):
   `docker compose up`
2. Create the app (once scaffolding starts):
   `nest new` is NOT required — scaffold `src/` manually per `brief.md` §6 with
   a root `package.json` managed by npm.
3. Install app dependencies (after root `package.json` exists):
   `npm install`
4. Run the app (after scaffold):
   `npm run start:dev`

## Package Manager Note

- The `numerator-api/` container uses yarn internally; the application code
  uses **npm** (`package-lock.json`). Do not mix managers in the app root.

## Tooling Constraints (project rules — see `.kilo/rules/`)

- Max 200 lines per source file (ideally ≤ 125 excluding blanks/comments/imports).
- Max 50 lines per method body; max indentation depth 2 (extract helpers).
- Max 2 function parameters; more → encapsulate in a typed param object (new file).
- Members private by default; self-documenting names; no commented-out code.
- No global installs; project-local dependencies only.
- All source code lives in `src/`; keep `.agent/project-structure.md` updated.
