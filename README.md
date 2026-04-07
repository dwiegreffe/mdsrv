# MDsrv

## Introduction

MDsrv is a web tool for interactive and remote exploration of trajectories. Interactive visualization of MD trajectories provides an instant, transparent, and intuitive understanding of complex dynamics, while sharing of MD trajectories may generate transparency and trust, allowing collaboration, knowledge exchange, and data reuse.
## Install via docker

Checkout repo.

### Build and run servers

This setup uses one shared multi-stage app Dockerfile and one shared Docker Compose file for both ARM64 and AMD64.

#### Docker Compose (recommended)

This starts separate services with separate host data directories:

- remote session / trajectory streaming on `http://127.0.0.1:1337`
- YAML file API on `http://127.0.0.1:1337/yml`

Internally this uses three containers:

- `mdsrv-remote-session`
- `mdsrv-yml-server`
- `mdsrv-proxy`

Both are reachable through the same host IP and the same external port from outside Docker.

Build and start:

```bash
docker compose up --build
```

Run in background:

```bash
docker compose up --build -d
```

Stop:

```bash
docker compose down
```

The split host data directories are:

- `docker/data/remote-session/`
- `docker/data/yml/`

Both services are reachable through the same host IP and the same external port from outside Docker:

- `<host-ip>:1337` for remote session / trajectory streaming
- `<host-ip>:1337/yml` for the YAML API

#### Build minimized runtime images directly

Build the remote-session runtime image:

```bash
docker build --target remote-session-runtime -f docker/server/Dockerfile -t mdsrv-remote-session .
```

Build the YAML server runtime image:

```bash
docker build --target yml-server-runtime -f docker/server/Dockerfile -t mdsrv-yml-server .
```

### Build and run viewer

From project root:

```bash
docker build --no-cache -t proteinvis/mdsrv-viewer ./docker/viewer
docker run --rm -p 80:4242 proteinvis/mdsrv-viewer http://host.docker.internal:1337
```

Open the viewer at `http://127.0.0.1`.

### Docker quick commands (compact)

```bash
# running containers
docker ps

# logs
docker logs <container>
docker logs -f <container>
docker logs --tail 100 <container>
docker logs --since 10m <container>
docker logs -t <container>

# stop container
docker stop <container>
```

## Docker Compose

For the split setup with separate containers and separate host data directories:

- remote session / trajectory streaming on `1337`
- YAML file API on `1337/yml`

see [docs/docker-compose.md](docs/docker-compose.md).

Standalone YAML server endpoint and storage details are documented in [docs/yml-server.md](docs/yml-server.md).

## Git remotes and branch strategy (mdsrv-anno)

This repository is now set up with a dedicated `anno/*` branch namespace so work on the annotation-focused version does not interfere with other active branches.

### Remote naming

- `origin`: canonical remote for this project (`mdsrv-anno` on GitLab)
- `fork-source`: original upstream fork source (former `origin`, GitHub)

Why this naming:

- `origin` stays the default target for day-to-day pushes and PRs for this project.
- `fork-source` makes it explicit where this codebase was forked from.

### Branch naming

- `anno/develop`: integration branch for ongoing annotation-focused development
- `anno/feature/<ticket>-<short-name>`: short-lived feature branches
- `anno/release/vX.Y`: release preparation branch
- `anno/stable/vX.Y`: stable maintenance branch for patch-level fixes
- `anno/hotfix/vX.Y.Z-<short-name>`: urgent production fixes

Recommended examples:

- `anno/feature/MD-142-special-yml-support`
- `anno/release/v2.4`
- `anno/stable/v2.4`
- `anno/hotfix/v2.4.1-yml-null-fix`

Use tags instead of a moving `latest` branch, e.g. `anno-v2.4.0`.
