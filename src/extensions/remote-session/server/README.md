# Remote Session Server

## Summary
- This directory contains the MDsrv remote-session and trajectory server runtime.
- It exists to store viewer sessions, register trajectories, and expose frame-level trajectory access over HTTP.
- The runtime entrypoint is `index.ts`.
- The main extension points are route splitting, storage/index handling, and API schema generation.

## What
- Serves session upload, list, fetch, and delete endpoints.
- Serves trajectory list, upload, delete, frame-start, and frame-range endpoints.
- Persists metadata in JSON index files and payloads in working-folder subdirectories.
- Exposes Swagger/OpenAPI docs for the public API.
- Does not live under `src/servers`, even though it behaves like one of the deployed server runtimes.

## Why
- Remote sessions and trajectories have different storage and API needs than the structure and volume servers.
- This service gives the deployment a small writable API for viewer state and streamed trajectory access.
- It currently concentrates many concerns in one file, so documenting the boundaries here helps before refactoring.

## How
- **Use:** Start `index.ts` with `--working-folder` and optional `--port`/`--api-prefix`.
- **Use:** Sessions are stored under `<working-folder>/session`, trajectories under `<working-folder>/trajectory`, with separate index files.
- **Extend:** Keep route/docs changes aligned with `api-schema.ts`.
- **Extend:** If you refactor, split storage, trajectory handling, session handling, and HTTP wiring into separate modules first.
- **Integrate:** The Docker runtime target `remote-session-runtime` starts this service in the current compose setup.
- **Watch out:** This service mixes legacy-style routes with newer `/api/v1/...` routes; avoid adding more duplicated endpoint shapes.
