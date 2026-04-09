# Servers

## Summary
- This tree contains the server-side runtimes, CLIs, and shared helpers that ship with this repository.
- It exists to expose Mol* data through HTTP APIs and local batch tooling.
- The main server families here are `model`, `volume`, `plugin-state`, and `yml-server`.
- Shared HTTP/docs helpers live in `common`.
- The current Docker stack also includes the remote-session service, but its source lives in `src/extensions/remote-session/server`, not here.

## What
- `model` serves structure queries and local/batch preprocessing tools.
- `volume` serves density/volume queries and packer/query CLIs for the custom volume format.
- `plugin-state` is a small file-backed state storage server.
- `yml-server` is a small file-backed YAML CRUD API with validation.
- `common` holds reusable server helpers used across multiple server modules.
- This tree does not contain the reverse proxy or container orchestration files; those live under `docker/` and the repository root.

## Why
- The codebase has multiple server-style runtimes with different scopes but similar operational needs.
- Keeping them under one top-level tree makes shared HTTP patterns and data-serving code easier to find.
- The split between `model`, `volume`, and the smaller file-backed services keeps domain-heavy logic separate.
- The Docker deployment intentionally exposes only part of this tree today, so the source layout must stay explicit about what is reusable versus what is deployed.

## How
- **Use:** Start from each server's entrypoint (`server.ts`, `index.ts`, `pack.ts`, `query.ts`, or `preprocess.ts`) depending on whether you need an HTTP service or a CLI.
- **Use:** For the current containerized setup, `mdsrv-proxy` is the public entrypoint, `mdsrv-yml-server` serves YAML files, and `mdsrv-remote-session` serves sessions/trajectories from the extensions tree.
- **Use:** `model` and `volume` are the larger domain servers; `plugin-state` and `yml-server` are smaller storage-oriented services.
- **Extend:** Put shared HTTP or Swagger helpers into `common` instead of duplicating them in each server.
- **Extend:** Keep runnable entrypoints thin and move domain logic into focused subdirectories.
- **Watch out:** Not every deployed server lives under `src/servers`; document cross-tree runtime wiring when changing Docker or proxy behavior.
