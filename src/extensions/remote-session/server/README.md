# Remote Session & Trajectory Streaming Server

This folder implements a lightweight Express server to store and retrieve Mol* Plugin sessions (`.molx`) and to mirror and partially stream molecular dynamics trajectories in XTC format (`.xtc`). It also exposes an OpenAPI/Swagger UI for exploring the API.

## Features

- Upload & download of Mol* Viewer sessions (ZIP / `.molx`)
- Session index management (`session_index.json`)
- Remote download ("mirroring") of XTC trajectories from a URL
- Trajectory index management (`trajectory_index.json`)
- Determining frame start offsets of an XTC file
- Extracting single frames or frame ranges (byte offsets) as JSON (decoding compressed coordinates)
- OpenAPI schema + integrated Swagger UI
- Optional API prefix for embedding behind a reverse proxy

## Key Files

| File | Purpose |
|------|---------|
| `index.ts` | Server entry point: Express app, routes, index handling, bootstrap |
| `config.ts` | CLI argument parsing & configuration (`--working-folder`, `--port`, `--api-prefix`) |
| `api-schema.ts` | OpenAPI 3 schema definition based on the current config |
| `version.ts` | Version information for the OpenAPI info section |
| `helper/helper.ts` | XTC parser/streaming: determine offsets & decode frames |
| `helper/make-dir.ts` | Safely create directories |
| `helper/uuid.ts` | Generate v4 UUIDs for session IDs |
| `swagger-ui/*` | Minimal wrapper to serve the Swagger UI |

## Start

The server is started from the (transpiled) CommonJS build, typically like this:

```bash
node lib/commonjs/extensions/remote-session/server/index.js \
  --working-folder ./server \
  --port 1337
```

Options:

- `--working-folder` (required): Target directory for index files and data folders (`session/`, `trajectory/`).
- `--port` (optional): Port (fallback: env `PORT` or 1337).
- `--api-prefix` (optional): Prefix for all API paths, e.g. `api/v1` → endpoint `/list/session` becomes `/api/v1/list/session`.

## Runtime Directory Structure

After the first start (or after the first upload), you will see:

```text
<working-folder>/
  session_index.json
  trajectory_index.json
  session/
    <session-id>.molx
  trajectory/
    <name>.xtc
```

## Data Formats

Session index entry:

```json
{
  "timestamp": 1732900000000,
  "id": "uuid-v4",
  "name": "Session Name",
  "description": "Description",
  "source": "(optional)",
  "version": "Mol* Build Version",
  "isSticky": false
}
```

Trajectory index entry:

```json
{
  "timestamp": 1732900000000,
  "id": "File name (without .xtc)",
  "name": "Display name",
  "description": "Description",
  "source": "(optional)"
}
```

## HTTP API (without optional api_prefix)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/list/session` | Returns session index |
| GET | `/list/trajectory` | Returns trajectory index |
| POST | `/set/session?name=&description=&source=&version=` | Upload a session (body = ZIP) |
| GET | `/get/session/:id/` | Download a `.molx` session |
| GET | `/remove/session/:id` | Delete a session (if not `isSticky`) |
| GET | `/upload/trajectory/:url/:name/:description/:source` | Remote download & save an XTC file (stream) |
| GET | `/get/trajectory/:id/starts` | Array of frame start offsets (as text) |
| GET | `/get/trajectory/:id/frame/offset/:start/:end` | Read single frame data as JSON |
| GET | `/openapi.json` | OpenAPI schema |
| GET | `/` | Swagger UI |

Notes:

- `:url` must be URL-encoded (e.g. `https:%2F%2Fhost%2Ffile.xtc`).
- Parameter `:end` can be `Infinity` to read until end of file.

## Detailed Usage: Trajectory Import Endpoint

**Path:** `GET /upload/trajectory/:url/:name/:description/:source`

This endpoint imports ("mirrors") an external XTC file by streaming it from the given source and storing it locally as `<working-folder>/trajectory/<name>.xtc`. Afterwards, an entry is added to `trajectory_index.json`.

### Parameters (Path)

| Name | Required | Description |
|------|----------|-------------|
| `url` | yes | URL-encoded source URL to the XTC file (http/https). Must resolve to the file directly without additional query parameters. |
| `name` | yes | Target name (file name without `.xtc`). Also used as `id` in the index. |
| `description` | no | Free-form description. Empty string if not provided. |
| `source` | no | Origin/system description (e.g. "MD Sim A"). |

### Flow

1. Check if `<working-folder>/trajectory/<name>.xtc` already exists (abort if yes).
2. Stream download via `fetch(url)`.
3. Write chunks to the target file.
4. On success: add index entry and persist it.
5. On error: delete the temporary file.

### Response

| Situation | HTTP | Body |
|-----------|------|------|
| Success | 200 | `Trajectory uploaded.` |
| Name exists | 200 | `File name already exists. Pick different file name.` |
| 404 upstream | 200 (with error text) | `404 file not found (URL)` |
| Fetch/network error | 200 (with error text) | Error object as string |

(Note: The server does not use differentiated status codes; for production use, consider proper status codes.)

### Example Calls

```bash
# URL-encode: https://data.example.org/md/traj.xtc -> https:%2F%2Fdata.example.org%2Fmd%2Ftraj.xtc
curl "http://localhost:1337/upload/trajectory/https:%2F%2Fdata.example.org%2Fmd%2Ftraj.xtc/Run01/First%20Simulation/SystemA"
```

Multi-part descriptions and sources should be URL-encoded (e.g. spaces → `%20`).

### Security / Risks

| Aspect | Description |
|--------|-------------|
| SSRF | Arbitrary internal URLs could be requested (no whitelist). |
| GET for a mutating action | Semantically unsuitable – better would be POST with JSON body (source URL + metadata). |
| No size limit | Potentially very large files; only limited by storage. |
| No auth | Any client can trigger downloads. |
| No validation | No check for `.xtc` extension or Content-Type. |

### Recommended Improvements

- Switch to `POST /upload/trajectory` with JSON body `{ url, name, description, source }`
- Validate allowed hosts (whitelist) or schemes (`https://`)
- Size limit (check Content-Length) and timeout
- Use appropriate response codes (409 on conflict, 400 on validation error, 502 upstream, etc.)

## Example Requests

### Upload a session

```bash
curl -X POST \
  -H "Content-Type: application/zip" \
  --data-binary @state.molx \
  "http://localhost:1337/set/session?name=Demo&description=Test&version=1.0.0"
```

### List sessions

```bash
curl http://localhost:1337/list/session
```

### Download a session

```bash
curl -O http://localhost:1337/get/session/<session-id>/
```

### Mirror a trajectory (see section above)

```bash
curl "http://localhost:1337/upload/trajectory/https:%2F%2Fhost%2Ftraj.xtc/MyTraj/Imported/Source"
```

### Frame offsets of a trajectory

```bash
curl http://localhost:1337/get/trajectory/MyTraj/starts
```

### Load a single frame range

```bash
curl http://localhost:1337/get/trajectory/MyTraj/frame/offset/0/4096
```

## Internal Flow (`index.ts`)

1. Read configuration (`getConfig`) → CLI arguments.
2. Express app + middleware: compression, CORS, raw body parser (ZIP up to 1GB).
3. Types & helpers (`createIndex`, `writeIndex`, `readIndex`, `mapPath`, `removeSession`).
4. Register session routes.
5. Register trajectory routes (incl. streaming & offset reading via `helper/helper.ts`).
6. Generate OpenAPI schema + mount Swagger UI endpoints.
7. Create index files & folders if needed.
8. Start server (`app.listen`).

## Security & Limitations

| Topic | Risk / Note |
|-------|-------------|
| Authentication | Not implemented – anyone can upload/delete |
| Authorization | Not implemented |
| SSRF risk | `/upload/trajectory/:url/...` fetches arbitrary URLs from the server |
| Rate limiting | Not implemented |
| File size | No limit for `upload/trajectory` (depends on available disk space) |
| GET for upload | Unusual (violates idempotent semantics); POST would be better |
| Validation | Minimal input validation |

## Possible Improvements

- Switch to POST for trajectory upload
- Auth (API key or JWT)
- Size/quota limits & timeout handling
- Validate allowed schemes (`https://`) for remote downloads
- Optional: garbage collection / TTL for old sessions

## License

MIT – see `LICENSE` at the project root.

---
*Generated README (English).*
