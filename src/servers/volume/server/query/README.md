# Volume Query Engine

## Summary
- This directory contains the core execution pipeline for volume-data queries.
- It exists to turn a query box and packed source file into an encoded result.
- `../api.ts` and `../web-api.ts` call into this directory.
- The main extension points are block identification, composition, encoding, and query data models.

## What
- Defines the query-time data model and execution context.
- Chooses appropriate sampling levels and block sets.
- Reads and composes requested regions from packed volume files.
- Encodes results for downstream writers.
- Does not parse HTTP requests directly.

## Why
- Query execution is the most domain-specific part of the volume runtime.
- Keeping it isolated makes transport and geometry layers easier to understand.
- The pipeline split also makes performance-sensitive logic easier to inspect and tune.

## How
- **Use:** Enter through `execute.ts`; supporting modules handle identification, composition, and encoding.
- **Use:** Keep HTTP parameter normalization outside this directory.
- **Extend:** Add new execution steps as focused modules instead of enlarging one file.
- **Integrate:** Reuse `../algebra` for spatial math and `../../common` for file/header access.
- **Watch out:** Preserve the distinction between planning a query and formatting an HTTP response.
