# Simplification Plan — T1 Project Bootstrap (Step 4.3, code-simplifier)

> Scope: files from T1 commits on `feat/project-foundation` only (TODO `.agent/todos/20260913/20260913-todo-2.md` §1).
> Binding: `.kilo/plans/20260913-project-foundation.md` G-decisions + T1 ambiguity resolutions A1–A12.
> Executor: JUNIOR implementer under 50% restriction — execute literally. If blocked or ambiguous, STOP and ask the caller. Do NOT expand scope. Do NOT touch any file outside the one listed below.

---

## 1. Review Outcome

| File | Verdict |
|------|---------|
| `package.json` | No change. All scripts required by DoD/G12 (`test:watch`, `test:cov`, `start:debug`, `start:prod` are all listed in T1 DoD); `ts-node` already omitted (A3); embedded jest block is the Nest-canonical location. |
| `tsconfig.build.json` | No change. Already 4 lines, canonical. |
| `nest-cli.json` | No change. Minimal (8 lines). |
| `eslint.config.mjs` | No change. Minimal flat config, no plugins beyond binding A12. |
| `test/jest-e2e.json` | No change. Duplication with the embedded jest block is the canonical Nest two-config layout; merging would add `extends`/rootDir indirection for zero net gain. |
| `src/main.ts` | No change. 12 lines, honors A5 (temporary port read replaced in T3) and rule 13. |
| `src/app.module.ts` | No change. Minimal (4 lines). |
| `.env.example` / `.env` / `.gitignore` | No change. Content is fixed by binding A7/G13/G14 — not free to trim. |
| `.agent/project-structure.md` | No change. Fixed format per binding G15. |
| `tsconfig.json` | **Simplify** — see §2. Contains 4 options that add noise with zero behavioral effect. |

Only ONE change is warranted. Everything else is already minimal; manufacturing more changes would be churn without benefit.

## 2. Change — `tsconfig.json`: remove default-value / unused compiler options

Rationale (verified, current project):
- `allowSyntheticDefaultImports: true` is implied automatically by `esModuleInterop: true` (TypeScript compiler behavior) — redundant.
- `noImplicitAny: false` and `strictBindCallApply: false` are the compiler defaults explicitly written out — zero information.
- `baseUrl: "./"` is unused: no `paths` aliases exist, and every current import (`./app.module`, `@nestjs/...`) resolves without it. Future tasks must add it back ONLY if a path alias (`paths`) is introduced — that is a T2+ decision, not this task's.
- No G-decision or T1 binding (A4 fixed only `module: "commonjs"` and `target: "ES2021"`) requires any of these four options.
- Behavior-neutral: build output, jest/ts-jest, and eslint `projectService` resolution are unaffected.

### Step 2.1 — Replace the full content of `tsconfig.json` (repo root) with EXACTLY:

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
    "esModuleInterop": true,
    "sourceMap": true,
    "outDir": "./dist",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

(Net: 17 lines, −5 options: `allowSyntheticDefaultImports`, `noImplicitAny`, `strictBindCallApply`, `baseUrl`, and nothing else.)

### Step 2.2 — Verify (all must pass, in order; single commands)

```powershell
npm run build
npm run lint
npm test
npm run test:e2e
```

Expected: all exit 0 (`npm test` / `test:e2e` may report "No tests found" — that is the expected pass state via `passWithNoTests: true`). If `npm run build` fails or `dist/` output differs from the previous commit's output (compare `git diff -- dist` is NOT possible — dist is ignored; instead verify `dist/main.js` and `dist/app.module.js` exist), STOP and report to the caller.

### Step 2.3 — Commit

```powershell
git status
git add tsconfig.json
git commit -m "refactor: remove default-value and unused tsconfig options"
```

Pre-commit (gitignore-compliance rule): `git status` must show ONLY `tsconfig.json` modified. Nothing else staged.

## 3. Constraints Checklist

| Rule | Compliance |
|------|------------|
| Preserve behavior | All removed options equal defaults or are unused; verified by full verification suite ✓ |
| No dependency changes | Deps untouched ✓ |
| G-decision adherence | A4 (`commonjs`/`ES2021`) preserved; no G rule requires removed options ✓ |
| Max 2 params / depth / lines | No code changed ✓ |
| Out of scope guardrail (G17) | No T2+ territory touched ✓ |

## 4. Explicitly Out of Scope

- All files other than `tsconfig.json`.
- Any behavior change, dependency change, script change, or env file change.
- Git push, branch creation/switch, version bump.
