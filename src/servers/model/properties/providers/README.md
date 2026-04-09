# Property Providers

## Summary
- This directory contains provider-specific implementations for external model properties.
- It exists to isolate source-specific fetching, parsing, and attachment logic.
- High-level property modules in `..` depend on these provider implementations.
- The primary extension point is adding another backend or source-specific adapter.

## What
- Implements integrations such as PDBe and wwPDB-backed property loading.
- Encapsulates remote fetches, file-backed fallbacks, and attachment-specific data shaping.
- Keeps backend details out of the rest of the model server.
- Does not define which providers are enabled; that happens higher up.

## Why
- External sources have different APIs, formats, and failure modes.
- Isolating them here keeps the rest of the model server cleaner and easier to reason about.
- It also makes provider-specific testing and replacement more contained.

## How
- **Use:** Call these modules through the property registry, not directly from unrelated server code.
- **Extend:** Add one module per source/backend and keep source-specific URL/config handling local.
- **Extend:** Reuse shared fetch/retry and logging helpers instead of duplicating transport logic.
- **Integrate:** Return attachment-friendly data and leave source selection to the upper layer.
- **Watch out:** Avoid bleeding backend-specific assumptions into query or preprocessing modules.
