# Backend Services

## Summary
- Contains the backend service source deployed by Docker Compose.
- Exposes storage-oriented HTTP APIs for YAML files, trajectories, and topologies.
- Shared API documentation helpers live in `common`.
- The remote-session service lives under `src/extensions/remote-session/server`.
- Legacy model, volume, plugin-state, and frontend server code are intentionally removed.

## What
- Owns Express services that are compiled into `lib/commonjs` for runtime images.
- Keeps service-specific validation, persistence, and OpenAPI schema definitions near each service.
- Shares only generic HTTP/docs helpers through `common`.
- Does not contain the Nginx proxy, Docker orchestration, or browser viewer code.

## Why
- Keeps the deployed backend small and easy to audit.
- Avoids carrying unused Mol* server families that are not part of the current Docker stack.
- Maintains clear service boundaries while still sharing repetitive Swagger UI wiring.

## How
- **Use:** run services through `docker compose up --build` from the repository root.
- **Use:** access them through the proxy under `/api/v1/yaml`, `/api/v1/trajectory`, and `/api/v1/topology`.
- **Extend:** add backend-only code inside the owning service directory.
- **Extend:** put cross-service docs/HTTP glue in `common`, not domain behavior.
- **Integrate:** update `tsconfig.commonjs.json`, `docker/server/Dockerfile`, and `docker/proxy/nginx.conf.template` when a new service is added.
