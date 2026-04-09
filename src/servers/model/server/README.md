# Model Server Runtime

## Summary
- This directory contains the HTTP and local execution layers for the model server.
- It exists to turn query definitions into runnable jobs and API responses.
- `../server.ts` boots the HTTP server and delegates most runtime behavior here.
- The main extension points are API route wiring, job orchestration, and response writers.

## What
- Maps HTTP requests to query jobs.
- Supports local API execution for batch workflows.
- Manages job queues, caching, and response formatting.
- Builds and serves the OpenAPI description and docs page.
- Does not define low-level query semantics; those live in `../query`.

## Why
- Request handling, job execution, and response streaming are runtime concerns distinct from domain query definitions.
- Keeping them here makes the boot file small and the query modules transport-agnostic.
- The same directory can serve both HTTP and local entry paths without duplicating orchestration logic.

## How
- **Use:** `api-web.ts` is the main web integration layer; `api-local.ts` handles local jobs.
- **Use:** Add new query exposure here after defining the query itself in `../query`.
- **Extend:** Keep route mapping, job scheduling, and response writing in separate modules.
- **Integrate:** Swagger UI comes from `../../common/swagger-ui`; result writers come from `../utils`.
- **Watch out:** Avoid moving domain query logic into route handlers; keep this layer orchestration-focused.
