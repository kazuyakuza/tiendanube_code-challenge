# Task Plan — T3: Application Bootstrap (`main.ts`) — TODO-02 §3

> Source TODO: `.agent/todos/20260913/20260913-todo-2.md` §3 (only §3.1–§3.6; §4/§5 belong to T4/T5)
> Global plan: `.kilo/plans/20260913-project-foundation.md` (G6, G7, R2; T3 acceptance in §3 of that plan)
> Branch: `feat/project-foundation` (already created — NO branch/checkout steps here; commit only)
> Front-end related: NO.

## 0. Verified repository state (pre-research done by architect — implementer does NOT re-verify)

- `src/main.ts` = T1 skeleton (23 lines): `DEFAULT_PORT`, `process.env.PORT` read, stale header JSDoc claiming ".env NOT loaded" and "temporary env read" — both now false; delete/replace in Step 2.
- `src/app.module.ts` already registers `ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv })` — DO NOT TOUCH IT.
- `src/config/config.keys.ts` exports `ConfigKeys` = `{ NodeEnv, Port, NumeratorApiUrl, JsonServerUrl, ApiKey, SwaggerEnabled: 'SWAGGER_ENABLED', CorsOrigins: 'CORS_ORIGINS' }` — ALL keys T3 needs already exist. **No keys-file diff required.**
- `src/config/env.validation.ts` exports the `NodeEnvironment` enum (`Development = 'development'`) and validates `PORT` (`@Type(() => Number)`, `@IsInt`, `@Min(1)` → ConfigService serves it as `number`), `CORS_ORIGINS` (optional string), `SWAGGER_ENABLED` (optional, transformed to real boolean, default `true`).
- `package.json`: `@nestjs/common@^11.1.9`, `@nestjs/core@^11.1.9`, `@nestjs/swagger@^11.2.1`, `helmet@^8.1.0`, `morgan@^1.10.0`, `@types/morgan@^1.9.10` — all deps present. helmet ships its own types (`node_modules/helmet/index.d.cts` verified); **no `@types/helmet` and none needed**.
- `tsconfig.json`: `esModuleInterop: true`, `module: commonjs` — therefore **default imports work**: `import helmet from 'helmet'` and `import morgan from 'morgan'` both compile. No namespace-import workaround needed.
- Local `.env` (gitignored): `NODE_ENV=development`, `PORT=3001`, `SWAGGER_ENABLED=true`, no `CORS_ORIGINS` (⇒ allow-all).
- `.env.example` already documents `SWAGGER_ENABLED` and commented `CORS_ORIGINS` — DO NOT TOUCH IT.

## 1. Binding decisions resolved by the architect (A–N from caller; each = ONE choice + rationale)

| # | Decision | Resolution (binding) | Why |
|---|----------|----------------------|-----|
| A | Helper placement | **Single file `src/main.ts`**, 4 helpers (`bootstrap`, `resolveCorsOrigins`, `resolveHttpLogFormat`, `setupSwagger`). NO `src/common/`, NO helper file. | All helpers are bootstrap-only, cohesive, and the final file is ~105 lines (incl. JSDoc) — under the 200-line file limit and near the 125-line ideal. Creating `common/` is explicitly out of scope (G17-adjacent). `max-args ≤ 2` holds: every helper takes ≤ 2 params. |
| B | Types for helmet/morgan | helmet v8 bundled types; `@types/morgan` already in devDeps (T1). Nothing to install. | Verified on disk (helm `index.d.cts` present; `@types/morgan` in package.json). |
| C | Import style | Default imports: `import helmet from 'helmet'`, `import morgan from 'morgan'`. | `esModuleInterop: true` verified. Namespace imports (`import * as`) are the pre-interop style; never-propose-PowerShell rule is irrelevant here but compile check (Step 3 gate) settles it. |
| D | Imports for pipes/versioning/swagger | `ValidationPipe`, `VersioningType` from `@nestjs/common` (both valid in Nest 11); `DocumentBuilder`, `SwaggerModule` from `@nestjs/swagger`; `INestApplication` type also from `@nestjs/common`. | Verified against installed Nest 11 / swagger 11 packages. |
| E | Config keys | Use ONLY existing `ConfigKeys.Port`, `ConfigKeys.NodeEnv`, `ConfigKeys.CorsOrigins`, `ConfigKeys.SwaggerEnabled`. **No edits to `config.keys.ts`** (its JSDoc "consumption map" already anticipates exactly these consumers; updating that JSDoc is optional — see Step 2.5). | File read confirms all four entries exist. |
| F | morgan format selection | Helper `resolveHttpLogFormat(nodeEnv?: string): 'dev' | 'combined'`; compare against `NodeEnvironment.Development` (enum from `env.validation.ts`) — no `'development'` magic string. Single `if` (one condition) then implicit else-return: satisfies single-section-boolean rule and depth ≤ 2. `'combined'` is the default for production AND test. | G6 + magic-string rule + F constraint. |
| G | Swagger metadata | Constants in-file: `SWAGGER_TITLE = 'Tiendanube Code Challenge — Orchestration API'`, `SWAGGER_DESCRIPTION = 'NestJS orchestration API that coordinates the external services of the Tiendanube code challenge.'`, `SWAGGER_VERSION = '1.0'`, `SWAGGER_UI_PATH = 'docs'`. No `addServer` (minimal per TODO §3.5 "almost empty"); do NOT read package.json for version (extra coupling for zero value in a challenge). | Reasonable constants, named to satisfy no-magic-string rule; SEC (avoid spelling)… title spells "Tiendanube" correctly. `version: '1.0'` mirrors the `defaultVersion: '1'` URI prefix. |
| H | Shutdown hooks | NOT enabled. No `app.enableShutdownHooks()`, no SIGTERM handling, no explicit `app.close()`. | TODO §3 does not require it; recorded as a deliberate non-choice for 4.5b. |
| I | Verification | Suite in Step 4 (build/lint/test → morgan+404 proof → Swagger on → Swagger off via env-var) using `curl.exe` (PowerShell `curl` is an alias for `Invoke-WebRequest` — always use `curl.exe`). Expect honest 404s: **no routes exist yet**, so `GET /`, `GET /v1/x` and `GET /health/ping` all 404 — that proves boot, helmet headers, morgan logging, and port; versioning's route-level effect is proven in T4 (documented limitation, not a defect). temp-route ban stands. Env sabotage via **shell env var override** (`$env:SWAGGER_ENABLED='false'; npm run start:dev` — process.env precedes .env in ConfigService; one PowerShell invocation, two statements), so `.env`/`.env.example`/git tree are never mutated. | .env edit+restore carries a committed-file risk; env-var override is safer for a junior. |
| J | Out of scope | Listed in §6 of this plan (guards, health, dirs, deps, version bump, push, `.env*` edits, app.module edits). | Caller constraint J. |
| K | JSDoc | New `main.ts` header JSDoc (Step 2.1) replaces the stale one and states CURRENT truth (env IS validated; boot order; T4 @SkipVersioncheck interplay note). One short T5-extension point comment on `setupSwagger`. Per-helper JSDoc: one line each. | Caller constraint K; stale-claim removal is mandatory. |
| L | API research | Verified against installed packages at plan time (not live docs): Nest 11 `enableVersioning({ type, defaultVersion })` + `VersioningType.URI` valid; `@nestjs/swagger@11` `DocumentBuilder().setTitle().setDescription().setVersion().build()` + `SwaggerModule.createDocument/setup` valid; helmet defaults (incl. CSP) kept as-is — fine for a JSON API per TODO §3.1 "sensible defaults". | Empirically grounded; build gate (Step 4.1) is the compile-time backstop. |
| M | Cross-check | Step 6 compares final tree/diff against TODO §3 + G6/G7; deltas go to §7 deviations register. | — |
| N | Commits | Exactly ONE feat commit (Step 5): plan file + `src/main.ts` in the same commit. Message: `feat: harden bootstrap with helmet, CORS, morgan, validation, versioning and swagger`. gitignore-compliance check before staging. No version bump (package.json 0.1.0 unchanged). | Caller constraint N. |

Additional bindings inherited from G6/G7/R2: ordering is exactly create → helmet → CORS → morgan → ValidationPipe → versioning → Swagger → listen(port); morgan must be registered via `app.use()` BEFORE `app.listen` (R2); port read is `configService.get<number>(ConfigKeys.Port)` (validated number, no `Number(...)` coercion, no fallback constant — validation guarantees it, so `DEFAULT_PORT` is deleted).

## 2. Implementation steps (junior-proof, sequential)

### Step 2.1 — Rewrite `src/main.ts`

Replace the ENTIRE content of `src/main.ts` with this exact final content (real newlines; ~105 lines):

```ts
/**
 * Application entry point (TODO-02 §3).
 *
 * Boot order, all AFTER `NestFactory.create(AppModule)`:
 * helmet → CORS → morgan → global ValidationPipe → URI versioning →
 * Swagger UI (gated by SWAGGER_ENABLED) → listen on the validated PORT.
 *
 * Configuration is read only through the validated `ConfigService` +
 * `ConfigKeys` (TODO-02 §2): PORT arrives as a coerced integer, CORS_ORIGINS
 * as an optional comma-separated allowlist (absent ⇒ all origins allowed),
 * SWAGGER_ENABLED as a real boolean (absent ⇒ true).
 *
 * Versioning interplay: URI versioning prefixes controllers with `/v1`
 * (`defaultVersion: '1'`); the unversioned health endpoints (TODO-02 §4, T4)
 * must opt out with `@SkipVersioncheck()` in their own cycle.
 *
 * Run guide: `docs/app-setup.md`.
 */
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import morgan from 'morgan';
import { AppModule } from './app.module';
import { ConfigKeys } from './config/config.keys';
import { NodeEnvironment } from './config/env.validation';

/** DocumentBuilder metadata (TODO-02 §3.5). T5 (§5.3) adds the x-api-key scheme. */
const SWAGGER_TITLE = 'Tiendanube Code Challenge — Orchestration API';
const SWAGGER_DESCRIPTION =
  'NestJS orchestration API that coordinates the external services of the Tiendanube code challenge.';
const SWAGGER_VERSION = '1.0';
const SWAGGER_UI_PATH = 'docs';

/**
 * Creates, configures and starts the application (TODO-02 §3).
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(helmet());
  app.enableCors({ origin: resolveCorsOrigins(configService.get<string>(ConfigKeys.CorsOrigins)) });
  app.use(morgan(resolveHttpLogFormat(configService.get<string>(ConfigKeys.NodeEnv))));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  if (configService.get<boolean>(ConfigKeys.SwaggerEnabled)) {
    setupSwagger(app);
  }

  await app.listen(configService.get<number>(ConfigKeys.Port));
}

/**
 * Maps CORS_ORIGINS to the `origin` option: absent/blank ⇒ `true` (allow all,
 * dev-friendly); otherwise the trimmed, non-empty origin list. Tightening for
 * production is a one-line .env change (see .env.example).
 */
function resolveCorsOrigins(rawOrigins?: string): string[] | boolean {
  if (!rawOrigins) {
    return true;
  }
  const origins = splitOrigins(rawOrigins);
  return origins.length > 0 ? origins : true;
}

/**
 * Splits a comma-separated CORS_ORIGINS value into trimmed, non-empty origins.
 */
function splitOrigins(rawOrigins: string): string[] {
  return rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

/**
 * Chooses the morgan format: concise `dev` in development, full `combined`
 * otherwise (production and test). Express middleware registered before
 * listen, so every incoming HTTP request — including 404s and the
 * unversioned health endpoint — is logged to stdout (global plan risk R2).
 */
function resolveHttpLogFormat(nodeEnv?: string): 'dev' | 'combined' {
  if (nodeEnv === NodeEnvironment.Development) {
    return 'dev';
  }
  return 'combined';
}

/**
 * Builds and mounts the Swagger UI at `/docs` (TODO-02 §3.5). Deliberately a
 * standalone function so T5 (TODO-02 §5.3) can extend the DocumentBuilder
 * chain with the x-api-key security scheme without reshaping this file.
 */
function setupSwagger(app: INestApplication): void {
  const swaggerConfig = new DocumentBuilder()
    .setTitle(SWAGGER_TITLE)
    .setDescription(SWAGGER_DESCRIPTION)
    .setVersion(SWAGGER_VERSION)
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(SWAGGER_UI_PATH, app, swaggerDocument);
}

void bootstrap();
```

> Implementer notes:
> - Delete `const DEFAULT_PORT = 3001;` and the old `process.env.PORT` read entirely (covered by replacing the whole file).
> - `INestApplication` comes from `@nestjs/common` (re-exported). If `npm run build` errors on that import (Step 3 gate), the ONLY permitted fallback is importing the type from `@nestjs/core`; report it in the deviations register.
> - Depth check: no block nests deeper than 2; every `if`/`if-else` is single-condition; every function ≤ 2 params and ≤ 50-line body; file ≤ 200 lines (counted incl. JSDoc).

### Step 2.2 — No other source changes

- `src/app.module.ts`, `src/config/config.keys.ts`, `src/config/env.validation.ts`, `.env.example`, `.env`, `package.json`, `tsconfig.json`, `.agent/project-structure.md`: **UNTOUCHED** (no new folders ⇒ G15 structure file needs no update this task).

### Step 2.3 (optional, only if lint complains) — no lint fix expected

If `npm run lint -- --fix` reorders imports (eslint sorting rule if configured), accept its output as long as import semantics stay identical; otherwise leave the file as written.

## 3. Static gates (Step 3)

Run from repo root (each is a single command):

| # | Command | Expected |
|---|---------|----------|
| 3.1 | `npm run lint` | exit 0, no output (or only pre-existing warnings) |
| 3.2 | `npm run build` | exit 0; `dist/main.js` produced |
| 3.3 | `npm test` | exit 0 (`passWithNoTests: true`) |

If 3.2 fails on the `INestApplication` import: apply the one permitted fallback (§2 NOTE) and re-run.

## 4. Runtime verification suite (Step 4) — capture outputs for the completion summary

Prerequisite: `.env` as committed state (`SWAGGER_ENABLED=true`, no `CORS_ORIGINS`). Never edit `.env`. Use PowerShell.

### 4.1 Boot (Swagger ON, default env)

```powershell
npm run start:dev
```

Expected console (before any request):
- Nest banner `Nest application successfully started` / morgan stream wired.
- **No** validation error. If `Invalid environment configuration.` appears → STOP, do not "fix" .env; report to caller.

Keep this process running for 4.2–4.4 (watch mode: subsequent edits restart it — make NO source edits during verification).

### 4.2 Anonymous GET → helmet + morgan + 404

```powershell
curl.exe -s -I http://localhost:3001/
```

Expected response headers: `HTTP/1.1 404 Not Found` **and helmet defaults**, at minimum `x-content-type-options: nosniff` and `cross-origin-resource-policy` (absence = helmet not applied → FAIL). Body/print may show the Express 404 stack if using `-i` instead.

After the curl, the `start:dev` console MUST print a dev-format morgan line, e.g.:

```text
::1 - - [13/Sep/2026:...hrs] "HEAD / HTTP/1.1" 404 - "-" "curl/8.x" 0.123 ms
```

(Assert it references `404` and ends with `ms`. Morgan present but format wrong/flipped → FAIL.)

### 4.3 Swagger UI reachable

```powershell
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3001/docs/
```

Expected output: `200` (Swagger UI HTML; SwaggerModule redirects bare `/docs` with 301 — use the trailing slash). Also confirm the HTML contains `swagger-ui`:

```powershell
curl.exe -s http://localhost:3001/docs/ | Select-String "swagger-ui"
```

Expected: at least one matched line.

### 4.4 Swagger OFF (env-var sabotage — NO file edits)

Stop the dev server (`Ctrl+C`), then in the SAME shell:

```powershell
$env:SWAGGER_ENABLED='false'; npm run start:dev
```

(Two statements in one invocation; PowerShell chains are allowed here; process.env takes precedence over .env in ConfigService, so the override wins and `.env` files stay pristine.)

```powershell
curl.exe -s -o NUL -w "%{http_code}" http://localhost:3001/docs/
```

Expected: `404` (route not mounted). Re-enable: stop server, then `Remove-Item Env:SWAGGER_ENABLED` (or close the shell).

### 4.5 Versioning honesty note (no proof possible this task)

With zero controllers registered, `/v1/whatever` and `/health/ping` both 404 — neither proves nor disproves versioning. Record in the task summary: "URI versioning registered per G6; route-level behavior verified in T4 (health) and T5 (protected routes)." **Temp route creation is BANNED** (caller constraint I; G10-style throwaway routes are reserved for T4/T5 verification cycles only).

## 5. Commit (Step 5) — implementer

1. `git status` — expect exactly two modified/new entries: `src/main.ts` (modified) and nothing else under `src/`; the plan file `.kilo/plans/20260913-project-foundation-t3-bootstrap.md` (new, tracked — .kilo/plans holds committed plan files per repo precedent).
2. Read `.gitignore` and confirm none of the to-be-staged paths match it (this plan lives in `.kilo/plans/`, which is NOT ignored by the repo's `.gitignore` — verify; if it IS ignored in this repo, stage only main.ts and note the blocked plan file to the caller instead of force-adding).
3. No `.env`, `node_modules`, `dist/`, or coverage paths staged.
4. Commit (plan + code in ONE feat commit):
   ```
   git add src/main.ts .kilo/plans/20260913-project-foundation-t3-bootstrap.md
   git commit -m "feat: harden bootstrap with helmet, CORS, morgan, validation, versioning and swagger"
   ```
   (If hooks/lint-staged alter files, re-run `npm run lint` + `npm run build` before retrying as a NEW commit — never amend a failed/rejected one.)
5. NO push, NO merge (Step 5 of the workflow owns that), NO branch switching (branch creation was a Step-2-only concern).

## 6. Out of scope (hard blockers — reject any drift)

- Creating/structuring `src/common/`, `src/health/`, or any new module/folder/package.
- Health controller, `@Public()`, `ApiKeyGuard`, x-api-key security scheme, `@SkipVersioncheck()` wiring — T4/T5 cycles.
- `app.enableShutdownHooks()`, graceful-shutdown, lifecycle hooks (decision H non-choice recorded).
- Edits to `app.module.ts`, `config.keys.ts`, `env.validation.ts`, `.env`, `.env.example`, `package.json`, `tsconfig.json`, `nest-cli.json`, `docs/` (docs refresh happens in task 4.4), `.agent/project-structure.md` (no new folders).
- Any placeholder/temp route committed to the tree; any test files.
- Version bump; `git push`; dependency installs (`npm i` of any kind); global installs (never).

## 7. Deviations register (use during 4.3 review / 4.5b)

- None expected. Log candidate deviations ONLY for: `INestApplication` homo-import fallback (permitted, §2 NOTE); eslint auto-fix reordering (permitted, §2.3); anything else = STOP and ask caller.
- Verification honest-expectation caveats (not deviations): versioning route-level proof deferred to T4/T5; `GET /` 404 is the designed pre-health behavior.

## 8. Definition of Done (T3)

- [ ] `src/main.ts` matches §2.1 byte-for-byte (modulo acceptable lint import-order auto-fix if any); stale JSDoc and `DEFAULT_PORT` gone.
- [ ] Gate table (§3) all green: lint 0, build 0, test 0.
- [ ] Runtime evidence captured: morgan dev line for `HEAD /` 404; helmet headers present on that 404; `/docs/` returns 200 + `swagger-ui` HTML; with `SWAGGER_ENABLED=false` the same URL returns 404; the env-var sabotage left the working tree pristine (`.env` is gitignored and never edited; the override removed before committing).
- [ ] Deviations register §7 resolved (empty or justified).
- [ ] Single feat commit made per §5; no push/merge/version-bump/out-of-scope edits.
- [ ] Summary paragraph returned by the implementer: what was done / what was NOT done (incl. explicit "versioning route-level proof deferred to T4/T5").

## 9. Addendum A3-R — ConfigService null-strictness fix (2026-09-13, appended by architector; ORIGINAL SECTIONS §0–§8 STAND UNMODIFIED except where superseded here)

### 9.1 Trigger

Build gate (plan §3.2) failed for the implementer with:

```text
TS2345 at `await app.listen(configService.get<number>(ConfigKeys.Port));`
Argument of type 'number | undefined' is not assignable to parameter of type 'string | number'.
```

Verified reason against installed typings (`node_modules/@nestjs/config/dist/config.service.d.ts`, read by the architect): `ConfigService.get<T>(path)` (the no-defaultValue overload) returns `ValidatedResult<WasValidated, T>`; because the station `ConfigService` is instantiated WITHOUT a class-level validated type parameter (`WasValidated = false`), that resolves to `T | undefined`. Only `getOrThrow<T>(path): Exclude<T, undefined>` and `get<T>(path, defaultValue: T): T` return non-undefined types.

### 9.2 Binding solution for PORT (supersedes the listen line in plan §2.1 and the §1 trailing-bindings sentence)

OLD (superseded):

```ts
  await app.listen(configService.get<number>(ConfigKeys.Port));
```

NEW (exact final line):

```ts
  await app.listen(configService.getOrThrow<number>(ConfigKeys.Port));
```

Typing: `getOrThrow<string|number...>` → with `<number>` generic, return type is `Exclude<number, undefined> = number` → assignable to `listen(string | number)`. Runtime semantics match the validated-env fail-fast contract: every T3 key is guaranteed present post-validation; a missing value threw at bootstrap long before, and if it ever slips through, `getOrThrow` aborts loudly instead of listening on `undefined`. NO import changes (`getOrThrow` is a method on the already-imported `ConfigService` instance, NOT an export).

### 9.3 Rejected alternatives (do NOT apply)

- Non-null assertion `configService.get<number>(ConfigKeys.Port)!` — compiles, but silently converts "missing port" into `listen(undefined)`-adjacent runtime behavior and violates the security-first / robust-error-handling rules; `getOrThrow` expresses the same guarantee with an exception path.
- Cast `as number` — same objections, plus a lie to the compiler about a value that may legitimately be absent.

### 9.4 Full-file scan result + binding call-site table

Scan of the planned `src/main.ts` content found exactly FOUR `configService` read sites. Final, binding call-site forms:

| Key | Validated status | Final call-site form (exact code) | Return type | Rationale |
|-----|------------------|-----------------------------------|-------------|-----------|
| `Port` | required (int ≥1) | `configService.getOrThrow<number>(ConfigKeys.Port)` | `number` | Passed to `listen`, which rejects `undefined`; loud failure matches fail-fast contract. |
| `NodeEnv` | required enum | `configService.getOrThrow<string>(ConfigKeys.NodeEnv)` | `string` | Same required-key rule. Helper `resolveHttpLogFormat(nodeEnv?: string)` is UNCHANGED and still compiles with a strict `string` argument (a `string` is assignable to its optional param). |
| `SwaggerEnabled` | optional, default `true` | `configService.get<boolean>(ConfigKeys.SwaggerEnabled, true)` | `boolean` (defined) | Uses the defaultValue overload (line 62 of the typings): returns `T`, never `T \| undefined`, feeding `if` cleanly. Inline `true` mirrors the validation-class initializer (`SWAGGER_ENABLED: boolean = true`), so a fully absent var still enables Swagger. |
| `CorsOrigins` | optional, no default | `configService.get<string>(ConfigKeys.CorsOrigins)` | `string \| undefined` | OPTIONAL key: `undefined` is a meaningful input ("allow all origins"). `resolveCorsOrigins(rawOrigins?: string)` already models `undefined` (returns `true`), so the raw `string \| undefined` flow compiles under `strictNullChecks` and is semantically correct. Do NOT switch to `getOrThrow` here — it would throw on the documented allow-all dev case. |

Corresponding exact final forms of the three other read lines (for copy-paste; only the listed lines differ from plan §2.1):

```ts
  app.enableCors({ origin: resolveCorsOrigins(configService.get<string>(ConfigKeys.CorsOrigins)) });
  app.use(morgan(resolveHttpLogFormat(configService.getOrThrow<string>(ConfigKeys.NodeEnv))));
  if (configService.get<boolean>(ConfigKeys.SwaggerEnabled, true)) {
    setupSwagger(app);
  }
  await app.listen(configService.getOrThrow<number>(ConfigKeys.Port));
```

### 9.5 Remaining compile-risk re-check (done WITHOUT running the build, per instructions)

- helmet default import: `import helmet from 'helmet'` + `esModuleInterop: true`, helmet v8 ships bundled `.d.cts` types — confirmed compiled (the implementer's failed typecheck reported ONLY line 53; import lines passed).
- morgan call: `app.use(morgan(resolveHttpLogFormat(...)))` — `@types/morgan` exposes the `morgan(format: string)` overload; `'dev' | 'combined'` is a string-subtype and accepts it; `app.use` accepts any express `RequestHandler`. Passed in the implementer's failure run (single-error report).
- `ValidationPipe` inline object (`whitelist`, `forbidNonWhitelisted`, `transform` all real option names), `enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`, `DocumentBuilder` chain, `SwaggerModule.setup('docs', app, doc)` — all passed the implementer's typecheck up to line 53.
- `resolveCorsOrigins(rawOrigins?: string): string[] | boolean` — both `undefined` and `string[]`/`true` branches assignable; unaffected by strictNullChecks.
- Conclusion: with §9.4's four lines applied, NO further TS errors are expected in the file. The build gate (§4.1/§3.2) remains the implementer's only compile proof.

### 9.6 Re-run instructions for the implementer

1. Apply exactly the §9.4 four lines to the modified-uncommitted `src/main.ts` (the file already carries plan-§2.1 content otherwise unchanged).
2. Re-run `npm run build` (Step 3.2). Then continue the gate sequence UNTOUCHED in original order: `npm run lint` (3.1) and `npm test` (3.3) only if desired — but per original plan §3 the full lint/build/test triple must be green after the edit (re-run all three; lint had passed before, build input changed).
3. Runtime verification suite (plan §4.1–§4.4) unchanged; Swagger-env-off check (§4.4) unchanged; expected outputs unchanged.
4. Commit unchanged: `feat: harden bootstrap with helmet, CORS, morgan, validation, versioning and swagger` (plan §5, same message, same staged files).

