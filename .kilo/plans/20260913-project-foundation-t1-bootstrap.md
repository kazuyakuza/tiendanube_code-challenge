# Implementation Plan — T1: Project Bootstrap

> Source TODO: `.agent/todos/20260913/20260913-todo-2.md` §1 ONLY.
> Global plan (binding): `.kilo/plans/20260913-project-foundation.md`.
> Branch: `feat/project-foundation` (already created — do NOT create/switch branches).
> Version bump (Critical Workflow step 3): NO-OP — no `package.json` exists yet; initial `0.1.0` is set in this task (per global plan §4).
> Executor: JUNIOR implementer under 50% restriction. Execute steps literally. If a step is ambiguous or blocked, STOP and ask the caller. Do NOT expand scope.

---

## 1. T1 Ambiguity Resolutions (BINDING — no judgment allowed)

| # | Ambiguity | Resolution (binding) | Rationale |
|---|-----------|----------------------|-----------|
| A1 | Jest major version | **Jest 29.x** (`jest ^29.7.0`, `ts-jest ^29.4.0`, `@types/jest ^29.5.14`) | Nest 11 default pairing (Nest CLI 11 itself pins jest 29 / ts-jest 29 in its own devDeps). Jest 30 would require extra config drift. |
| A2 | supertest now or later | **Install now** (`supertest ^7.1.4`, `@types/supertest ^6.0.3`) + `passWithNoTests: true` in BOTH jest configs | Global plan G3 lists supertest as a required dev dep; e2e script stays valid today and works in later TODOs. |
| A3 | ts-node | **OMIT ts-node.** Drop the Nest-default `test:debug` script (it hard-requires ts-node). | `nest build`/`nest start`/`jest+ts-jest` chain does not need ts-node. Minimal devDeps per task prompt. DEVIATION from global plan G3 literal list — recorded here for 4.5b adherence review; accepted by planner instruction in this task prompt. |
| A4 | tsconfig module/target | **`module: "commonjs"`, `target: "ES2021"`** (classic Nest template), NOT Nest 11's `nodenext` template | ts-jest 29 + CJS jest pipeline is bulletproof; nodenext adds ESM friction with zero benefit here. |
| A5 | PORT in T1 `main.ts` | `const port = Number(process.env.PORT) || DEFAULT_PORT;` with `const DEFAULT_PORT = 3001;` | Task prompt G16 instruction. T3 replaces this with `ConfigService` reading. No magic number (rule 13). |
| A6 | Deps listed in §1.2 but used in T2+ (`@nestjs/config`, `class-validator`, `class-transformer`, `@nestjs/axios`, `axios`, `morgan`, `@types/morgan`, `helmet`, `@nestjs/swagger`) | **Installed in T1, NOT wired anywhere in T1.** | TODO §1.2 is T1 scope. Wiring is T2–T5 scope (hard block). |
| A7 | `.env.example` content | Full G14/G5 set: `NODE_ENV`, `PORT`, `NUMERATOR_API_URL`, `JSON_SERVER_URL`, `API_KEY`, `SWAGGER_ENABLED`; `CORS_ORIGINS` documented as a comment line only (absent ⇒ allow all). `.env` mirrors G14 values exactly, without CORS_ORIGINS. | Global plan G5 + G14. Env VALIDATION is T2 — T1 only creates the files. |
| A8 | lint script | `eslint "{src,test}/**/*.ts" --fix` (fix-capable allowed per G12) | G12. |
| A9 | `src/.gitkeep` | **Delete it** (replaced by real source files). | Placeholder no longer needed. |
| A10 | Global plan file commit | Include `.kilo/plans/20260913-project-foundation.md` and this T1 plan file in a separate `docs:` commit before scaffold commit. | Planner instruction (currently untracked). |
| A11 | Package name | `"name": "tiendanube-code-challenge"`, `"private": true`, `"license": "UNLICENSED"` | Repo identity; challenge is not published. |
| A12 | ESLint type-aware linting | Flat config uses `tseslint.configs.recommended` (NOT type-checked) + `parserOptions.projectService: true` as instructed. | `recommended` keeps lint deterministic for a junior executor. |

**Verified versions (npm registry, 2026-09-13):** `@nestjs/core@11.1.9` (latest 11.x; npm `latest` tag now points to 12.x — G2 mandates the 11 line, hence exact 11.x carets), `@nestjs/cli@11.0.10`, `@nestjs/swagger@11.2.1` (peer `@nestjs/core ^11.0.1` ✓), `@nestjs/config@4.0.2` (peer `@nestjs/common ^10 || ^11` ✓ — v12 of the package requires Nest 12-era peer matrix; stay on 4.x for Nest 11), `@nestjs/axios@4.0.1` (peer `^10 || ^11` ✓ — its v12 targets Nest 12), `typescript-eslint@8.x` (peer eslint `^9` ✓), Nest CLI 11 bundles `typescript 5.8.3`.

---

## 2. High-Level Approach

Manually scaffold a minimal, bootable NestJS 11 app at the **repo root** (G1: never run `nest new` / `npx nest generate app`), without touching existing challenge assets (`config/`, `numerator-api/`, `docs/`, `README*.md`, `docker-compose.yml`, `.agent/`, `.kilo/`, `.opencode/`). Steps:

1. Preflight repo state check.
2. Commit the pending global plan + this plan file (`docs:` commit).
3. Write config files: `package.json`, `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`, `eslint.config.mjs`, `test/jest-e2e.json`.
4. Write source skeleton: `src/main.ts`, `src/app.module.ts`; delete `src/.gitkeep`.
5. Write env files: `.env.example` (committed), `.env` (already gitignored).
6. Append `coverage/` to `.gitignore` (G13).
7. `npm install` (project-local only; NEVER global).
8. Verify: `npm run build`, `npm run lint`, `npm test`, `npm run test:e2e` all exit 0; boot check on port 3001 (expect 404 on `/` — no routes yet, proves the app serves).
9. Update `.agent/project-structure.md` (G15).
10. Commit scaffold (`feat:` commit).

**Out of scope HARD BLOCK (later tasks):** helmet, morgan, CORS, ValidationPipe, URI versioning, Swagger, ConfigModule registration/validation, health module, API-key guard, any `.spec.ts`/`.e2e-spec.ts` test files, any business logic, any persistence library.

---

## 3. Detailed Steps

### Step 3.1 — Preflight (verification only, no changes)

Run, in order (PowerShell; single commands):

```powershell
git status
git branch --show-current
```

Expected: branch `feat/project-foundation`; clean tree EXCEPT untracked `.kilo/plans/20260913-project-foundation.md` and this T1 plan file. `src/` contains only `.gitkeep`. If state differs (dirty tree with other files, wrong branch), STOP and report to caller.

### Step 3.2 — Commit pending plan files

```powershell
git add .kilo/plans/20260913-project-foundation.md .kilo/plans/20260913-project-foundation-t1-bootstrap.md
git commit -m "docs: add project foundation global plan and T1 bootstrap plan"
```

Commit ONLY these two files (gitignore-compliance rule: nothing else staged).

### Step 3.3 — Create `package.json` (repo root)

Full exact content:

```json
{
  "name": "tiendanube-code-challenge",
  "version": "0.1.0",
  "description": "NestJS orchestration API for the Tiendanube code challenge",
  "private": true,
  "license": "UNLICENSED",
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  },
  "dependencies": {
    "@nestjs/axios": "^4.0.1",
    "@nestjs/common": "^11.1.9",
    "@nestjs/config": "^4.0.2",
    "@nestjs/core": "^11.1.9",
    "@nestjs/platform-express": "^11.1.9",
    "@nestjs/swagger": "^11.2.1",
    "axios": "^1.7.7",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.2",
    "helmet": "^8.1.0",
    "morgan": "^1.10.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.2"
  },
  "devDependencies": {
    "@eslint/js": "^9.32.0",
    "@nestjs/cli": "^11.0.10",
    "@types/express": "^5.0.0",
    "@types/jest": "^29.5.14",
    "@types/morgan": "^1.9.10",
    "@types/node": "^22.17.0",
    "@types/supertest": "^6.0.3",
    "eslint": "^9.32.0",
    "jest": "^29.7.0",
    "supertest": "^7.1.4",
    "ts-jest": "^29.4.0",
    "typescript": "^5.8.3",
    "typescript-eslint": "^8.46.1"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": ["**/*.(t|j)s"],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node",
    "passWithNoTests": true
  }
}
```

Notes (do not deviate):
- All `@nestjs/*` runtime packages pinned to the 11.x line (G2). `@nestjs/config@^4.0.2` and `@nestjs/axios@^4.0.1` are the majors whose peer ranges accept Nest 11.
- `@types/express@^5.0.0`: Nest 11 ships Express 5 — types major must match.
- No `ts-node`, no `@nestjs/testing`, no prettier packages (A3, minimal per task prompt).
- `test:debug` script intentionally ABSENT (requires ts-node).
- Jest config embedded in `package.json` (Nest default location) with `passWithNoTests: true` and unit `testRegex` for `src/**/*.spec.ts` (G12). No test files are created in T1.

### Step 3.4 — Create `tsconfig.json` (repo root)

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2021",
    "lib": ["ES2021"],
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": true
  }
}
```

### Step 3.5 — Create `tsconfig.build.json` (repo root)

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}
```

### Step 3.6 — Create `nest-cli.json` (repo root)

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

### Step 3.7 — Create `eslint.config.mjs` (repo root)

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['node_modules', 'dist', 'coverage', 'numerator-api'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
```

Notes:
- Minimal flat config for ESLint 9 + typescript-eslint 8. No prettier plugin.
- `projectService: true` resolves each TS file against `tsconfig.json` (which includes `src/` and `test/`; `tsconfig.build.json` only affects builds).
- Do NOT add plugins beyond `@eslint/js` + `typescript-eslint`.

### Step 3.8 — Create `test/jest-e2e.json`

The `test/` directory does not exist yet; create it with this single file (this also satisfies TODO §1.1's `test/` entry and keeps the folder non-empty):

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "passWithNoTests": true
}
```

### Step 3.9 — Create `src/main.ts` (replace nothing; `src/` currently has only `.gitkeep`)

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const DEFAULT_PORT = 3001;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT) || DEFAULT_PORT;
  await app.listen(port);
}

void bootstrap();
```

Rules honored: no magic number (named constant), method under 50 lines, no comments needed, self-documenting. This is the TEMPORARY port read (A5); T3 replaces it with `ConfigService`. Do NOT add helmet/morgan/CORS/pipe/versioning/swagger here.

### Step 3.10 — Create `src/app.module.ts`

```ts
import { Module } from '@nestjs/common';

@Module({})
export class AppModule {}
```

Minimal empty root module. ConfigModule registration is T2 — do NOT add it.

### Step 3.11 — Delete `src/.gitkeep`

```powershell
Remove-Item -LiteralPath "src/.gitkeep"
```

### Step 3.12 — Create `.env.example` (repo root, COMMITTED)

```env
NODE_ENV=development
PORT=3001

# External services (provided by docker-compose)
NUMERATOR_API_URL=http://localhost:3000
JSON_SERVER_URL=http://localhost:8080

# Security
API_KEY=your-secret-api-key-here

# Swagger UI (/docs) on/off switch
SWAGGER_ENABLED=true

# Optional: comma-separated allowed origins. When absent, CORS allows all origins.
# CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

Note: comment lines (`#`) are standard in env files; the "no commented code" rule applies to source code, not `.env*` files. `API_KEY` here is the placeholder from TODO §2.1; the real dev value lives only in `.env`.

### Step 3.13 — Create `.env` (repo root, NOT committed — `.gitignore` already covers `.env`)

```env
NODE_ENV=development
PORT=3001
NUMERATOR_API_URL=http://localhost:3000
JSON_SERVER_URL=http://localhost:8080
API_KEY=dev-local-api-key
SWAGGER_ENABLED=true
```

This file enables booting now; env VALIDATION semantics arrive in T2. T1/T2 split: T1 creates files only, T2 wires validation — do not pre-wire anything.

### Step 3.14 — Append to `.gitignore`

Add exactly these lines at the end of the existing file (G13; `node_modules`, `dist`, `.env` are already covered):

```gitignore

# Test coverage
coverage/
```

### Step 3.15 — Install dependencies

```powershell
npm install
```

Expected: exit 0; creates `node_modules/` and `package-lock.json` at repo root. Project-local install only — NEVER `-g` (never-global-installs rule). On Windows a `@nestjs/core` postinstall (opencollective notice) may print warnings — non-fatal. If `npm install` fails, capture the error and STOP (report to caller).

### Step 3.16 — Verification suite (all must pass, in this order)

1. Build (uses `tsconfig.build.json` via nest cli):
   ```powershell
   npm run build
   ```
   Expected: exit 0; `dist/main.js` and `dist/app.module.js` exist.

2. Lint:
   ```powershell
   npm run lint
   ```
   Expected: exit 0 (may auto-fix trivial style issues — if it modifies `src/*.ts`, re-run `npm run build` to confirm still exit 0 and review the diff before committing).

3. Unit tests (no spec files exist):
   ```powershell
   npm test
   ```
   Expected: exit 0 with "No tests found" message (thanks to `passWithNoTests: true`). MUST NOT be interpreted as failure.

4. E2E tests (no e2e files exist):
   ```powershell
   npm run test:e2e
   ```
   Expected: exit 0, "No tests found".

5. Boot check:
   - Start the app in the background (Kilo `background_process` tool: `npm run start:dev`, readiness pattern `Nest application successfully started`).
   - Then verify HTTP with a single node one-liner:
     ```powershell
     node -e "fetch('http://localhost:3001/').then(r=>{console.log('HTTP',r.status);process.exit(0)}).catch(e=>{console.error(e);process.exit(1)})"
     ```
     Expected output: `HTTP 404` — no routes are registered in T1, a 404 proves the server listens on 3001.
   - Stop the background process (tool `stop` action). Confirm no orphan node processes remain.

### Step 3.17 — Update `.agent/project-structure.md`

Replace the `# Folders in src/` empty placeholder so the file reads (folders only, per its format):

```markdown
# Project Structure

# Folders in src/

- src/ - NestJS application root: main.ts bootstrap and root AppModule
- test/ - e2e Jest config (jest-e2e.json); e2e specs arrive in later TODOs

# Other folders

- .agent/ - agent context: project-info/, todos/, rules/workflow indexes and the structure map
- .kilo/ - Kilo Code integration: agents/, rules/, commands/ and plans/
- .opencode/ - opencode integration: agents/, commands/ and opencode.json
- config/ - json-server db.json seed (port 8080 via docker compose)
- docs/ - Documentation files
- numerator-api/ - provided Express mock sequential-ID service (port 3000)
```

(Keep the existing `# Other folders` content exactly as-is; only the `src/` section changes.)

### Step 3.18 — Commit scaffold

```powershell
git status
git add package.json package-lock.json tsconfig.json tsconfig.build.json nest-cli.json eslint.config.mjs .env.example .gitignore .agent/project-structure.md
git add src
git add test
git commit -m "feat: bootstrap NestJS 11 app skeleton with deps, scripts and tooling"
```

Pre-commit checks (gitignore-compliance rule):
- `git status` must NOT show `node_modules/`, `dist/`, `coverage/`, `.env` as staged.
- `.env.example` IS staged; `.env` IS NOT.
- `src/.gitkeep` deletion is included via `git add src`.
- Only files created/modified in this plan are staged. If `npm run lint` modified `src/*.ts`, those changes are staged too (they are in scope).

Post-commit: `git status` must be clean. Existing challenge assets (`config/`, `numerator-api/`, `docs/`, `README*.md`, `docker-compose.yml`) must show NO modifications (`git diff --stat HEAD` only shows T1 files).

---

## 4. Constraints Checklist (rules compliance)

| Rule | Compliance in this plan |
|------|------------------------|
| Max 200 lines/file (src only) | `main.ts` ~11 lines, `app.module.ts` ~5 lines ✓ |
| Max 50 lines/method | `bootstrap()` ~6 lines ✓ |
| Max 2 params | No methods with >2 params ✓ |
| Max depth 2 | No nesting beyond 1 level ✓ |
| Private members | No class members in T1 skeleton ✓ |
| No commented code | No commented-out code anywhere; `.env*` comment lines are config docs, allowed ✓ |
| Self-documenting names | `DEFAULT_PORT`, `bootstrap`, `AppModule` ✓ |
| Never global installs | `npm install` project-local only ✓ |
| No PowerShell unless last option | Only `git`, `npm`, `node`, `Remove-Item` single commands; prefer dedicated tools for file writes ✓ |
| Newlines | All files written with real newlines ✓ |

---

## 5. Definition of Done

- [ ] Branch is `feat/project-foundation`; two commits exist: `docs: add project foundation global plan and T1 bootstrap plan`, `feat: bootstrap NestJS 11 app skeleton with deps, scripts and tooling`.
- [ ] Root contains: `package.json` (+`package-lock.json`), `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`, `eslint.config.mjs`, `.env.example`, `.env`, `test/jest-e2e.json`, `src/main.ts`, `src/app.module.ts`.
- [ ] `src/.gitkeep` deleted.
- [ ] `.gitignore` ends with `coverage/` section.
- [ ] `package.json` version `0.1.0`; scripts: `build`, `start`, `start:dev`, `start:debug`, `start:prod`, `lint`, `test`, `test:watch`, `test:cov`, `test:e2e`.
- [ ] All §1.2 dependencies present in `package.json` (exact majors per A1/A6 and Step 3.3).
- [ ] `npm run build` exit 0, `dist/main.js` produced.
- [ ] `npm run lint` exit 0.
- [ ] `npm test` and `npm run test:e2e` exit 0 ("No tests found").
- [ ] Boot check: app listens on 3001, `GET /` returns 404, process stopped cleanly.
- [ ] `.agent/project-structure.md` updated with `src/` and `test/` entries.
- [ ] `git status` clean; challenge assets untouched; `.env` NOT committed; `node_modules/`, `dist/`, `coverage/` NOT staged.

## 6. Explicitly Out of Scope (HARD BLOCK — deviations rejected in 4.3/4.5)

- `nest new` / `npx nest generate app` / any generator invocation.
- helmet, morgan, CORS, `ValidationPipe`, URI versioning, Swagger — none configured in T1.
- `ConfigModule.forRoot`, `env.validation.ts`, env validation of any kind.
- Health module, API-key guard, decorators.
- Any `*.spec.ts` / `*.e2e-spec.ts` files.
- Business logic, DTOs, HTTP clients wired to Numerator/json-server, persistence libraries.
- Git push (restricted to Step 5 of the Critical Workflow), branch creation/switch, version bump beyond initial `0.1.0` inside `package.json`.
