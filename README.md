# MDsrv

## Introduction

MDsrv is a web tool for interactive and remote exploration of trajectories. Interactive visualization of MD trajectories provides an instant, transparent, and intuitive understanding of complex dynamics, while sharing of MD trajectories may generate transparency and trust, allowing collaboration, knowledge exchange, and data reuse.
## Install via docker

Checkout repo.

### Build and run remote server

#### ARM64 (Apple Silicon / ARM Linux)

From project root:

```bash
docker build --no-cache -f docker/server/Dockerfile.arm64 -t proteinvis/mdsrv-remote:arm64 .
docker run --rm -p 1337:1337 -v "/path/to/mdsrv/server:/mdsrv/server" proteinvis/mdsrv-remote:arm64
```

The server is available at `http://127.0.0.1:1337`.

#### x86_64 (AMD64)

From project root:

```bash
docker build --no-cache -t proteinvis/mdsrv-remote ./docker/server
docker run --rm -p 1337:1337 -v "/path/to/mdsrv/server:/mdsrv/server" proteinvis/mdsrv-remote
```

The server is available at `http://127.0.0.1:1337`.

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
