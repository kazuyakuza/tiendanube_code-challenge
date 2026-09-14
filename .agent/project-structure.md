# Project Structure

# Folders in src/

- src/ - NestJS application root: main.ts bootstrap and root AppModule
- src/common/ - Cross-cutting concerns: API-key constants, @Public() decorator, ApiKeyGuard, global AllExceptionsFilter structured error mapping (filters/, TODO-06 Cycle B), shared payment enums (enums/), fee/timeout/compensation constants (constants/), card masking util (utils/)
- src/config/ - Validated environment configuration: class-validator env schema (env.validation.ts) and ConfigService key constants (config.keys.ts)
- src/health/ - Public unversioned liveness probe: HealthModule + HealthController (HEAD /health/ping, TODO-02 §4)
- src/transactions/ - Transaction orchestration + HTTP endpoint (TODO-05 service, TODO-06 Cycle A controller, TODO-06 Cycle B compensation): TransactionsModule registers TransactionsController (POST /v1/transactions — live route: guard 401, ValidationPipe 400, 201 envelope/bare-201 via the TRANSACTIONS_RETURN_BODY service gate, domain errors mapped to structured 502/503 by the global filter) + TransactionsService (9-step create() flow; its one try/catch compensates orphaned transactions) + TransactionCompensationService (bounded orphan-DELETE retry loop) + pure fee-rules.ts; DTOs and custom validators in dto/
- src/numerator/ - Numerator API client (TODO-04 Task 1): NumeratorService CAS retry loop (getNextId), NumeratorModule, tuning constants, domain errors (errors/) and wire interfaces (interfaces/)
- src/json-server/ - json-server persistence client (TODO-04 Task 2): JsonServerService (createTransaction/createReceivable POSTs), JsonServerModule, resource-path constants, domain error (errors/) and transport payload interfaces (interfaces/)
- test/ - e2e Jest config (jest-e2e.json); e2e specs arrive in later TODOs

# Other folders

- .agent/ - agent context: project-info/, todos/, rules/workflow indexes and the structure map
- .kilo/ - Kilo Code integration: agents/, rules/, commands/ and plans/
- .opencode/ - opencode integration: agents/, commands/ and opencode.json
- config/ - json-server db.json seed (port 8080 via docker compose)
- docs/ - Documentation files
- numerator-api/ - provided Express mock sequential-ID service (port 3000)
