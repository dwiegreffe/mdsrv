# Model Preprocessing

## Summary
- This directory contains the preprocessing pipeline for model server source files.
- It exists to convert and enrich input CIF data before it is served.
- The main entry flow starts in `../preprocess.ts`, then dispatches into master/worker code here.
- The extension point is the conversion pipeline and parallel execution setup.

## What
- Coordinates single-file and folder-based preprocessing jobs.
- Supports parallel execution through cluster master/worker code.
- Applies custom property providers during conversion.
- Includes low-level conversion and utility helpers.
- Does not expose HTTP routes.

## Why
- Preprocessing has different performance and operational needs than request-time query serving.
- Splitting it out keeps the runtime server focused on reads while this code handles preparation.
- The master/worker split supports heavier batch workloads without leaking that complexity into the API layer.

## How
- **Use:** Invoke `src/servers/model/preprocess.ts`; it delegates into this directory.
- **Use:** Provide input/output paths or folder-based arguments through the CLI.
- **Extend:** Add new preprocessing stages in focused modules here rather than growing the entrypoint.
- **Extend:** Keep worker-safe logic separate from CLI argument parsing.
- **Integrate:** Property attachment is configured through `../property-provider.ts`.
- **Watch out:** This code is batch-oriented; avoid pulling request/response concerns into it.
