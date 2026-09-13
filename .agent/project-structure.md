# Project Structure

# Folders in src/

- src/ - NestJS application root: main.ts bootstrap and root AppModule
- src/common/ - Cross-cutting concerns: API-key constants (api-key.constants.ts), @Public() decorator (decorators/) and global ApiKeyGuard (guards/)
- src/config/ - Validated environment configuration: class-validator env schema (env.validation.ts) and ConfigService key constants (config.keys.ts)
- src/health/ - Public unversioned liveness probe: HealthModule + HealthController (HEAD /health/ping, TODO-02 §4)
- test/ - e2e Jest config (jest-e2e.json); e2e specs arrive in later TODOs

# Other folders

- .agent/ - agent context: project-info/, todos/, rules/workflow indexes and the structure map
- .kilo/ - Kilo Code integration: agents/, rules/, commands/ and plans/
- .opencode/ - opencode integration: agents/, commands/ and opencode.json
- config/ - json-server db.json seed (port 8080 via docker compose)
- docs/ - Documentation files
- numerator-api/ - provided Express mock sequential-ID service (port 3000)
