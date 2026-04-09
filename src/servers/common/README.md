# Common Server Utilities

## Summary
- This directory contains shared helpers used by multiple server modules.
- It exists to avoid repeating small HTTP and filesystem utilities across servers.
- `model`, `volume`, `plugin-state`, and `yml-server` depend on pieces from here.
- The main extension point is adding narrowly scoped helpers that are genuinely shared.

## What
- Holds cross-server utilities rather than runnable services.
- Includes HTTP-facing support such as Swagger UI wiring.
- Includes low-level helpers such as file-handle wrappers and general utility functions.
- Does not own any server-specific business rules.

## Why
- Shared infrastructure code is easier to maintain in one place than copied across servers.
- These helpers support consistent docs exposure and common request/response behavior.
- The directory is intentionally small so it stays a dependency layer, not a dumping ground.

## How
- **Use:** Import from here when the same helper is needed in more than one server tree.
- **Extend:** Add only generic utilities with clear cross-server value.
- **Extend:** Prefer small focused modules over one broad helper file.
- **Integrate:** Keep server-specific rules in their own server directories even if they also touch HTTP or files.
- **Watch out:** If a helper only serves one server, keep it local to that server instead of growing `common`.
