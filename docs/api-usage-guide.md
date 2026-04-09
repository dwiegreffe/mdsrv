# MDsrv API Usage Guide

This guide is intended for developers building an external application that uses this server as a backend.

It describes the public API surface exposed by the server, the main workflows, and the request formats your app should use.

## Base URL

Assume the server is available at:

```text
http://127.0.0.1:1337
```

Replace this with your deployment URL in production.

## Public entry points

- Docs UI: `/docs`
- OpenAPI JSON: `/api/v1/openapi.json`
- Health check: `/health`

Main API namespaces:

- Session API: `/api/v1/session`
- Trajectory API: `/api/v1/trajectory`
- Topology API: `/api/v1/topology`
- YAML API: `/api/v1/yaml`

## API overview

### 1. Session API

Use this API to upload, list, download, and delete Mol* session archives.

Endpoints:

- `GET /api/v1/session`
- `POST /api/v1/session`
- `GET /api/v1/session/:id`
- `DELETE /api/v1/session/:id`

### 2. Trajectory API

Use this API to list trajectories, register a trajectory by remote URL, access frame offsets, stream individual frames, and delete trajectories.

Endpoints:

- `GET /api/v1/trajectory`
- `POST /api/v1/trajectory`
- `PUT /api/v1/trajectory/:id`
- `GET /api/v1/trajectory/:id`
- `DELETE /api/v1/trajectory/:id`
- `GET /api/v1/trajectory/:id/starts`
- `GET /api/v1/trajectory/:id/frame/offset/:start/:end`

### 3. Topology API

Use this API to list, register, fetch, and delete stored PDB topology files.

Endpoints:

- `GET /api/v1/topology`
- `POST /api/v1/topology`
- `PUT /api/v1/topology/:id`
- `GET /api/v1/topology/:id`
- `DELETE /api/v1/topology/:id`

### 4. YAML API

Use this API to manage user-editable YAML files on the server.

Endpoints:

- `GET /api/v1/yaml`
- `GET /api/v1/yaml/:name`
- `PUT /api/v1/yaml/:name`
- `POST /api/v1/yaml/:name`
- `POST /api/v1/yaml/:name/rename?to=new-name.yml`
- `DELETE /api/v1/yaml/:name`

## Common workflows

## Check server availability

```bash
curl http://127.0.0.1:1337/health
```

Expected response:

```json
{"status":"ok"}
```

## List available YAML files

```bash
curl http://127.0.0.1:1337/api/v1/yaml
```

Example response:

```json
["config.yml", "pipeline.yaml"]
```

## Create a new YAML file

Use `PUT` to create a new file.
If the file already exists, the server returns `409 Conflict`.

```bash
curl -i -X PUT "http://127.0.0.1:1337/api/v1/yaml/config.yml" \
  -H "Content-Type: text/yaml" \
  --data-binary $'name: config\nversion: 1\n'
```

## Update an existing YAML file

Use `POST` to push changes to an existing file.
If the file does not exist, the server returns `404 Not Found`.

```bash
curl -i -X POST "http://127.0.0.1:1337/api/v1/yaml/config.yml" \
  -H "Content-Type: text/yaml" \
  --data-binary $'name: config\nversion: 2\n'
```

## Read a YAML file

```bash
curl http://127.0.0.1:1337/api/v1/yaml/config.yml
```

## Rename a YAML file

```bash
curl -i -X POST "http://127.0.0.1:1337/api/v1/yaml/config.yml/rename?to=config-v2.yml"
```

## Delete a YAML file

```bash
curl -i -X DELETE "http://127.0.0.1:1337/api/v1/yaml/config-v2.yml"
```

## List sessions

```bash
curl http://127.0.0.1:1337/api/v1/session
```

## Upload a session

Upload a Mol* session archive as `application/zip`.

```bash
curl -i -X POST "http://127.0.0.1:1337/api/v1/session?name=my-session&version=molstar-max" \
  -H "Content-Type: application/zip" \
  --data-binary @session.molx
```

## Download a session

```bash
curl -OJ "http://127.0.0.1:1337/api/v1/session/<session-id>"
```

## Delete a session

```bash
curl -i -X DELETE "http://127.0.0.1:1337/api/v1/session/<session-id>"
```

## List trajectories

```bash
curl http://127.0.0.1:1337/api/v1/trajectory
```

## Register a trajectory from a remote URL

The server fetches the trajectory from the given URL and stores it locally.

```bash
curl -i -X POST "http://127.0.0.1:1337/api/v1/trajectory" \
  -H "Content-Type: application/json" \
  --data '{
    "url": "https://example.org/trajectory.xtc",
    "name": "traj-001",
    "description": "Example trajectory",
    "source": "example.org"
  }'
```

## Upload a trajectory directly from local file bytes

```bash
curl -i -X PUT "http://127.0.0.1:1337/api/v1/trajectory/traj-001?name=traj-001&fileName=traj-001.xtc&source=frontend-upload" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @traj-001.xtc
```

## Read a stored trajectory file

```bash
curl -OJ "http://127.0.0.1:1337/api/v1/trajectory/traj-001"
```

## Get trajectory frame starts

```bash
curl "http://127.0.0.1:1337/api/v1/trajectory/traj-001/starts"
```

## Get one trajectory frame by offset range

```bash
curl "http://127.0.0.1:1337/api/v1/trajectory/traj-001/frame/offset/0/1024"
```

## Delete a trajectory

```bash
curl -i -X DELETE "http://127.0.0.1:1337/api/v1/trajectory/traj-001"
```

## List topologies

```bash
curl http://127.0.0.1:1337/api/v1/topology
```

## Register a topology from a remote URL

The server fetches the topology from the given URL and stores it locally.

```bash
curl -i -X POST "http://127.0.0.1:1337/api/v1/topology" \
  -H "Content-Type: application/json" \
  --data '{
    "url": "https://files.rcsb.org/download/1CBS.pdb",
    "id": "1cbs",
    "fileName": "1cbs.pdb",
    "name": "1CBS",
    "description": "Example topology",
    "source": "RCSB"
  }'
```

## Upload a topology directly from local file bytes

```bash
curl -i -X PUT "http://127.0.0.1:1337/api/v1/topology/1cbs?name=1CBS&fileName=1cbs.pdb&source=frontend-upload" \
  -H "Content-Type: chemical/x-pdb" \
  --data-binary @1cbs.pdb
```

## Read a topology

```bash
curl http://127.0.0.1:1337/api/v1/topology/1cbs
```

## Delete a topology

```bash
curl -i -X DELETE "http://127.0.0.1:1337/api/v1/topology/1cbs"
```

## YAML file rules and validation

The YAML API enforces file-level validation rules defined by the server host.

Typical rules include:

- required keys
- forbidden keys
- forbidden words
- maximum file size
- valid YAML syntax
- valid file names

Example rule config:

```json
{
  "forbiddenWords": ["password", "secret"],
  "forbiddenKeys": ["debug", "internal"],
  "requiredKeys": ["name", "version"],
  "maxFileSizeBytes": 65536
}
```

### File naming rules

YAML file names must:

- end with `.yml` or `.yaml`
- not be empty
- not contain `/`, `\\`, or `..`
- only use letters, numbers, `.`, `_`, and `-`

## Error handling

The YAML API returns structured validation errors:

```json
{
  "errors": [
    {
      "rule": "forbidden-keys",
      "message": "YAML contains forbidden key 'internal'."
    }
  ]
}
```

Typical status codes:

- `200` success
- `201` created
- `400` invalid request or validation failure
- `404` not found
- `409` conflict, for example duplicate file name

For external apps, treat `400`, `404`, and `409` as expected business/API errors and display the server-provided message to the user where appropriate.

## Recommended client behavior

- use `/health` before expensive workflows if you need a fast availability check
- fetch `/api/v1/openapi.json` if you want to generate a client or validate integration
- treat file names as stable identifiers for the YAML API
- use `PUT` only for create and `POST` only for update in the YAML API
- handle `409 Conflict` explicitly for duplicate YAML file names
- do not assume legacy endpoints like `/yml` or `/list/...`; use only `/api/v1/...`

## Suggested integration order for an external app

1. call `/health`
2. load `/api/v1/openapi.json` or inspect `/docs`
3. integrate YAML list/create/update/read/delete if you need editable config files
4. integrate session upload/download if you need Mol* session persistence
5. integrate topology registration if you need modular structure-file storage
6. integrate trajectory registration and frame access if you need streaming support

## Related docs

- Docker/deployment overview: [docker-compose.md](docker-compose.md)
- YAML-specific notes: [yml-server.md](yml-server.md)
