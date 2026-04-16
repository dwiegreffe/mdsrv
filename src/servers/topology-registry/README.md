# Topology Registry Server

## Summary
- This directory contains the standalone topology registry runtime for modular MDsrv deployments.
- It exists to store and expose registered topology files without adding more responsibilities to the legacy remote-session server.
- The runtime entrypoint is `index.ts`.
- The first supported format is `.pdb` only.

## What
- Serves topology list, create-from-URL, fetch, and delete endpoints.
- Persists topology metadata in `index.json` and stores payloads under `files/` inside the configured working folder.
- Exposes Swagger/OpenAPI docs for the module API.

## Why
- The server transition should add new building blocks instead of growing the current remote-session runtime.
- Topology files have different lifecycle and storage concerns than sessions or trajectory streaming.
- A dedicated file-backed module makes proxy-based composition explicit.

## How
- **Use:** Start `index.ts` with `--working-folder` and optional `--port`/`--api-prefix`.
- **Use:** Topology files are stored under `<working-folder>/files`, with metadata in `<working-folder>/index.json`.
- **Use:** The initial API accepts and serves only `.pdb` files.
- **Extend:** Add `.cif` and `.mmcif` support here later instead of extending `remote-session`.
- **Integrate:** Route `/api/v1/topology` to this service at the proxy layer.
