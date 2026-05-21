# MDsrv Backend

## Summary
- Backend-only MDsrv API services for storing sessions, topologies, trajectories, and YAML metadata.
- The Mol* viewer/frontend and legacy Mol* model/volume servers are intentionally out of scope.
- Docker Compose is the primary runtime entrypoint.
- External clients use the unified proxy on port `1337`.
- New backend behavior should be added as a focused service or route behind the proxy.

## What
- Provides four Node/Express services: remote sessions, topology registry, trajectory registry, and YAML storage.
- Exposes a single public API surface through the Nginx proxy at `/api/v1/*` plus `/docs`.
- Stores runtime data in `docker/data/*` host-mounted directories.
- Builds TypeScript backend sources into CommonJS output for Docker runtime images.
- Does not ship a browser viewer, WebGL renderer, webpack build, or Mol* model/volume server binaries.

## Why
- Keeps this repository focused on the deployed Docker backend that is actually used.
- Reduces build time, dependency surface, and maintenance work by removing unused frontend/shared Mol* code.
- Accepts a breaking cleanup because the project is pre-release and legacy behavior is not preserved.
- Keeps service boundaries explicit: each backend service owns its own storage and API schema.

## How
- **Run:** start the backend stack with `docker compose up --build`.
- **Run detached:** use `docker compose up --build -d`; stop it with `docker compose down`.
- **Use:** open API docs at `http://127.0.0.1:1337/docs`.
- **Use:** call `/api/v1/session`, `/api/v1/topology`, `/api/v1/trajectory`, and `/api/v1/yaml` through the proxy.
- **Build locally:** run `npm install` and `npm run build-tsc`.
- **Extend:** add service code under `src/servers/*` or `src/extensions/remote-session/server`, then include it in `tsconfig.commonjs.json`.
- **Integrate:** update `docker/server/Dockerfile`, `docker-compose.yml`, and `docker/proxy/nginx.conf.template` when adding a new service.
- **Watch out:** generated output (`lib/`) and runtime data (`docker/data/`) are not source of truth.

Additional operational docs:

- Docker Compose: [docs/docker-compose.md](docs/docker-compose.md)
- API usage guide: [docs/api-usage-guide.md](docs/api-usage-guide.md)
- YAML server: [docs/yml-server.md](docs/yml-server.md)
