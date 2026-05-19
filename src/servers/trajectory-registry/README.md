# Trajectory Registry Server

## Summary

- This directory contains the standalone trajectory registry runtime for modular MDsrv deployments.
- It exists to store registered trajectories and expose XTC frame streaming without changing the legacy remote-session server.
- The runtime entrypoint is `index.ts`.
- The first supported format is `.xtc` only.

## What

- Serves trajectory list, create-from-URL, delete, frame-start index, legacy single-frame streaming, convenience frame-by-start, and explicit multi-frame range endpoints.
- Persists trajectory metadata in `index.json` and stores payloads under `files/` inside the configured working folder.
- Persists a lazy frame-start sidecar index next to `.xtc` files after the first streaming request.
- Persists JSONL access logs for trajectory API requests and exposes aggregated monitoring data plus a simple plot page.
- Exposes Swagger/OpenAPI docs for the module API.

## Why

- Trajectory storage and streaming should be a separate building block in the modular server setup.
- Keeping this logic outside `remote-session` preserves the current deployment while enabling proxy-based routing changes.
- Starting with XTC-only keeps parity with the existing remote-session trajectory streaming model.

## How

- **Use:** Start `index.ts` with `--working-folder` and optional `--port`/`--api-prefix`.
- **Use:** Trajectory files are stored under `<working-folder>/files`, with metadata in `<working-folder>/index.json`.
- **Use:** `GET /api/v1/trajectory/:id/starts` builds or reuses the cached frame-start index and returns a comma-separated list of byte offsets.
- **Use:** `GET /api/v1/trajectory/:id/frame/offset/:start/:end` returns exactly one frame. `end` is an exclusive upper bound and is typically the next frame start or `Infinity`.
- **Use:** `GET /api/v1/trajectory/:id/frame/start/:start` resolves the next frame boundary from the cached starts index and returns exactly one frame.
- **Use:** `GET /api/v1/trajectory/:id/frame-range/index/:index/:count` returns a consecutive batch of complete frames by zero-based frame index and frame count.
- **Use:** Request logs are written to `<working-folder>/logs/requests.jsonl` without payloads.
- **Use:** `GET /api/v1/trajectory/monitor/requests` aggregates request logs into time buckets and groups each bucket by request type. Useful query params are `from`, `to`, `bucket`, `trajectoryId`, `endpoint`, and `status`. Supported bucket units are `m`, `h`, `d`, and `month`.
- **Use:** `GET /api/v1/trajectory/monitor/plot` renders four full-width live D3 plots by default: last hour/1 minute, last 24 hours/1 hour, last 31 days/1 day, and last 365 days/1 month. Each plot has its own bucket-size dropdown and legend.
- **Use:** The API accepts and streams only `.xtc` files.
- **Extend:** Add `.dcd` and `.trr` support here later instead of extending `remote-session`.
- **Integrate:** Route `/api/v1/trajectory` to this service at the proxy layer.
