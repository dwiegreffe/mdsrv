# Volume Server

## Summary
- This directory contains the volume/density server and its related packing/query CLIs.
- It exists to convert map data into the internal volume format and serve sub-volume queries over HTTP.
- `server.ts` starts the HTTP service; `pack.ts` and `query.ts` are the main CLI entrypoints.
- The key extension points are the pack pipeline, query engine, and web API mapping.

## What
- Serves density map metadata and region queries.
- Packs source formats such as CCP4 and DSN6 into the server's internal format.
- Supports local query execution outside HTTP.
- Separates shared binary/data helpers, query logic, algebra, and format providers into subdirectories.
- Does not handle atomic structure queries; that lives in `../model`.

## Why
- Density data has different storage, query, and performance constraints than structure data.
- Splitting pack-time and query-time concerns keeps the server easier to understand.
- The subdirectory layout already reflects clear domain boundaries and is a good model for the smaller servers.

## How
- **Use:** Start `server.ts` for the HTTP API.
- **Use:** Run `pack.ts` to create packed volume files and `query.ts` for local batch queries.
- **Extend:** Put new query behavior in `server/query/`, math helpers in `server/algebra/`, and format support in `pack/format/`.
- **Integrate:** Shared Swagger UI comes from `../common/swagger-ui`.
- **Watch out:** Keep file-format concerns in `pack`/`common` and runtime request concerns in `server`.
