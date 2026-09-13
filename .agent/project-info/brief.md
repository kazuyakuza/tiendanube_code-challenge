# Project Brief – Orchestration API

## 1. Overview

Production-ready **Orchestration API** that creates a payment transaction and its corresponding merchant receivable in a single atomic-like operation.

The system must:

- Generate unique sequential IDs using the provided **Numerator API**.
- Persist the transaction and receivable using the provided **json-server** (acting as a fake database).
- Correctly apply fee deduction rules based on the payment method.
- Guarantee consistency and handle concurrent ID generation safely.

## 2. Tech Stack

| Concern                    | Choice                                      | Notes                                      |
|---------------------------|---------------------------------------------|--------------------------------------------|
| Framework                 | **NestJS** (latest stable)                  | Modular architecture                       |
| HTTP Client               | **Axios** (via `@nestjs/axios`)             | Official NestJS integration                |
| Configuration             | `@nestjs/config` + `.env`                   | Validated with class-validator             |
| Validation                | `class-validator` + `class-transformer`     | DTOs for requests and environment          |
| Logging                   | `morgan`                                    | HTTP request logging                       |
| Security                  | `helmet` + CORS + API Key                   | Standard production hardening              |
| API Versioning            | URI versioning (`/v1/...`)                  | NestJS built-in                            |
| Documentation             | Swagger (`@nestjs/swagger`)                 | Auto-generated OpenAPI                     |
| Testing                   | Jest (unit) + Supertest (e2e)               |                         |

## 3. Functional Requirements

### 3.1 Endpoints

| Method | Path                  | Description                                      | Auth     |
|--------|-----------------------|--------------------------------------------------|----------|
| `HEAD` | `/health/ping`        | Liveness probe. Returns `200 OK` with no body.   | Public   |
| `POST` | `/v1/transactions`    | Creates a transaction + corresponding receivable | API Key  |

> All business endpoints must be versioned under `/v1`.

### 3.2 POST `/v1/transactions` – Behaviour

1. Validate incoming payload (DTO).
2. Obtain **2 unique sequential IDs** from the Numerator API **before** any write (using optimistic concurrency with retries).
3. Create the **Transaction** in json-server.
4. Calculate fee and create the **Receivable** in json-server.
5. Return a consistent response containing both resources.

#### Fee Rules

| Payment Method | Fee  | Receivable Status | Payment Date      |
|----------------|------|-------------------|-------------------|
| `debit_card`   | 2%   | `paid`            | Same day (D+0)    |
| `credit_card`  | 4%   | `waiting_funds`   | Creation + 30 days|

- `discount` = fee amount (not percentage)
- `total` = `subtotal - discount`
- Card number must be stored and returned **masked** (only last 4 digits).

### 3.3 ID Generation Strategy

- Use **only** the Numerator API (`test-and-set` preferred).
- Implement a retry loop with max attempts + short backoff.
- Convert numeric IDs to **strings** (json-server requirement).
- Obtain **both** IDs before performing any insert to avoid orphan records.

## 4. Non-Functional Requirements

### 4.1 Configuration & Environment

- All configuration via `.env` file.
- Environment variables must be validated at bootstrap using a dedicated class (`class-validator` + `class-transformer`).
- Example variables:
  - `PORT`
  - `NUMERATOR_API_URL`
  - `JSON_SERVER_URL`
  - `API_KEY`
  - `NODE_ENV`
  - etc.

### 4.2 Security

- `helmet` enabled.
- CORS configured (origins to be defined).
- Global API Key guard (header: `x-api-key`) for protected endpoints.
- Health check remains public.

### 4.3 Observability

- Morgan middleware for every incoming HTTP request.
- Structured error responses.

### 4.4 Documentation

- Full Swagger UI available at `/docs` (or `/api`).
- DTOs fully annotated with `@ApiProperty`.

### 4.5 Testing

- Unit tests for services and ID generation logic.
- E2E tests for the full orchestration flow.

## 5. External Dependencies (provided)

| Service       | Base URL (default)                  | Responsibility                     |
|---------------|---------------------------|------------------------------------|
| json-server   | `http://localhost:8080`   | Transactions & Receivables storage |
| Numerator API | `http://localhost:3000`   | Unique sequential ID generation    |

## 6. Project Structure (proposed)

```text
src/
├── config/                 # Validated environment config
├── common/                 # Filters, guards, interceptors, pipes
├── health/                 # Health module
├── transactions/           # Main orchestration module
│   ├── dto/
│   ├── transactions.controller.ts
│   ├── transactions.service.ts
│   └── ...
├── numerator/              # Numerator client + retry logic
├── json-server/            # json-server client
├── main.ts
└── app.module.ts
```

<!-- DO NOT DELETE NEXT SECTION -->

## Important Note for AI Agents

All agents working on this project MUST adhere to the workflows and rules outlined in [AI Agent Onboarding document](../../AGENTS.md).

Before starting any task:

1. **Review `AGENTS.md`**: is the primary source of instructions for agents.
2. **Follow Workflows**: follow the procedures defined in `.agent/WORKFLOWS.md`, especially the `.kilo/commands/critical-workflow.md`.

<!-- END DO NOT DELETE -->
