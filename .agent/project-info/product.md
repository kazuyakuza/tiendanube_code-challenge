# Product — Orchestration API

## Problem Definition

Merchants sell through a storefront and get paid by card. Every card sale creates
two records that must stay consistent:

- A **transaction**: the customer-facing charge (amount, description, payment method, card data).
- A **receivable**: the merchant-facing payout (what the merchant receives after the platform fee).

Today there is no service that creates both in one operation. The Orchestration API
solves this: one authenticated call creates the transaction and its corresponding
receivable atomically-like, applying fee rules and guaranteeing unique IDs.

## Merchant-Facing Flow

1. Merchant submits a payment: amount, description, payment method (`debit_card` or
   `credit_card`), card number, cardholder name, expiration date (MM/YY) and CVV.
2. API validates the payload (DTO validation, 422 on invalid input).
3. API obtains 2 unique sequential IDs from the Numerator API (one for the
   transaction, one for the receivable) BEFORE any write, so no orphan records exist.
4. API creates the transaction in json-server.
5. API computes the fee and creates the receivable in json-server.
6. API returns both resources in one consistent response.

## Fee Rules

The canonical fee rules table (fee %, receivable status, payment date per
payment method) lives in `brief.md` §3.2 — Fee Rules. Do not duplicate it here.

- `discount` holds the **fee percentage** as a string: `"2"` for debit_card, `"4"`
  for credit_card (matches the seed data in `config/db.json`).
- `total` = `subtotal × (1 − discount/100)`. Example: subtotal "340.50",
  discount "2" → total "333.69" (340.50 × 0.98).
- The fee is calculated based on the transaction's total amount.

## Privacy & Masking

- The card number is sensitive information: only the **last 4 digits** may be
  stored and returned (seed data already stores masked values like "3486").
- Full card data is accepted in the request but never persisted beyond the mask.

## Success Criteria

1. **Atomicity-like consistency**: both the transaction and the receivable are
   created from a single request; both IDs are reserved before any insert.
2. **Unique sequential IDs**: generated only via the Numerator API (never UUID),
   safe under concurrent requests (test-and-set + retries).
3. **Correct fee math**: discount/total follow the fee rules table for each method.
4. **Data privacy**: card numbers stored and returned masked (last 4 digits).
5. **Production readiness**: validated config, security hardening, HTTP logging,
   OpenAPI docs, unit + e2e tests.
