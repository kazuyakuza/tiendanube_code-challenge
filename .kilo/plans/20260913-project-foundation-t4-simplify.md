# T4 Simplification Plan — Health Module (commit `f2ee009`)

Role: code-simplifier, Step 4.3 for TASK T4 only. Scope: `src/health/health.controller.ts`,
`src/health/health.module.ts`, `src/app.module.ts` (JSDoc/import diff). Implementer: junior,
apply steps exactly; no judgment calls.

## Review findings

| Area | Verdict |
|---|---|
| `health.module.ts` (14 lines) | Already minimal canonical. Imports are both used; `Module({ controllers: [...] })` is the smallest correct module; class body is already empty `{}`. **No change.** |
| `app.module.ts` diff | Import is needed and correctly ordered (alphabetical: `config/…` < `health/…`); `imports` array entry is required by plan. Comment sentence already trimmed in this commit. **No change.** |
| `@HttpCode(HttpStatus.OK)` | **Keep.** Plan `.kilo/plans/20260913-project-foundation-t4-health.md` line 27 explicitly mandates it ("kept anyway to make the intent explicit") and line 212 acceptance forbids a literal `200`. Removal is prohibited despite HEAD default being 200. |
| `@Head('ping')`, `void` return | Plan-B decision (void ⇒ empty body) is binding. **Keep.** |
| `VERSION_NEUTRAL` via `@Controller({ version })` | G8-R mechanism, binding. **Keep.** |
| Import ordering/formatting | Single npm package import, alphabetized. **No change.** |
| JSDoc placement | **One finding (Step 1 below).** TODO-02 §4.2 mandates curl JSDoc *in the method*; it currently sits in the class-level JSDoc. |
| Rule compliance | ≤2 params (0), method bodies ≤50 lines (1), no commented-out code, max-depth 1, no magic numbers. No violations. |

## Step 1 — Move curl how-to into the method JSDoc (trim allowed, never removed)

TODO §4.2: "Include a JSDoc in the method on how to call it using curl." Currently the curl
commands are in the class JSDoc; `ping()`'s JSDoc describes only the response. Fix by moving a
condensed curl how-to onto the method and reducing the class JSDoc to route scope. Behavior is
unchanged (comments only).

### Before
```ts
/**
 * Public liveness probe (TODO-02 §4).
 *
 * Exposes `HEAD /health/ping`: an unversioned, key-free endpoint answering
 * `200 OK` with an empty body. Unversioned via `VERSION_NEUTRAL` — the
 * installed NestJS 11.2.3 has no `@SkipVersioncheck()` (global plan G8-R).
 * TODO-02 §5 will exempt this route from the global API-key guard with
 * `@Public()`; until then it is public by default (no guard exists yet).
 *
 * Call it with curl:
 *   curl -I http://localhost:3001/health/ping
 * (`-I` makes curl send a HEAD request and print only the response headers;
 * the response has no body, so nothing else is printed.)
 */
import { Controller, Head, HttpCode, HttpStatus, VERSION_NEUTRAL } from '@nestjs/common';

@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  /**
   * Answers `HEAD /health/ping` with `200 OK` and an empty body.
   */
  @Head('ping')
  @HttpCode(HttpStatus.OK)
  ping(): void {}
}
```

### After
```ts
/**
 * Public liveness probe (TODO-02 §4).
 *
 * An unversioned, key-free endpoint answering `200 OK` with an empty body.
 * Unversioned via `VERSION_NEUTRAL` — the installed NestJS 11.2.3 has no
 * `@SkipVersioncheck()` (global plan G8-R). TODO-02 §5 will exempt this
 * route from the global API-key guard with `@Public()`; until then it is
 * public by default (no guard exists yet).
 */
import { Controller, Head, HttpCode, HttpStatus, VERSION_NEUTRAL } from '@nestjs/common';

@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  /**
   * Answers `HEAD /health/ping` with `200 OK` and an empty body.
   *
   * Call it with curl (`-I` sends a HEAD request and prints the headers):
   *   curl -I http://localhost:3001/health/ping
   */
  @Head('ping')
  @HttpCode(HttpStatus.OK)
  ping(): void {}
}
```

Notes for implementer:
- curl how-to is retained (trimmed wording, same command line) and now lives in the method JSDoc
  as TODO §4.2 mandates. Do not drop the `-I` explanation — it is the payload of the mandate.
- Edit comments only; do not touch imports, decorators, or signatures.

## No-change rationale for the remaining files

- `health.module.ts`: 6 code lines, all structurally required and mandated by the dedicated-module
  rule (TODO §4.2 "Create a dedicated `HealthModule`"). Nothing to merge, inline, or remove.
- `app.module.ts`: the diff is one required import + one required list entry + a net-shorter comment.
  The comment update is already the concise phrasing of the same facts.

## Implementation steps

1. Open `src/health/health.controller.ts`.
2. Apply the edit from the Before/After block above (replace class JSDoc and method JSDoc with the
   After versions; leave every other line untouched).
3. Do not modify any other file.

## Verification commands

```
npm run build
npm run start:dev &
curl.exe -s -I -o NUL -w "%{http_code} %{size_download}" http://localhost:3001/health/ping
```

Expected: build clean; curl output `200 0`. Diff check: `git diff -- src/health/health.controller.ts`
contains only JSDoc lines (lines 1–14 and the method docblock), no code-line changes; `git diff`
is empty for `src/health/health.module.ts`, `src/app.module.ts`, `src/main.ts`.

Rule checks: file ≤200 lines (now ~25), method body ≤50 lines, 0 params, no literal `200` in
decorators, curl how-to present in method JSDoc.
