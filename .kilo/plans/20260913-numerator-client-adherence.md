# Adherence Report — Task 1: Numerator Client (Critical Workflow 4.5b)

- Audited: branch `feat/external-clients`, commits `fa9f723`, `c18eda4`, `b36b53c`, `d56eab3` (step 4.2) + `917e72c` (step 4.4 docs).
- Plan: `.kilo/plans/20260913-numerator-client.md`; spec: `.agent/todos/20260913/20260913-todo-4.md` §Task 1 + §Configuration & resilience.
- Review status carried in: 4.3 code-review = NO FIXES REQUIRED; 4.3 simplification = NO SIMPLIFICATION REQUIRED. No 4.5a report (task not front-end related).

## Verdict: ADHERENT — no fix plan required. Accepted/known deviations only (T1-D1…T1-D8, G18 drift).

## Checklist §4 rows 1–21

| Row | Requirement | Verdict | Evidence |
|---|---|---|---|
| 1 | `getNextId(): Promise<string>` → `String(candidate)` (§1.1, G9) | PASS | `numerator.service.ts:64–71` — returns `String(reservedId)`; `retryReservation` returns the CAS candidate |
| 2 | Atomic CAS `PUT /numerator/test-and-set` with `{ oldValue, newValue }` (§1.1/§1.2) | PASS | `testAndSet(oldValue, newValue)` at service:179–184 sends exactly `{ oldValue, newValue }` |
| 3 | Loop up to MAX_RETRIES: GET → candidate=current+1 → CAS → return/retry/throw (§1.3, G6) | PASS | `retryReservation` service:73–83 + `attemptReservation` 85–94; final conflict does not sleep (matches plan note) |
| 4 | Finite-number validation + `Number.isSafeInteger` candidate check → immediate `InvalidNumeratorValueError` (§1.3/§1.4, G7) | PASS | `isFiniteNumber` type predicate (L187–189, T1-D8 corrected form), `extractValidCurrent` 163–169, `buildCandidate` 171–177 |
| 5 | Conflict = axios 400 + numeric `currentNumerator` ONLY; all else fails fast as `NumeratorUnavailableError` (G5) | PASS | `isCasConflict` 105–110, `isConflictResponse` 112–117 (status === 400 && typeof currentNumerator === 'number'), `handleTestAndSetFailure` 96–103 throws otherwise |
| 6 | Network/timeout/5xx → clear custom domain error (§1.4, G8) | PASS | `getCurrentNumerator` catch → `toUnavailableError` 152–161 |
| 7 | Exhausted retries → `NumeratorRetriesExhaustedError` with maxRetries + last known current (§1.4, G8) | PASS | service:82 + `numerator.errors.ts:26–38` carries both, message includes attempt budget and suffix |
| 8 | Backoff default 20 ms, exponential `min(base*2^retryIndex, 160)` (§1.3, G4) | PASS | `computeBackoffDelay` 139–146; constants `NUMERATOR_DEFAULT_BASE_BACKOFF_MS=20`, `MAX_NUMERATOR_BACKOFF_MS=160` |
| 9 | `MAX_RETRIES` optional env, default 10, validated `@IsOptional() @Type(() => Number) @IsInt() @Min(1)` (§1.3, G1) | PASS | `env.validation.ts` fa9f723 — exact planned decorators; default lives in constants (T1-D5) |
| 10 | `NUMERATOR_BASE_BACKOFF_MS` optional env, default 20, same pattern (G2) | PASS | `env.validation.ts` fa9f723 — exact planned decorators |
| 11 | `ConfigKeys.MaxRetries` + `ConfigKeys.NumeratorBaseBackoffMs` added (G1/G2) | PASS | `config.keys.ts` fa9f723 — both keys after `TransactionsReturnBody` |
| 12 | `.env.example` documents both optional; local `.env` untouched (G3) | PASS | `.env.example` fa9f723 — two commented entries exactly as planned; `.env` never staged in any commit |
| 13 | Base URL via `ConfigService.getOrThrow(ConfigKeys.NumeratorApiUrl)`; no `process.env` (§1.5) | PASS | constructor service:57–62; no `process.env` anywhere in `src/numerator` |
| 14 | `HttpService` + `ConfigService` injected (§1.5) | PASS | constructor service:57–59 |
| 15 | Low-level calls as private methods (§1.5) | PASS | `getCurrentNumerator` + `testAndSet` both private; all members private except `getNextId` |
| 16 | Dedicated `NumeratorModule` + `NumeratorService` (§1.5, T1-D1) | PASS | `numerator.module.ts` — bare `HttpModule` import, minimal @Module per T1-D1 |
| 17 | Conflict logging w/ attempt, current, candidate; no sensitive data ("Configuration & resilience", G13) | PASS | `logConflict` 126–130 logs only numbers/attempt counters; no card data in the client |
| 18 | No other HTTP library; no timeout literal in Task 1 (Task 3 owns it) | PASS | only `@nestjs/axios` imported; module has no timeout config |
| 19 | Rules: ≤200 lines/file, ≤50-line methods, ≤2 params, ≤2 depth, private-by-default, no commented-out code, self-documenting | PASS | service 189 lines; longest method body (`attemptReservation`) ~9 lines; params: `testAndSet` 2, `attemptReservation` 2, `waitForRetry` 2, others 1 (param objects for multi-field contexts); depth max 2 (`for`→`if`, per T1-D2); no commented-out code |
| 20 | `npm run build` + lint exit 0; no tests written | PASS (build) | `npm run build` re-run during this audit → exit 0. Lint not re-run in this read-only step (4.3 recorded exit 0; 917e72c touched comments only) |
| 21 | 4 commits, exact planned messages; TODO files/`.env` never staged (G19) | PASS | git log: fa9f723/c18eda4/b36b53c/d56eab3 with verbatim planned messages; per-commit file lists match plan §2 exactly; no TODO/`.env` files in any commit |

## TODO §Task 1 + Configuration & resilience coverage

- §1.1–§1.5: all satisfied (rows 1–16 above).
- Configuration & resilience bullets applicable to Task 1: URLs via ConfigService (row 13), timeout deferred to Task 3 as planned (T1-D1, row 18), conflict logging without sensitive data (row 17).
- Out-of-scope items respected: no orchestration, no controller changes, no fee logic, no tests, no `AppModule` registration, no `HttpModule` timeout.

## Commit hygiene audit

- Commit A fa9f723: exactly `env.validation.ts`, `config.keys.ts`, `.env.example` — matches plan §2.4/2.5; diffs byte-equivalent to plan snippets.
- Commit B c18eda4: exactly the 5 planned files; contents verbatim vs plan §3.1–3.5.
- Commit C b36b53c: exactly `numerator.service.ts` + `numerator.module.ts`; content matches the CORRECTED plan (isFiniteNumber type-predicate + `const currentNumerator` narrowing in `isConflictResponse` — T1-D8).
- Commit D d56eab3: exactly `.agent/project-structure.md`, one inserted line after `src/transactions/` (T1-D3).
- Docs commit 917e72c (step 4.4): docs files + comment-only header additions to `numerator.service.ts` and `cas-failure-context.interface.ts` (grep of `git show 917e72c -- src/numerator` confirms: JSDoc wording only, zero logic change). Include-time 4.4 comment touches on source files are acceptable documentation-scope changes (step 4.4 is mandated to add code comments). Covers T1-D6 reconciliation in `architecture.md` (concurrency numbers/error-mapping drift).
- Untracked working tree: the 2 TODO files + the plan file itself — the plan-file commit is the known open item deferred to step 4.6, confirmed still within scope, NOT a deviation.

## Observations (informational, NOT adherence deviations)

1. **Uncommitted `package.json` modification in the working tree** (`docker:ms-logs` script renamed to `docker:logs`). Not part of this plan, never staged, pre-exists the audited commits' scope, and does not affect the audited code or commit history. Flagged to the caller: decide whether to keep, revert, or fold into a later commit outside this task's plan.
2. Step 4.3 lint results are carried in from the review step; this read-only verification re-ran only `npm run build` (exit 0).

## Conclusion

Implementation matches the corrected plan and TODO §Task 1 in full; all deviations are the pre-approved T1-D1…T1-D8 plus the G18 drift reconciled in 917e72c. No fix plan required — proceed to step 4.6 (TODO `[DONE]` mark, commit, merge workflow). The plan file (untracked) plus TODO files are the caller's step-4.6 scope items.
