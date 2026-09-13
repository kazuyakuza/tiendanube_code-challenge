# Simplification Plan — T2 Configuration Module (Step 4.3, code-simplifier)

> Review target: commits `9318367`, `be98094` on `feat/project-foundation`
> Files reviewed: `src/config/env.validation.ts`, `src/config/config.keys.ts`, `src/app.module.ts`
> Scope guard: TODO-02 §2 only. G4 (exact validate wiring), G5 (env schema),
> A4-R (`require_tld:false, require_protocol:true`) are BINDING and untouched.
> Goal: fewer lines/noise with IDENTICAL behavior. Nothing cosmetic-only, nothing risky.

## Verification evidence (already executed by simplifier, temporary edits fully reverted)

- S2 alone: `npm run build` → exit 0 with `validate: validateEnv` and installed
  `@nestjs/config@4.0.2` typing `validate?: (config: Record<string, any>) => Record<string, any>`
  (return `EnvironmentVariables` is assignable; param accepts `Record<string, any>`).
- S1 + S2 combined: `npm run build` → exit 0 (strict `tsc` via `nest build`).
- Both temp edits restored via backup; `git status` clean (only pre-existing
  untracked `20260913-todo-3.md`).

## Evaluated and REJECTED (do NOT implement)

1. Dropping `@IsString()` from `API_KEY` (keep only `@IsNotEmpty()`): changes the
   error-message contract (`must be a string` vs `should not be empty`); TODO §2.2
   explicitly lists `@IsString` + `@IsNotEmpty`. REJECT.
2. Rewriting `transformBoolString` as a ternary/lookup: cosmetic only. REJECT.
3. Changing `buildErrorMessage`: already 7 lines, names each variable (sabotage
   guarantee preserved); any change is cosmetic. REJECT.
4. `config.keys.ts`: minimal, `as const` correct, `ConfigKey` type is the intended
   compile-time guard. REJECT (no change).

---

## S1 — `src/config/env.validation.ts`: deduplicate the two `@IsUrl` option literals

`IsUrl(options?)` takes a runtime object argument (not a compile-time-only
decorator constraint), so a shared `const` is provably safe — verified by build
(see evidence above).

### Step S1.1 — Add shared const after all imports

BEFORE (line 24, after the class-validator import block):

```ts
} from 'class-validator';

export enum NodeEnvironment {
```

AFTER:

```ts
} from 'class-validator';

const urlValidationOptions = { require_tld: false, require_protocol: true };

export enum NodeEnvironment {
```

### Step S1.2 — Replace both decorator option literals

BEFORE (lines 39 and 42):

```ts
  @IsUrl({ require_tld: false, require_protocol: true })
  NUMERATOR_API_URL: string;

  @IsUrl({ require_tld: false, require_protocol: true })
  JSON_SERVER_URL: string;
```

AFTER:

```ts
  @IsUrl(urlValidationOptions)
  NUMERATOR_API_URL: string;

  @IsUrl(urlValidationOptions)
  JSON_SERVER_URL: string;
```

Net: −2 duplicated option objects; A4-R values unchanged verbatim.

---

## S2 — `src/app.module.ts`: direct function reference instead of arrow wrapper

`validate: (config) => validateEnv(config)` is a point-free wrapper. The
installed `@nestjs/config@4` typing accepts the direct reference (compiled OK —
evidence above). Identical behavior: same function, same throw path, same
coerced return value.

BEFORE (line 20):

```ts
      validate: (config) => validateEnv(config),
```

AFTER:

```ts
      validate: validateEnv,
```

Net: −1 lambda; G4 wiring (`validate` consumed by `ConfigModule.forRoot`)
unchanged.

---

## Execution steps for implementer (JUNIOR, atomic)

1. Apply S1.1, then S1.2 (exact before/after above; file: `src/config/env.validation.ts`).
2. Apply S2 (exact before/after above; file: `src/app.module.ts`).
3. `npm run build` → must exit 0, no output errors.
4. `npm run lint` → must exit 0.
5. Boot check: `npm run start:dev` → app starts on configured port; stop it.
6. Fail-fast check (manual, never committed): temporarily set `JSON_SERVER_URL=not-a-url`
   in `.env`, start once, confirm error names `- JSON_SERVER_URL:` and aborts;
   restore `.env` original content exactly.
7. `git add src/config/env.validation.ts src/app.module.ts` and commit:
   `refactor: deduplicate IsUrl options and use direct validate fn ref`
8. `git status` → working tree clean except pre-existing untracked
   `.agent/todos/20260913/20260913-todo-3.md` (do NOT stage it).
