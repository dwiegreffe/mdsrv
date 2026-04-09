# Plugin State Server

## Summary
- This directory contains the small file-backed plugin state server.
- It exists to store, list, fetch, and remove serialized plugin state payloads.
- The runtime entrypoint is `index.ts`.
- The primary extension points today are request routing, storage layout, and API schema generation.

## What
- Stores JSON state blobs in a working directory.
- Maintains an index file with metadata such as id, name, description, and timestamp.
- Serves a small HTTP API plus Swagger/OpenAPI docs.
- Enforces a retention limit through `max_states` and sticky-state behavior.
- Does not manage richer domain data beyond persisted plugin states.

## Why
- Plugin states need a lightweight persistence endpoint separate from heavier structure/volume services.
- A file-backed approach keeps deployment simple and easy to inspect.
- The server is intentionally narrow in scope so it can stay operationally simple.

## How
- **Use:** Start `index.ts` with a working folder and optional port/API prefix.
- **Use:** The server reads and writes JSON files plus an `index.json` metadata list in that folder.
- **Extend:** Keep API schema changes in `api-schema.ts` aligned with route behavior.
- **Extend:** If the server grows, split storage, retention, and route logic before adding more endpoint surface.
- **Watch out:** This directory currently concentrates too much logic in one entry file; keep new changes modular.
