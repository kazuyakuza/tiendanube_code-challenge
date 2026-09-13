# Simplification Plan — T3 (`src/main.ts`) — Step 4.3 (code-simplifier)

> Reviewed artifact: commit `84bfb15` (`feat: harden bootstrap with helmet, CORS, morgan, validation, versioning and swagger`), `src/main.ts`, 107 lines. Working tree clean for this file at review time.
> Base plan: `.kilo/plans/20260913-project-foundation-t3-bootstrap.md` (incl. Addendum A3-R).
> Scope: behavior-identical simplification ONLY. G6 order, ValidationPipe options, versioning, `/docs` gating, helmet, CORS semantics, A3-R call-site table, no-setGlobalPrefix, no-security-scheme: all untouched.

## Finding summary

Exactly ONE simplification found. Everything else is already minimal/canonical:

| # | Candidate | Verdict |
|---|-----------|---------|
| S1 | Fold `splitOrigins` into `resolveCorsOrigins` (drop the redundant `if (!rawOrigins)` guard) | **PROPOSE** |
| — | `resolveHttpLogFormat` as ternary instead of `if` | REJECT — plan decision **F** binds the single-`if` shape |
| — | JSDoc trimming (header / per-helper) | REJECT — decision **K**; notes carry R2/T5 value; churn |
| — | Import regrouping, `void bootstrap();`, swagger constants | REJECT — already canonical |

## S1 — Fold `splitOrigins` into `resolveCorsOrigins`

`splitOrigins` has exactly one caller, is 6 lines, and sits adjacent to it. Folding removes a function, a JSDoc block, and one level of indirection. The `if (!rawOrigins) return true;` guard is redundant: for every defined `rawOrigins` that yields no non-empty trimmed origin (`''`, `'   '`, `','`, `' , '`), split→trim→filter already produces `[]` and the existing ternary returns `true`. Only `undefined` needs normalizing — `?? ''` does it.

### Before (current, lines 56–77)

```ts
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
```

### After (exact replacement, same location)

```ts
/**
 * Maps CORS_ORIGINS to the `origin` option: absent/blank ⇒ `true` (allow all,
 * dev-friendly); otherwise the trimmed, non-empty origin list. Tightening for
 * production is a one-line .env change (see .env.example).
 */
function resolveCorsOrigins(rawOrigins?: string): string[] | boolean {
  const origins = (rawOrigins ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  return origins.length > 0 ? origins : true;
}
```

### Behavior-identity proof (full input domain `string | undefined`)

| `CORS_ORIGINS` value | Old result | New result |
|----------------------|------------|------------|
| `undefined` | `true` (guard) | `(undefined ?? '')` → `[]` → `true` |
| `''` | `['']→[]` → `true` | `''` → `[]` → `true` |
| `'   '` | `['   ']→['']→[]` → `true` | same → `true` |
| `','` / `' , '` | `[]` → `true` | `[]` → `true` |
| `'http://a.com'` | `['http://a.com']` | `['http://a.com']` |
| `'a.com , b.com'` | `['a.com','b.com']` | `['a.com','b.com']` |

Caller and signature unchanged: `resolveCorsOrigins(configService.get<string>(ConfigKeys.CorsOrigins))` (A3-R §9.4 row 4 — `string | undefined` flows in, `string[] | boolean` out).

### Rule compliance

- Params: 1 (≤2). Body: 7 lines (≤50). Depth: max 1 (no nested blocks; method chains are not blocks). Conditions: one single-section ternary; zero `if`. File: 107 → 98 lines (under 200; closer to 125 ideal).
- `??` valid under installed TS/ESLint: `tseslint.configs.recommended` has no `no-unnecessary-condition`; `esModuleInterop`/target-independent (compiles on any target).

## Implementation steps (implementer, single edit)

1. In `src/main.ts`, replace lines 56–77 (the two functions + their JSDoc blocks) with the "After" block above. Nothing else in the file changes.
2. Verification gates, in order, from repo root (all must pass; no `.env` edits, no runtime run needed — behavior is config-independent for this pure function):
   - `npm run lint` → exit 0
   - `npm run build` → exit 0
   - `npm test` → exit 0
3. Commit ONLY this change (plan file + `src/main.ts`), as a separate commit on `feat/project-foundation`:
   - `git add src/main.ts .kilo/plans/20260913-project-foundation-t3-simplify.md`
   - `git commit -m "refactor: fold splitOrigins into resolveCorsOrigins in main.ts"`
   - Before staging: read `.gitignore` + `git status` per gitignore-compliance rule (expect no `dist/`, `.env`, `node_modules` staged).
4. NO push, NO merge, NO other files.

## Out of scope

- Any change to `bootstrap`, `resolveHttpLogFormat`, `setupSwagger`, constants, imports, JSDoc, or any file other than `src/main.ts`.
