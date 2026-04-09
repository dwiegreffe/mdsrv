# Model Properties

## Summary
- This directory defines optional property attachments for model data.
- It exists to enrich served structures with external annotations and derived metadata.
- `property-provider.ts` composes the providers from here into the model server pipeline.
- The main extension point is adding new property modules or provider backends.

## What
- Contains property attachment entry modules such as PDBe and wwPDB integrations.
- Bridges high-level property selection to lower-level provider implementations.
- Keeps enrichment logic separate from query execution and preprocessing orchestration.
- Does not own HTTP routing or CLI argument parsing.

## Why
- External annotations change independently from query logic.
- This split keeps model enrichment discoverable without mixing it into server request handling.
- It also allows preprocessing and serving flows to share the same property mechanism.

## How
- **Use:** Configure property sources through the model server configuration and `property-provider.ts`.
- **Use:** Keep high-level property entry modules here and backend-specific details in `providers/`.
- **Extend:** Add a new property source by exposing an attach function and wiring it into the provider registry.
- **Integrate:** Reuse shared fetch and caching helpers from `../utils` where appropriate.
- **Watch out:** Property code should enrich models, not take over query routing or file management.
