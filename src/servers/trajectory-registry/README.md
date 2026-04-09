# Trajectory Registry Server

## Summary
- This directory contains the standalone trajectory registry runtime for modular MDsrv deployments.
- It exists to store registered trajectories and expose XTC frame streaming without changing the legacy remote-session server.
- The runtime entrypoint is `index.ts`.
- The first supported format is `.xtc` only.

## What
- Serves trajectory list, create-from-URL, delete, frame-start, and frame-range endpoints.
- Persists trajectory metadata in `index.json` and stores payloads under `files/` inside the configured working folder.
- Exposes Swagger/OpenAPI docs for the module API.

## Why
- Trajectory storage and streaming should be a separate building block in the modular server setup.
- Keeping this logic outside `remote-session` preserves the current deployment while enabling proxy-based routing changes.
- Starting with XTC-only keeps parity with the existing remote-session trajectory streaming model.

## How
- **Use:** Start `index.ts` with `--working-folder` and optional `--port`/`--api-prefix`.
- **Use:** Trajectory files are stored under `<working-folder>/files`, with metadata in `<working-folder>/index.json`.
- **Use:** The initial API accepts and streams only `.xtc` files.
- **Extend:** Add `.dcd` and `.trr` support here later instead of extending `remote-session`.
- **Integrate:** Route `/api/v1/trajectory` to this service at the proxy layer.
