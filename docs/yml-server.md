# YAML Server

This document describes the standalone YAML server used in the Docker Compose setup.

It is separate from the remote session / trajectory server.

## Storage layout

The YAML server uses its own dedicated host volume:

- `docker/data/yml/`

User-managed YAML files are stored in a dedicated data subdirectory:

- `docker/data/yml/files/`

This keeps user files separate from any server-owned files.

## External access

In the Compose setup, both services are exposed through the same host IP and same external port via nginx:

- API docs: `http://<host-ip>:1337/docs`
- YAML API: `http://<host-ip>:1337/api/v1/yaml`

## Endpoints

### List files

`GET /api/v1/yaml`

```bash
curl http://127.0.0.1:1337/api/v1/yaml
```

### Read a file

`GET /api/v1/yaml/:name`

```bash
curl http://127.0.0.1:1337/api/v1/yaml/test.yml
```

### Create a file

`PUT /api/v1/yaml/:name`

```bash
curl -i -X PUT "http://127.0.0.1:1337/api/v1/yaml/test.yml" \
  -H "Content-Type: text/yaml" \
  --data-binary $'name: test\nversion: 1\n'
```

### Update a file

`POST /api/v1/yaml/:name`

```bash
curl -i -X POST "http://127.0.0.1:1337/api/v1/yaml/test.yml" \
  -H "Content-Type: text/yaml" \
  --data-binary $'name: test\nversion: 2\n'
```

### Rename a file

`POST /api/v1/yaml/:name/rename?to=new-name.yml`

```bash
curl -i -X POST "http://127.0.0.1:1337/api/v1/yaml/test.yml/rename?to=test-v2.yml"
```

### Remove a file

`DELETE /api/v1/yaml/:name`

```bash
curl -i -X DELETE "http://127.0.0.1:1337/api/v1/yaml/test-v2.yml"
```

## Validation rules

The YAML server can load a JSON rules file.

Example:

```json
{
  "forbiddenWords": ["password", "secret"],
  "forbiddenKeys": ["debug", "internal"],
  "requiredKeys": ["name", "version"],
  "maxFileSizeBytes": 65536
}
```

Current built-in validation:

- filename validation
- parseable YAML
- forbidden words
- forbidden keys
- required keys
- max file size

## Notes

- file names must end with `.yml` or `.yaml`
- file names must not contain `/`, `\\`, or `..`
- duplicate file names are rejected
- rename also rejects collisions
