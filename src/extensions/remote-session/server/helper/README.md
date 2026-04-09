# Remote Session Server Helpers

## Summary
- This directory contains small helper modules used by the remote-session server.
- It exists to keep utility code out of the server entrypoint.
- `index.ts` depends on these helpers for filesystem setup, ids, timestamps, and trajectory file access.
- The main extension point is adding narrowly scoped support utilities for this server only.

## What
- Provides local utility functions such as UUID creation and directory creation.
- Includes trajectory-specific helper logic used when reading uploaded files.
- Keeps low-level support code separate from route and storage orchestration.
- Does not define HTTP routes or OpenAPI schemas.

## Why
- The remote-session server already has a large runtime file, so small reusable utilities should stay factored out.
- Keeping helpers local avoids coupling this server to unrelated shared utility layers.
- This separation also makes future refactoring into storage/services/routes easier.

## How
- **Use:** Import from here only for small server-local helper behavior.
- **Extend:** Keep helpers focused and infrastructure-like rather than business-logic heavy.
- **Integrate:** Promote code to a broader shared location only if multiple server trees truly need it.
- **Watch out:** Do not let this directory become a second catch-all runtime layer.
