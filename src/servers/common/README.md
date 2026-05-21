# Common Server Utilities

## Summary
- Contains shared helpers for backend HTTP services.
- Exists to avoid duplicating generic API documentation wiring.
- Used by backend services that expose Swagger UI pages.
- The main extension point is narrowly scoped code with clear cross-service value.

## What
- Holds reusable server support code rather than runnable services.
- Provides shared Swagger UI handlers and templates.
- Does not own persistence, validation, or API-specific business rules.

## Why
- Shared docs setup should behave consistently across backend services.
- Keeping common code small prevents hidden coupling between service domains.
- Service-specific behavior remains easier to reason about when it stays local.

## How
- **Use:** import from here only when a helper is needed by multiple services.
- **Extend:** prefer focused modules over broad utility buckets.
- **Integrate:** keep service routes and schemas in the owning service directory.
- **Watch out:** if a helper serves only one service, keep it local instead.
