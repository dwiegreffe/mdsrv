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
