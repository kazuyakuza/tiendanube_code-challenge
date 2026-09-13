# Global Plan — Initialize Project Info

TODO source: `.agent/todos/20260913/20260913-todo-1.md`
Workflow bindings: Critical Workflow (`.kilo/commands/critical-workflow.md`) + Project Info Initialization Workflow (`.kilo/commands/project-info-init.md`) + `.agent/project-info/instructions.md`.

## Global Pre-analysis

### Repository state (verified 2026-09-13)

- **Not base project**; `.agent/project-info/.initialized` exists (tracked in git) → initialization workflow is active.
- `.agent/project-info/` currently contains: `brief.md` (already author-defined: Orchestration API), `instructions.md`, `.initialized`. Missing core files: `product.md`, `context.md`, `architecture.md`, `tech.md`.
- `src/` is empty (only `.gitkeep`) — no application code written yet.
- Provided challenge assets (read-only for this task):
  - `numerator-api/` — Express mock ID generator on port **3000**: `GET /numerator`, `PUT /numerator`, `PUT /numerator/test-and-set` (atomic CAS, HTTP 400 + `currentNumerator` on mismatch), `POST /numerator/lock`, `DELETE /numerator/lock`. In-memory numerator starts at **3**.
  - `config/db.json` — json-server seed on port **8080**: collections `transactions` (ids "1"–"3") and `receivables` (ids "1"–"3"), string ids/values, card numbers stored **masked** (last 4 digits).
  - `docker-compose.yml` — services `json-server` (8080), `numerator-api` (3000), `tcpdump` (ngrep capture for debugging).
  - `README.md` (+ `README-es-ar.md`, `README-pt-br.md`) — original challenge statement; source for product/context facts.
- No root `package.json` → Critical Workflow **step 3 (version update) is N/A**; `numerator-api/package.json` belongs to the provided mock service and MUST NOT be touched.
- Git: branch `main`, clean tree; `origin` remote configured (upstream `origin/main` currently reported "gone" — step 5 push may require attention). `.git-credentials` at root is gitignored and untracked.

### Discount field definition (USER DECISION 2026-09-13 — overrides previous brief wording)

`discount` is the **fee percentage** (debit_card → `"2"`, credit_card → `"4"`), per the seed data in `config/db.json` (e.g. subtotal 340.50, discount "2", total 333.69 = 340.50 × 0.98). The previous `brief.md` statement "`discount` = fee amount (not percentage)" was a user error and **must be corrected** in `brief.md`. The receivable example in `README.md` (subtotal "250", discount "10", total "240") reads as an amount and is superseded by this decision; the discrepancy is recorded in `context.md` for future implementation reference.

### Global technical & architecture decisions for this task

1. Scope = documentation/initialization only. **No application code**, no dependency installs, no changes inside `numerator-api/`, `config/`, `docker-compose.yml`, READMEs.
2. `brief.md` is user-authored and nearly complete → only the Fee Rules targeted fix above is allowed (user-approved decision); everything else must remain byte-identical, including the `<!-- DO NOT DELETE ... -->` AI-agents section.
3. Markdown authoring must respect Markdown Generation Rule → `.agent/project-info/*.md` files authored by **docs-specialist**.
4. File-creation order per instructions.md: technical summary → files → remove `.initialized` → approval (approval is folded into the Critical Workflow plan/step gates below).
5. `AGENTS.md` must gain links to all five core files (instructions.md "Integration in AGENTS.md"). `AGENTS.md` edit is delegated to docs-specialist (step 4.4).

## Task 1 — Initialize project info (non front-end)

### Per-task pre-analysis

Deliverables (all decided, no open judgment left to the implementer):

| File | Decision |
|---|---|
| `.agent/project-info/brief.md` | TARGETED FIX ONLY (user decision): in §3.2 Fee Rules replace `- discount = fee amount (not percentage)` with `- discount = fee percentage (debit_card → "2", credit_card → "4", stored as string)` and `- total = subtotal - discount` with `- total = subtotal × (1 − discount/100)` (fee deducted). No other content changes; preserve `<!-- DO NOT DELETE ... -->` section. |
| `.agent/project-info/product.md` | NEW — payment orchestration UX/problem framing: merchant flow "one call → transaction + receivable", fee rules table (debit 2%/D+0/paid, credit 4%/D+30/waiting_funds) with `discount` = fee percentage, card masking privacy, success criteria (atomicity, unique IDs, consistency). |
| `.agent/project-info/context.md` | NEW — factual state log: challenge repo prepared, brief corrected (discount = percentage per user decision), NestJS app NOT yet implemented, next steps = scaffold NestJS per brief §6 structure; record README-vs-db.json discount example discrepancy with adopted interpretation (percentage); record numerator starts at 3. |
| `.agent/project-info/architecture.md` | NEW — target architecture from brief §6: modules `config`, `common` (ApiKeyGuard, filters, interceptors), `health`, `transactions`, `numerator` (client + CAS retry loop), `json-server` (client); data-flow diagram of POST /v1/transactions (2× test-and-set → create transaction → create receivable); concurrency strategy for ID generation; URI versioning `/v1`. |
| `.agent/project-info/tech.md` | NEW — NestJS latest stable, @nestjs/axios, @nestjs/config + class-validator, morgan, helmet+CORS, Swagger, Jest+Supertest, json-server 8080, numerator-api 3000 (node:20-alpine via docker compose), yarn/npm usage note, `.env` variables (`PORT`, `NUMERATOR_API_URL`, `JSON_SERVER_URL`, `API_KEY`, `NODE_ENV`). |
| `.agent/project-info/.initialized` | DELETE via `git rm` (file is tracked). |
| `AGENTS.md` (root) | Append links to `product.md`, `context.md`, `architecture.md`, `tech.md` under a "Project Info" section, keeping existing structure. |

Constraints for every sub-agent: max 200-line files (rules), self-documenting markdown, no commented-out code blocks, actual newlines.

### Step assignments (each = one separate `task` tool call)

- Step 2: Git Feature Branch Setup → **implementer** — commit pending files if any, work on new branch `feat/initialize-project-info` from `main`.
- Step 3: Version Update → **skipped** (no root version file; provided-service `package.json` is off-limits) — recorded here for audit; no sub-agent call needed.
- Task 1 — 4.1b Analysis & Planning → **architector** — produce per-task implementation plan at `.kilo/plans/20260913-initialize-project-info-plan.md` (exact sections/content per file above); present for user approval.
- Task 1 — 4.2 Implementation → **docs-specialist** — apply the targeted `brief.md` Fee Rules fix, create the 4 new project-info files per approved plan, `git rm .agent/project-info/.initialized`, commit with meaningful message.
- Task 1 — 4.3 Review & Simplification → **code-reviewer** + **code-simplifier** (concurrent) — check plan adherence, consistency with `brief.md`, rule compliance; fix plan at `.kilo/plans/20260913-initialize-project-info-fixes.md` if required → **implementer** applies fixes.
- Task 1 — 4.4 Documentation → **docs-specialist** — update root `AGENTS.md` with links to all five core project-info files; verify `.agent/project-structure.md` accuracy (no src folders yet — expected).
- Task 1 — 4.5b Overall Plan Adherence → **architector** — verify deliverables vs plan; report at `.kilo/plans/20260913-initialize-project-info-verification.md`.
- Task 1 — 4.6 Task Completion → **implementer** — add `[DONE]` to TODO line, commit.
- Step 5: TODO File Completion → **implementer** — rename TODO file with `-DONE` suffix, ensure clean worktree on feature branch, switch to `main`, merge `feat/initialize-project-info`, delete branch, push `main` to `origin` only (notify user on push failure; never push elsewhere).
- Step 6: Finish → **planner** — short summary + next-TODO handoff text.

### Failure handling

- Sub-agent without clear completion summary → Planner resumes that exact task via `task_id`.
- Ambiguity inside sub-steps → sub-agent returns question to Planner; no assumptions, no invented content.
- Push to `origin` fails in step 5 → stop and notify user (per Git Remote Safety rule).
