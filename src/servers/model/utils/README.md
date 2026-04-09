# Model Server Utilities

## Summary
- This directory contains reusable support code for the model server runtime.
- It exists to keep generic I/O, fetch, tar, and writer helpers out of the API and query layers.
- The model server runtime and property providers depend on these helpers.
- The extension point is adding generic helpers with clear reuse across model-server modules.

## What
- Provides result writers for HTTP responses and files.
- Includes tar/gzip support for multi-result outputs.
- Includes fetch/retry and other utility helpers used by property providers and runtime code.
- Does not own query definitions or route registration.

## Why
- Streaming, archiving, and retry behavior are cross-cutting concerns.
- Pulling them into utilities keeps runtime code easier to scan and test.
- It also avoids transport and output details leaking into domain modules.

## How
- **Use:** Reuse these helpers from runtime and provider code instead of duplicating output or fetch logic.
- **Extend:** Add utilities only when they are broadly useful across the model server tree.
- **Extend:** Keep helpers small and infrastructure-oriented.
- **Integrate:** Writers should remain generic enough for both HTTP and file outputs.
- **Watch out:** Do not turn this directory into a catch-all for unrelated business logic.
