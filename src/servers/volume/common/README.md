# Volume Common Helpers

## Summary
- This directory contains low-level helpers shared by the volume packer and volume server runtime.
- It exists to centralize file and binary format primitives used across the volume stack.
- Both `pack/` and `server/` depend on these modules.
- The extension point is adding format-neutral helpers for the internal volume data model.

## What
- Provides basic file access helpers.
- Defines shared binary/header handling for the packed volume format.
- Supplies infrastructure-level utilities rather than HTTP or query logic.
- Does not own route handling, algebra, or query planning.

## Why
- Pack-time and query-time code both need the same low-level format operations.
- Keeping them here avoids duplication and reduces the risk of divergent format handling.
- This layer helps keep the higher-level server and packer code more declarative.

## How
- **Use:** Import from here when working with the packed volume file format itself.
- **Extend:** Keep helpers format-focused and neutral with respect to HTTP and CLI usage.
- **Integrate:** Use these modules from `pack/` and `server/query/` rather than reimplementing binary/file logic.
- **Watch out:** Avoid moving request-time policy or math logic into this directory.
