# Volume Server Runtime

## Summary
- This directory contains the HTTP-facing runtime for serving packed volume data.
- It exists to map HTTP requests to metadata reads and sub-volume query execution.
- `../server.ts` boots the Express app and delegates most runtime work here.
- The main extension points are web API wiring, query execution, and algebra/query helpers.

## What
- Serves map headers and box/cell queries.
- Builds filenames from configured source/id mappings.
- Encodes query results for HTTP responses.
- Hosts the OpenAPI schema and Swagger docs integration.
- Does not pack source files; that belongs to `../pack`.

## Why
- Runtime query serving needs its own boundary separate from offline data preparation.
- The split between API wiring, query execution, and algebra keeps the server maintainable.
- This structure makes it easier to adjust transport concerns without touching the data engine.

## How
- **Use:** `web-api.ts` wires the HTTP routes and docs; `api.ts` bridges requests into the query engine.
- **Use:** Keep shared runtime state and versioning local to this directory.
- **Extend:** Add request-time query behavior under `query/` and reusable coordinate helpers under `algebra/`.
- **Integrate:** Swagger UI comes from `../../common/swagger-ui`.
- **Watch out:** Runtime code should assume packed inputs already exist and should not absorb packer responsibilities.
