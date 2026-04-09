# Remote Session Swagger UI

## Summary
- This directory contains the Swagger UI wrapper used by the remote-session server.
- It exists to serve the docs page and static Swagger assets for this runtime.
- `index.ts` mounts these handlers together with the schema from `../api-schema.ts`.
- The extension point is shared docs presentation for this server.

## What
- Serves Swagger UI assets.
- Renders the docs index HTML from a small template.
- Keeps docs-page wiring separate from the main server runtime.
- Does not define the API schema itself.

## Why
- The remote-session server predates the shared `src/servers/common/swagger-ui` helper and keeps a local copy.
- Isolating the docs wrapper here prevents the entrypoint from carrying template and asset details.
- Documenting this makes the duplication explicit, which helps future consolidation.

## How
- **Use:** Mount the asset handler and HTML handler from here in the runtime.
- **Extend:** Change this directory only for docs-page presentation changes specific to this server.
- **Integrate:** Keep endpoint definitions and schema content in `../api-schema.ts`.
- **Watch out:** This is functionally similar to `src/servers/common/swagger-ui`; if you simplify later, consider deleting the duplicate and reusing the shared version.
