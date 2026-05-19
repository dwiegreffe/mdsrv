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

Use this API to upload, list, download, rename, update, and delete Mol\* session archives.

Sessions support two rename/update modes:

- display rename: send `PATCH /api/v1/session/:id` with `name` only; the id and download URL stay unchanged
- identity rename: include a new `id`; the stored `.molx` file is renamed and future requests must use the new id

Endpoints:

- `GET /api/v1/session`
- `POST /api/v1/session`
- `GET /api/v1/session/:id`
- `PATCH /api/v1/session/:id`
- `DELETE /api/v1/session/:id`

### 2. Trajectory API

Use this API to list trajectories, register a trajectory by remote URL, access cached frame offsets, stream individual frames, stream frame ranges, rename/update trajectories, and delete trajectories.

Trajectories support display rename via `name` and identity rename via `id`. Identity rename changes the trajectory id, renames the stored `.xtc` file, and also renames the cached frame-start index if it exists.

Endpoints:

- `GET /api/v1/trajectory`
- `POST /api/v1/trajectory`
- `PUT /api/v1/trajectory/:id`
- `GET /api/v1/trajectory/:id`
- `PATCH /api/v1/trajectory/:id`
- `DELETE /api/v1/trajectory/:id`
- `GET /api/v1/trajectory/:id/starts`
- `GET /api/v1/trajectory/:id/frame/offset/:start/:end`
- `GET /api/v1/trajectory/:id/frame/start/:start`
- `GET /api/v1/trajectory/:id/frame-range/index/:index/:count`
- `GET /api/v1/trajectory/monitor/requests`
- `GET /api/v1/trajectory/monitor/plot`

### 3. Topology API

Use this API to list, register, fetch, rename/update, and delete stored PDB topology files.

Topologies support display rename via `name` and identity rename via `id`. Identity rename changes the topology id and renames the stored `.pdb` file.

Endpoints:

- `GET /api/v1/topology`
- `POST /api/v1/topology`
- `PUT /api/v1/topology/:id`
- `GET /api/v1/topology/:id`
- `PATCH /api/v1/topology/:id`
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
{ "status": "ok" }
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
  --data-binary $'schemaVersion: 1\nname: config\n'
```

## Update an existing YAML file

Use `POST` to push changes to an existing file.
If the file does not exist, the server returns `404 Not Found`.

```bash
curl -i -X POST "http://127.0.0.1:1337/api/v1/yaml/config.yml" \
  -H "Content-Type: text/yaml" \
  --data-binary $'schemaVersion: 2\nname: config\n'
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

Upload a Mol\* session archive as `application/zip`.

```bash
curl -i -X POST "http://127.0.0.1:1337/api/v1/session?name=my-session&version=molstar-max" \
  -H "Content-Type: application/zip" \
  --data-binary @session.molx
```

## Download a session

```bash
curl -OJ "http://127.0.0.1:1337/api/v1/session/<session-id>"
```

## Rename or update a session

Use `PATCH` for both display metadata updates and identity rename.

Display rename keeps the session id and URL stable:

```bash
curl -i -X PATCH "http://127.0.0.1:1337/api/v1/session/<session-id>" \
  -H "Content-Type: application/json" \
  --data '{
    "name": "Analysis session v2",
    "description": "Updated user-facing description"
  }'
```

Identity rename changes the id and renames the stored `.molx` file:

```bash
curl -i -X PATCH "http://127.0.0.1:1337/api/v1/session/<session-id>" \
  -H "Content-Type: application/json" \
  --data '{
    "id": "session-v2",
    "name": "Analysis session v2"
  }'
```

After identity rename, use `/api/v1/session/session-v2` for download, update, or delete. Sticky sessions return `403 Forbidden` and cannot be modified.

## Delete a session

```bash
curl -i -X DELETE "http://127.0.0.1:1337/api/v1/session/<session-id>"
```

Deleting a sticky session returns `403 Forbidden`. Deleting a missing session returns `404 Not Found`.

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

## Rename or update a trajectory

Display rename keeps the trajectory id and all frame URLs stable:

```bash
curl -i -X PATCH "http://127.0.0.1:1337/api/v1/trajectory/traj-001" \
  -H "Content-Type: application/json" \
  --data '{
    "name": "Production trajectory",
    "description": "100 ns production run"
  }'
```

Identity rename changes the id, renames the stored `.xtc` file, and renames the cached frame-start index if present:

```bash
curl -i -X PATCH "http://127.0.0.1:1337/api/v1/trajectory/traj-001" \
  -H "Content-Type: application/json" \
  --data '{
    "id": "prod-100ns",
    "name": "Production trajectory"
  }'
```

After identity rename, use `/api/v1/trajectory/prod-100ns` and update any YAML/session references that pointed at the old trajectory id.

## Get trajectory frame starts

```bash
curl "http://127.0.0.1:1337/api/v1/trajectory/traj-001/starts"
```

## Get one trajectory frame by offset range

`end` is an exclusive upper bound. In typical Mol\* usage it is the next frame start or `Infinity`.

```bash
curl "http://127.0.0.1:1337/api/v1/trajectory/traj-001/frame/offset/0/1024"
```

## Get one trajectory frame by start offset

The server resolves the next frame boundary from the cached starts index.

```bash
curl "http://127.0.0.1:1337/api/v1/trajectory/traj-001/frame/start/0"
```

## Get a trajectory frame range by frame index and count

`index` is zero-based and `count` is the number of consecutive frames to return.

```bash
curl "http://127.0.0.1:1337/api/v1/trajectory/traj-001/frame-range/index/0/10"
```

## Delete a trajectory

```bash
curl -i -X DELETE "http://127.0.0.1:1337/api/v1/trajectory/traj-001"
```

## Monitor trajectory requests

The trajectory registry writes JSONL request logs without payloads and can aggregate them into time buckets.

```bash
curl "http://127.0.0.1:1337/api/v1/trajectory/monitor/requests?from=2026-04-16T00:00:00.000Z&to=2026-04-17T00:00:00.000Z&bucket=1h"
```

Open the built-in monitoring page:

```bash
open "http://127.0.0.1:1337/api/v1/trajectory/monitor/plot"
```

The plot page auto-refreshes every second, stacks requests by request type with distinct colors, and renders these default windows:

- last hour with 1-minute buckets
- last 24 hours with 1-hour buckets
- last 31 days with 1-day buckets
- last 365 days with 1-month buckets

Each chart also provides its own bucket-size dropdown so you can change the aggregation granularity without leaving the page.

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

## Rename or update a topology

Display rename keeps the topology id and URL stable:

```bash
curl -i -X PATCH "http://127.0.0.1:1337/api/v1/topology/1cbs" \
  -H "Content-Type: application/json" \
  --data '{
    "name": "1CBS reference topology",
    "description": "Updated display metadata"
  }'
```

Identity rename changes the id and renames the stored `.pdb` file:

```bash
curl -i -X PATCH "http://127.0.0.1:1337/api/v1/topology/1cbs" \
  -H "Content-Type: application/json" \
  --data '{
    "id": "1cbs-reference",
    "name": "1CBS reference topology"
  }'
```

After identity rename, use `/api/v1/topology/1cbs-reference` and update any YAML/session references that pointed at the old topology id.

## Delete a topology

```bash
curl -i -X DELETE "http://127.0.0.1:1337/api/v1/topology/1cbs"
```

## YAML file rules and validation

The YAML API enforces file-level validation rules defined by the server host.

Typical rules include:

- required keys
- valid YAML syntax
- valid file names

Example rule config:

```json
{
  "requiredKeys": ["schemaVersion"]
}
```

In the default Docker setup, `schemaVersion` is the only documented YAML content requirement and it must be defined at the top level.

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

Session, trajectory, and topology `PATCH` requests return the updated entry as JSON. For identity rename, `409 Conflict` means the requested target id or generated file name already exists.

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
4. integrate session upload/download, display rename, and delete if you need Mol\* session persistence
5. integrate topology registration, display rename, delete, and optional identity rename if you need modular structure-file storage
6. integrate trajectory registration, display rename, delete, frame access, and optional identity rename if you need streaming support

## Related docs

- Docker/deployment overview: [docker-compose.md](docker-compose.md)
- YAML-specific notes: [yml-server.md](yml-server.md)
