# Docker Compose Setup for Remote Session + YAML API

This setup runs three separate containers:

- `mdsrv-remote-session` behind a reverse proxy
- `mdsrv-yml-server` behind a reverse proxy
- `mdsrv-proxy` as the single external entry point

It uses one shared Compose file and one shared multi-stage app Dockerfile on both ARM64 and AMD64.

Both services are reachable through the same host IP address and the same external port from outside Docker:

- `<host-ip>:1337/docs` for unified API docs
- `<host-ip>:1337/api/v1/session...` for session endpoints
- `<host-ip>:1337/api/v1/trajectory...` for trajectory endpoints
- `<host-ip>:1337/api/v1/yaml...` for the YAML API

The storage is intentionally split into two host directories so the data stays separated.

## Host data directories

- `docker/data/remote-session/`
- `docker/data/yml/`

The containers mount them like this:

- `docker/data/remote-session/ -> /mdsrv/remote-session`
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

This is the existing remote-session server for sessions and trajectory streaming.

Its files are stored in:

- `docker/data/remote-session/`

### 2. YAML file API

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

## Test the YAML API

Create a file:

```bash
curl -i -X PUT "http://127.0.0.1:1337/api/v1/yaml/test.yml" \
  -H "Content-Type: text/yaml" \
  --data-binary $'name: test\nversion: 1\n'
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
  --data-binary $'name: test\nversion: 2\n'
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
  "forbiddenWords": ["password", "secret"],
  "forbiddenKeys": ["debug", "internal"],
  "requiredKeys": ["name", "version"],
  "maxFileSizeBytes": 65536
}
```

If you want custom rules later, the compose file can be changed to mount your own JSON file and pass its path via `--yml-rules`.
