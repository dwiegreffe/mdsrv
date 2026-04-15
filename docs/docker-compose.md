# Docker Compose Setup for Modular Session, Trajectory, Topology + YAML APIs

This setup runs five separate containers:

- `mdsrv-remote-session` behind a reverse proxy
- `mdsrv-trajectory-registry` behind a reverse proxy
- `mdsrv-topology-registry` behind a reverse proxy
- `mdsrv-yml-server` behind a reverse proxy
- `mdsrv-proxy` as the single external entry point

For external app developers, the recommended handoff document is [api-usage-guide.md](api-usage-guide.md).

It uses one shared Compose file and one shared multi-stage app Dockerfile on both ARM64 and AMD64.

All services are reachable through the same host IP address and the same external port from outside Docker:

- `<host-ip>:1337/docs` for unified API docs
- `<host-ip>:1337/api/v1/session...` for session endpoints
- `<host-ip>:1337/api/v1/trajectory...` for trajectory endpoints
- `<host-ip>:1337/api/v1/topology...` for topology endpoints
- `<host-ip>:1337/api/v1/yaml...` for the YAML API

The storage is intentionally split into four host directories so the data stays separated.

## Host data directories

- `docker/data/remote-session/`
- `docker/data/trajectory-registry/`
- `docker/data/topology-registry/`
- `docker/data/yml/`

The containers mount them like this:

- `docker/data/remote-session/ -> /mdsrv/remote-session`
- `docker/data/trajectory-registry/ -> /mdsrv/trajectory-registry`
- `docker/data/topology-registry/ -> /mdsrv/topology-registry`
- `docker/data/yml/ -> /mdsrv/yml-server`

## Start services

From the repository root:

```bash
docker compose up --build
```

To run in the background:

```bash
docker compose up --build -d
```

To stop them:

```bash
docker compose down
```

From another machine on the network, replace `127.0.0.1` with the host machine IP. Example:

- `http://192.168.1.50:1337`
- `http://192.168.1.50:1337/docs`
- `http://192.168.1.50:1337/api/v1/yaml`

## Services

### 1. Remote session / trajectory streaming

Available at:

- `http://127.0.0.1:1337/api/v1/session`

This is the existing remote-session server for sessions.

Its files are stored in:

- `docker/data/remote-session/`

### 2. Trajectory registry / XTC streaming

Available at:

- `http://127.0.0.1:1337/api/v1/trajectory`

This runs the standalone trajectory registry and XTC frame streaming service.

Its files are stored in:

- `docker/data/trajectory-registry/`

### 3. Topology registry

Available at:

- `http://127.0.0.1:1337/api/v1/topology`

This runs the standalone topology registry service.

Its files are stored in:

- `docker/data/topology-registry/`

### 4. YAML file API

Available at:

- `http://127.0.0.1:1337/api/v1/yaml`

This runs the standalone YAML server.

Its files are stored in:

- `docker/data/yml/`

YAML files are written under:

- `docker/data/yml/files/`

Unified docs are available at:

- `http://127.0.0.1:1337/docs`

## Build minimized runtime images directly

Build the remote-session runtime image:

```bash
docker build --target remote-session-runtime -f docker/server/Dockerfile -t mdsrv-remote-session .
```

Build the YAML server runtime image:

```bash
docker build --target yml-server-runtime -f docker/server/Dockerfile -t mdsrv-yml-server .
```

Build the trajectory registry runtime image:

```bash
docker build --target trajectory-registry-runtime -f docker/server/Dockerfile -t mdsrv-trajectory-registry .
```

Build the topology registry runtime image:

```bash
docker build --target topology-registry-runtime -f docker/server/Dockerfile -t mdsrv-topology-registry .
```

## Proxy routing overrides

The nginx proxy config is now rendered from environment variables at container startup.

Default upstreams:

- `MDSRV_SESSION_UPSTREAM=mdsrv-remote-session:1337`
- `MDSRV_TRAJECTORY_UPSTREAM=mdsrv-trajectory-registry:1341`
- `MDSRV_TOPOLOGY_UPSTREAM=mdsrv-topology-registry:1342`
- `MDSRV_YAML_UPSTREAM=mdsrv-yml-server:1340`
- `MDSRV_CLIENT_MAX_BODY_SIZE=11g`

Default upload limits in the Docker setup:

- `MDSRV_TOPOLOGY_UPLOAD_LIMIT=1gb`
- `MDSRV_TRAJECTORY_UPLOAD_LIMIT=10gb`

Code defaults outside Docker are smaller:

- topology registry: `256mb`
- trajectory registry: `1gb`

Example override to keep `/api/v1/trajectory` on the legacy remote-session service while testing:

```bash
MDSRV_TRAJECTORY_UPSTREAM=mdsrv-remote-session:1337 docker compose up --build
```

Example override to reduce upload limits temporarily:

```bash
MDSRV_TOPOLOGY_UPLOAD_LIMIT=128mb MDSRV_TRAJECTORY_UPLOAD_LIMIT=2gb docker compose up --build
```

## Test the YAML API

Create a file:

```bash
curl -i -X PUT "http://127.0.0.1:1337/api/v1/yaml/test.yml" \
  -H "Content-Type: text/yaml" \
  --data-binary $'schemaVersion: 1\nname: test\n'
```

List files:

```bash
curl http://127.0.0.1:1337/api/v1/yaml
```

Read file:

```bash
curl http://127.0.0.1:1337/api/v1/yaml/test.yml
```

Update file:

```bash
curl -i -X POST "http://127.0.0.1:1337/api/v1/yaml/test.yml" \
  -H "Content-Type: text/yaml" \
  --data-binary $'schemaVersion: 2\nname: test\n'
```

Rename file:

```bash
curl -i -X POST "http://127.0.0.1:1337/api/v1/yaml/test.yml/rename?to=test-v2.yml"
```

Delete file:

```bash
curl -i -X DELETE "http://127.0.0.1:1337/api/v1/yaml/test-v2.yml"
```

## Validation rules

The YAML service uses the example rules file baked into the image:

- `/app/docs/yml-rules.example.json`

Current example rules:

```json
{
  "requiredKeys": ["schemaVersion"]
}
```

In the default Docker setup, YAML files are expected to define `schemaVersion` at the top level.

If you want custom rules later, the compose file can be changed to mount your own JSON file and pass its path via `--yml-rules`.
