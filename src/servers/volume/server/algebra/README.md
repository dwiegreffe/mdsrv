# Volume Algebra Helpers

## Summary
- This directory contains the coordinate and box math used by the volume query engine.
- It exists to keep geometric transformations separate from request handling and file I/O.
- The volume server query pipeline depends on these helpers heavily.
- The extension point is adding reusable math primitives that support query planning and execution.

## What
- Defines coordinate types and conversions between cartesian, fractional, and grid spaces.
- Implements box operations used to intersect, expand, and normalize query regions.
- Provides pure math helpers for the volume runtime.
- Does not read files or handle HTTP responses.

## Why
- Volume querying depends on careful coordinate transforms and box calculations.
- Pulling the math into its own directory makes the query engine easier to follow.
- It also reduces the chance of mixing geometry mistakes with transport or storage code.

## How
- **Use:** Keep coordinate/box transformations here and call them from `../query`.
- **Extend:** Prefer pure functions and explicit types over hidden state.
- **Integrate:** Let higher layers translate HTTP params into these algebra primitives.
- **Watch out:** Avoid slipping file-format assumptions into these math helpers.
