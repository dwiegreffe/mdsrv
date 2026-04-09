# Volume Packing

## Summary
- This directory contains the packer that converts source map files into the internal volume-server format.
- It exists to prepare query-efficient volume files ahead of runtime.
- `../pack.ts` is the CLI entrypoint and delegates into this directory.
- The main extension points are format providers, sampling logic, and output writing.

## What
- Opens source density files and validates that compatible channels line up.
- Chooses block sizes and sampling layouts for the packed output.
- Allocates and writes the packed volume file.
- Organizes format-specific readers separately from generic packing flow.
- Does not serve HTTP requests.

## Why
- Packing is an offline preparation step with different constraints than online querying.
- Isolating it here keeps the runtime server smaller and the conversion pipeline easier to evolve.
- The format/provider split makes support for new input types more manageable.

## How
- **Use:** Run `src/servers/volume/pack.ts`; it parses CLI args and calls into this directory.
- **Use:** Choose the correct input mode and source format before packing.
- **Extend:** Add new input support in `format/` and keep the orchestration in `main.ts` generic.
- **Integrate:** Reuse `../common` helpers for internal file/header operations.
- **Watch out:** Keep runtime query logic out of the packer; this directory is for build-time conversion.
