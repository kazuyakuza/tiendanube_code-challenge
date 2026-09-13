# Implementation Plan — TODO-02 · T2 Configuration Module (validated `.env`)

> Caller: Planner Agent (Critical Workflow step 4.1b). Implementer: JUNIOR (<50%).
> Sources (read in full before starting):
> - TODO: `.agent/todos/20260913/20260913-todo-2.md` §2 (binding) + §7 (out-of-scope) + §8 (style)
> - Global plan: `.kilo/plans/20260913-project-foundation.md` — decisions **G4, G5, G16, G17** and §3-T2 acceptance are binding here
> - T1 state: branch `feat/project-foundation`; scaffold `a68f4f3`, tsconfig cleanup `2349eca`, docs `eb48d2f`, done-mark `7d41f43`
> - Naming note: global plan §4 suggested `20260913-pf-t2-config.md`; the established convention after T1 is the long form — **this file is the plan**, name kept long-form per caller instruction.

---

## 1. Research findings (verified in repo)

| Fact | Evidence |
|------|----------|
| `@nestjs/config ^4.0.2`, `class-validator ^0.14.2`, `class-transformer ^0.5.1` installed | `package.json` deps — **do NOT re-add any package; zero `npm install` in T2** |
| `validate` contract (installed typings, `node_modules/@nestjs/config/dist/interfaces/config-module-options.interface.d.ts`): `validate?: (config: Record<string, any>) => Record<string, any>` — "takes an object containing environment variables as input and outputs validated environment variables. If exception is thrown in the function it would prevent the application from bootstrapping. Also, environment variables can be edited through this function, changes will be reflected in the process.env object." | Confirms: returning a transformed/coerced object means ConfigService serves **coerced** values (PORT becomes a real `number`); throwing prevents bootstrap |
| NestJS docs idiom for a custom `validate()` function: `plainToInstance(EnvironmentVariables, config)` → `validateSync(instance, { skipMissingProperties: false })` → `throw` on errors → `return instance` | Official docs pattern for class-validator integration; also confirms every env value arrives as a **string** (R1) |
| `envFilePath` default: one `.env` resolved from `process.cwd()` (= repo root when run via npm scripts) | Do **NOT** set `envFilePath`; do **NOT** add dotenv-cli |
| R1 resolution: `@Type(() => Number)` on `PORT` is applied by `plainToInstance`, so the raw string `"3001"` becomes `3001` before `validateSync` runs | G4 mandates class-transformer coercion, forbids `parseInt` scattering. **Chosen over `enableImplicitConversion: true`** because implicit conversion silently coerces *every* string field into numbers/booleans based on declared TS types (broad, surprising behavior), whereas `@Type` is localized to the one numeric field. Follows the binding global decision G4 |
| `.env.example` (committed) already contains all keys: `NODE_ENV`, `PORT`, `NUMERATOR_API_URL`, `JSON_SERVER_URL`, `API_KEY`, `SWAGGER_ENABLED`, commented `CORS_ORIGINS` | Verified content — no edit to `.env.example` needed in T2 |
| Local `.env` (gitignored) currently: `NODE_ENV=development`, `PORT=3001`, `NUMERATOR_API_URL=http://localhost:3000`, `JSON_SERVER_URL=http://localhost:8080`, `API_KEY=dev-local-api-key`, `SWAGGER_ENABLED=true` | Used for sabotage/restore below |
| `tsconfig.json`: `strictNullChecks` only (no `strict`), `emitDecoratorMetadata`, `experimentalDecorators` | Class props without initializers compile; decorators metadata works |
| `eslint.config.mjs`: `tseslint.configs.recommended` | Standard decorator class code lints clean |

## 2. Resolved decisions (binding — do not re-litigate)

- **A1 — Coercion strategy (R1)**: `plainToInstance(EnvironmentVariables, config)` **without** `enableImplicitConversion` + explicit `@Type(() => Number)` on `PORT` only. Justification: G4 names `@Type(() => Number)`; implicit conversion would coerce unrelated string fields by design:type and can mask invalid values (e.g. `PORT=` → `0`). `parseInt` scattering is forbidden.
- **A2 — Required/optional split (G5)**: exactly 5 required (`NODE_ENV`, `PORT`, `NUMERATOR_API_URL`, `JSON_SERVER_URL`, `API_KEY`) + 2 optional (`SWAGGER_ENABLED`, `CORS_ORIGINS`). No defaults for the required ones (TODO mandates enum only, no default).
- **A3 — `SWAGGER_ENABLED` default-true mechanism**: property initializer `SWAGGER_ENABLED: boolean = true` + `@IsOptional()` + `@Transform` mapping the strings `'true'`→`true`, `'false'`→`false`, anything else passes through so `@IsBoolean()` rejects it. Rationale: when the key is absent, `plainToInstance` leaves the initialzier value untouched, so `true` survives deterministically; the class-transformer `Transform` decorator takes precedence over any implicit conversion.
- **A4 — `@IsUrl` option**: `{ require_tld: false }` on both URLs so `http://localhost:3000` / `http://localhost:8080` pass while garbage still fails.
- **A5 — `validate()` signature & return**: `export function validateEnv(config: Record<string, unknown>): EnvironmentVariables` — 1 param (≤2 rule satisfied). Returns the validated instance (official docs pattern; the instance is assignable to `Record<string, any>` expected by `validate`, and ConfigService therefore serves coerced values). Declared keys are all guaranteed present; **unknown process.env keys are not stripped** (harmless pass-through, consistent with docs).
- **A6 — Error contract**: `validateSync(..., { skipMissingProperties: false, whitelist: false })`; on ≥1 error throw `new Error` with every variable name + constraint messages (fail-fast prevents startup — Nest `ConfigModuleOptions.validate` docstring confirms: "If exception is thrown in the function it would prevent the application from bootstrapping").
- **A7 — Key constants (decision (b))**: create `src/config/config.keys.ts` exporting `ConfigKeys` as const. Chosen over (a) literal strings at call sites to satisfy the "avoid magic values" rule; T3 (port read, swagger gate), T5 (api key read) and any later client will use `configService.get(ConfigKeys.PORT)` etc. Zero new strings scattered.
- **A8 — `configuration.ts` skipped**: TODO §2 mandates only `env.validation.ts`; architecture.md's planned `configuration.ts` is **not** created in T2 (no consumer yet; revisit only if a later TODO requires it).
- **A9 — main.ts handoff (explicit)**: T2 does NOT touch `src/main.ts`. Its temporary `Number(process.env.PORT) || DEFAULT_PORT` read keeps working because when `NestFactory.create(AppModule)` initializes modules, `ConfigModule` loads `.env` into `process.env` before main.ts's line 19 executes. T3 will replace it with `ConfigService` + remove `DEFAULT_PORT`.
- **A10 — AppModule is the only existing src file touched**: exactly one import block + one `imports` array entry.

## 3. High-level approach

Add a class-validator validated env schema consumed by a global, cached `ConfigModule.forRoot`; fail-fast at bootstrap with a readable error listing each offending variable; expose canonical env-key constants for later tasks. No changes to `main.ts`, no new dependencies, no version bump, no push, no branch ops (stay on `feat/project-foundation`).

Steps (each = atomic, verifiable):

1. Pre-flight git/branch check.
2. Create `src/config/config.keys.ts`.
3. Create `src/config/env.validation.ts`.
4. Update `src/app.module.ts`.
5. Update `.agent/project-structure.md`.
6. Build/lint/test gates (exit 0).
7. Runtime verification: valid boot on 3001, root path 404.
8. Sabotage tests (3 cases) + manual restore.
9. Commit (`feat:`) with gitignore-compliance check.

---

## 4. Exact steps

### Step 1 — Pre-flight

Run (single command):
```
git status
```
Expected: on branch `feat/project-foundation`; untracked files may include `.agent/todos/20260913/20260913-todo-3.md` (user-owned — **NEVER stage it**) and possibly `node_modules/` (ignored). If NOT on `feat/project-foundation`, STOP and report back (branch ops are out of scope for this step).

Run (single command):
```
git log --oneline -5
```
Expected top commits include `7d41f43 docs: mark TODO-02 task 1 ...`. If history differs, STOP and report.

### Step 2 — Create `src/config/config.keys.ts` (exact content)

```ts
/**
 * Canonical environment-variable key names exposed by ConfigService.
 *
 * Use `ConfigKeys.*` (via `configService.get(ConfigKeys.PORT)`) instead of
 * literal key strings so that a renamed variable is caught by the compiler
 * and instruments stay typo-free. The values must match the keys declared in
 * `src/config/env.validation.ts` and documented in `.env.example`.
 *
 * Consumers: main.ts bootstrap (T3), api-key guard (T5), external-service
 * clients (later TODOs).
 */
export const ConfigKeys = {
  NodeEnv: 'NODE_ENV',
  Port: 'PORT',
  NumeratorApiUrl: 'NUMERATOR_API_URL',
  JsonServerUrl: 'JSON_SERVER_URL',
  ApiKey: 'API_KEY',
  SwaggerEnabled: 'SWAGGER_ENABLED',
  CorsOrigins: 'CORS_ORIGINS',
} as const;

export type ConfigKey = (typeof ConfigKeys)[keyof typeof ConfigKeys];
```

(JSDoc included; ~22 lines incl. doc — under the 20-line code budget, fine. Key casing `NodeEnv` PascalCase property with `'NODE_ENV'` value is deliberate: property names are code identifiers, values are the exact env keys.)

### Step 3 — Create `src/config/env.validation.ts` (exact content)

```ts
/**
 * Validated environment schema consumed by `ConfigModule.forRoot({ validate })`.
 *
 * Every variable a process env/dotenv supplies arrives as a raw STRING, so the
 * `PORT` coercion is done explicitly with class-transformer's `@Type`
 * decorator instead of scattered `parseInt` calls. Validation runs at
 * bootstrap and throwing here prevents the application from starting (see
 * `@nestjs/config` ConfigModuleOptions.validate contract).
 */
import { Transform, Type, plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  validateSync,
  ValidationError,
} from 'class-validator';

export enum NodeEnvironment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(NodeEnvironment)
  NODE_ENV: NodeEnvironment;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  PORT: number;

  @IsUrl({ requireTld: false })
  NUMERATOR_API_URL: string;

  @IsUrl({ requireTld: false })
  JSON_SERVER_URL: string;

  @IsString()
  @IsNotEmpty()
  API_KEY: string;

  @IsOptional()
  @Transform(({ value }) => transformBoolString(value))
  @IsBoolean()
  SWAGGER_ENABLED: boolean = true;

  @IsOptional()
  @IsString()
  CORS_ORIGINS: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validatedEnv = plainToInstance(EnvironmentVariables, config);
  const validationErrors = validateSync(validatedEnv, { skipMissingProperties: false, whitelist: false });
  if (validationErrors.length > 0) {
    throw new Error(buildErrorMessage(validationErrors));
  }
  return validatedEnv;
}

function transformBoolString(value: unknown): unknown {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return value;
}

function buildErrorMessage(errors: ValidationError[]): string {
  const entries = errors.map((error) => {
    const messages = Object.values(error.constraints ?? {});
    return `  - ${error.property}: ${messages.join(', ')}`;
  });
  return `Invalid environment configuration. Fix .env (reference: .env.example):\n${entries.join('\n')}`;
}
```

Notes on names: class-validator exposes `IsUrlOptions` with camelCase `requireTld` (validator.js option); use `requireTld`. `@Type(() => Number)` — zero-parameter arrow, no unused-arg lint risk. Members are public because ConfigService must read them (justified exception to prefer-private rule — validation classes are data holders).

### Step 4 — Update `src/app.module.ts` (exact final content)

```ts
/**
 * Root application module.
 *
 * Registers the global, cached ConfigModule with fail-fast environment
 * validation (TODO-02 §2): `ConfigService` can be injected anywhere without
 * re-importing, and startup aborts with a readable error when a required
 * variable is missing or invalid. Later sections of
 * `.agent/todos/20260913/20260913-todo-2.md` add the health module (§4) and
 * the global API-key guard via `APP_GUARD` (§5). Run guide: `docs/app-setup.md`.
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: (config) => validateEnv(config),
    }),
  ],
})
export class AppModule {}
```

Do NOT set `envFilePath` — the default loads `<repo-root>/.env` (cwd when npm scripts run) and `.env` already exists locally.
Do NOT change `src/main.ts` in this step (decision A9).

### Step 5 — Update `.agent/project-structure.md`

Edit only the `# Folders in src/` section; keep everything else verbatim. Replace:
```
- src/ - NestJS application root: main.ts bootstrap and root AppModule
```
with:
```
- src/ - NestJS application root: main.ts bootstrap and root AppModule
- src/config/ - Validated environment configuration: class-validator env schema (env.validation.ts) and ConfigService key constants (config.keys.ts)
```

### Step 6 — Build / lint / test gates

Run each as a single command; ALL must exit 0:
```
npm run build
```
```
npm run lint
```
```
npm run test:e2e
```
Expected outputs: build silent success into `dist/`; lint only formatting-free pass (script includes `--fix`, so a re-run is expected clean); e2e jest reports "No tests found" exit 0 (`passWithNoTests`).

**Only-if gate** (do not preempt): should `npm run build` report an index-signature assignability error on the `validate: (config) => validateEnv(config)` line (the official docs pattern returns the class instance, and this is expected to compile), STOP and report the exact error text back to the caller — do not invent casts or refactor to `instanceToPlain` on your own.

### Step 7 — Runtime verification (valid .env untouched)

Run (single command; ok to let a tool timeout terminate the running server):
```
npm start
```
Expected output lines (in order): nest compile → logger context modules → `NestFactory` up → **`Nest application successfully started`**.
Then probe (separate terminal/single command):
```
curl -i http://localhost:3001/
```
Expected: `HTTP/1.1 404`, proving the server answers on the `.env` port. This also validates the main.ts handoff: no main.ts change, port still resolved via `process.env.PORT` populated by the module's dotenv load.

Stop the server before continuing.

### Step 8 — Sabotage tests (temporary local changes to gitignored `.env`; NEVER committed)

For each case: manually edit `.env` with the editor tools (no shell text manipulation), run the command, verify error, then apply the restore below before the next case.

Case 8a — missing `API_KEY`:
- Delete the line `API_KEY=dev-local-api-key`.
- Run: `npm start`
- Expected: process exits (non-zero) with an error stack whose message contains `Invalid environment configuration` AND the line `- API_KEY: ...` (e.g. "API_KEY must be a string" / "API_KEY should not be empty" — exact wording from class-validator; the variable name must be present).

Case 8b — non-numeric `PORT`:
- Restore 8a first, then change to `PORT=abc`.
- Run: `npm start`
- Expected: exits with `Invalid environment configuration` containing `- PORT: PORT must be an integer number`. (Chain proof: string → `@Type(() => Number)` → `NaN` → `@IsInt` fails.)

Case 8c — malformed `JSON_SERVER_URL`:
- Restore 8b first, then change to `JSON_SERVER_URL=not-a-url`.
- Run: `npm start`
- Expected: exits with `Invalid environment configuration` containing `- JSON_SERVER_URL: ... must be a URL address`.

Case 8d — restore & final boot:
- Restore `.env` byte-for-byte to exactly:
```env
NODE_ENV=development
PORT=3001
NUMERATOR_API_URL=http://localhost:3000
JSON_SERVER_URL=http://localhost:8080
API_KEY=dev-local-api-key
SWAGGER_ENABLED=true
```
- Run: `npm start` → expected `Nest application successfully started`; stop the server.
- Confirm cleanliness (single command): `git status` → `.env` must NOT appear (gitignored) and nothing from sabotage may leak (run `git diff --stat` to confirm zero diffs).

### Step 9 — Commit

1. Read `.gitignore` and review `git status` — staged set must contain only: `src/config/env.validation.ts`, `src/config/config.keys.ts`, `src/app.module.ts`, `.agent/project-structure.md`. Ensure `.env`, `node_modules/`, `dist/`, and `20260913-todo-3.md` are NOT staged (unstage if any leaked in).
2. `git add src/config/env.validation.ts src/config/config.keys.ts src/app.module.ts .agent/project-structure.md`
3. `git commit -m "feat: validate environment and register global ConfigModule"`

One commit only. No version bump (G12 global: stays 0.1.0), no push, no branch ops.

---

## 5. Documentation handoffs (executed later in this cycle — NOT by the implementer)

- **Step 4.4 (docs-specialist)**: `docs/app-setup.md` §"Environment file" contains the now-stale line "**Current-phase truth:** the app does not read `.env` yet — environment validation is TODO-02 §2 (a later task)…". Replace that paragraph with: the app now boots with a validated `.env` via global ConfigModule; missing/invalid required variables abort startup with an error listing the offending variable; port is served by validated config (main.ts consumes it through `process.env` until T3). Also touch `.agent/project-info/architecture.md` status note (T2 config block now implemented) and refresh `.agent/project-info/context.md` "Immediate Next Steps".
- **Step 4.5b (architector)**: verify adherence to G4/G5/A1–A10 and the TODO §2 acceptance: valid boot + three fail-fast sabotage cases above.

## 6. DoD checklist

- [ ] `src/config/env.validation.ts` and `src/config/config.keys.ts` created with exact contents from §4.
- [ ] `app.module.ts` registers `ConfigModule.forRoot({ isGlobal: true, cache: true, validate })`; only existing src file touched.
- [ ] `.agent/project-structure.md` lists `src/config/`.
- [ ] `npm run build`, `npm run lint`, `npm run test:e2e` all exit 0.
- [ ] Valid `.env` → clean `Nest application successfully started`; `curl -i :3001/` → 404.
- [ ] Sabotage 8a/8b/8c each abort startup with `Invalid environment configuration` naming the exact variable; `.env` restored byte-for-byte; `git diff --stat` empty.
- [ ] Single `feat:` commit; `.env` uncommitted; `20260913-todo-3.md` unstaged; no version bump / push / branch ops.

## 7. Out of scope (deviations must be rejected in 4.3/4.5b)

- Any edit to `src/main.ts` (T3 owns helmet/CORS/morgan/ValidationPipe/versioning/Swagger/`ConfigService` port read).
- `src/config/configuration.ts` or any typed-config factory (A8).
- New dependencies, dotenv-cli, envFilePath customization, validationSchema (Joi/Zod alternative to class-validator `validate`).
- Health module, API-key guard, Swagger wiring, working .env writing beyond sabotage/restore, unit/e2e tests, business logic (transactions/receivables/numerator/json-server) — TODO §7 and G17.
- Pushing, merging, version bumping, TODO-file edits (done-mark is step 4.6, owned by planner's flow).

## Addendum (2026-09-13) — verification decision A4-R: URL validation strictness and corrected sabotage case 8c

Boundary: this addendum supersedes ONLY §4 Step 3 (URL decorator lines) and §4 Step 8 case 8c. All other sections remain in force as originally written.

### 1. Root cause (confirmed by validator.js v13 semantics)

`class-validator` 0.14.x depends on `validator@^13`. In validator.js v13, `isURL(str, options)` defaults `requireProtocol` to `false` and `requireTld` to `true`; with `requireTld: false` only, a string with no `://` such as `not-a-url` is parsed as a bare **host** section, and the default `requireHost` check merely demands a non-empty host — `not-a-url` qualifies as a hostname (hyphen/letters valid, no TLD needed since `requireTld: false`). Therefore `isURL('not-a-url', { requireTld: false })` returns **true** and case 8c as originally written would NOT fail validation. Note: validator.js v13 options are **camelCase** (`requireTld`, `requireProtocol`), matching the decorators below.

### 2. Chosen fix: option (b) — tighten validation, keep sabotage value

Chosen: add `requireProtocol: true`. One decorator change per URL field; the realistic bad value `not-a-url` (no protocol) is rejected while `http://localhost:3000` / `http://localhost:8080` remain valid (protocol present + non-empty host; localhost needs no TLD). Option (a) (retuning only the sabotage value) is rejected: it leaves validation looseness that accepts protocol-less URLs in production config, and its candidate values (`http://`, `localhost:8080`) are fragile/artificial as failure probes.

### 3. Evidence table

Execution environment restriction: command execution was denied for the architect agent at addendum time, so the table states docs-derived results (validator.js v13 documented semantics, as adopted in §1) — the implementer MUST run the one-liner below as a pre-check before editing and confirm every result matches `expected`; on any mismatch, STOP and report to the caller.

| Value | Options | Expected `isURL` |
|-------|---------|------------------|
| `not-a-url` | `{ requireTld: false }` (current code) | `true` ← the reported bug |
| `not-a-url` | `{ requireTld: false, requireProtocol: true }` | `false` |
| `http://localhost:3000` | `{ requireTld: false, requireProtocol: true }` | `true` (must stay valid) |
| `http://localhost:8080` | `{ requireTld: false, requireProtocol: true }` | `true` (must stay valid) |
| `http://` | `{ requireTld: false, requireProtocol: true }` | `false` (empty host fails default `requireHost`) |
| `localhost:8080` | `{ requireTld: false, requireProtocol: true }` | `false` (no protocol) |
| `""` | `{ requireTld: false, requireProtocol: true }` | `false` |

Pre-check one-liner (single command; run from repo root, uses the validator bundled inside class-validator's dependency tree — if `validator` is not directly resolvable, use the path under `node_modules/class-validator/node_modules/validator` if present, else report):
```
node -e "const v=require('validator');for(const [s,o] of [['not-a-url',{requireTld:false}],['not-a-url',{requireTld:false,requireProtocol:true}],['http://localhost:3000',{requireTld:false,requireProtocol:true}],['http://localhost:8080',{requireTld:false,requireProtocol:true}],['http://',{requireTld:false,requireProtocol:true}],['localhost:8080',{requireTld:false,requireProtocol:true}],['',{requireTld:false,requireProtocol:true}]]){console.log(JSON.stringify(s),JSON.stringify(o),'=>',v.isURL(s,o));}"
```

### 4. Final URL decorators (replace the two lines in `src/config/env.validation.ts` class `EnvironmentVariables`)

```ts
  @IsUrl({ requireTld: false, requireProtocol: true })
  NUMERATOR_API_URL: string;

  @IsUrl({ requireTld: false, requireProtocol: true })
  JSON_SERVER_URL: string;
```

Rationale documented for reviewers: `requireTld: false` accepts localhost-style hosts for the challenge-provided services; `requireProtocol: true` rejects protocol-less garbage so a misconfigured base URL fails fast with a readable message instead of surfacing at first HTTP call.

### 5. Corrected sabotage case 8c (replaces §4 Step 8 case 8c)

Case 8c — malformed `JSON_SERVER_URL`:
- Restore 8b first, then change to `JSON_SERVER_URL=not-a-url`.
- Run: `npm start`
- Expected: exits with `Invalid environment configuration` containing `- JSON_SERVER_URL: JSON_SERVER_URL must be a URL address` (class-validator default `@IsUrl` message, prefixed by the variable name).

### 6. Addendum DoD addition

- [ ] Pre-check one-liner output matches the evidence table exactly (all 7 rows) before any source edit.
- [ ] Both URL validators tightened per §4 of this addendum; valid `.env` (`NUMERATOR_API_URL=http://localhost:3000`, `JSON_SERVER_URL=http://localhost:8080`) still boots clean (re-run Step 7).
- [ ] Sabotage 8c re-run with the corrected expectation.
