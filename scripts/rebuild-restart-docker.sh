#!/usr/bin/env bash

# Exit immediately on errors, unset variables, and failed piped commands.
set -euo pipefail

# Resolve the repository root relative to this script location.
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "[mdsrv] Using repository root: $ROOT_DIR"
echo "[mdsrv] Rebuilding and restarting Docker Compose services..."

# Stop the current stack first so containers are recreated cleanly.
docker compose -f "$ROOT_DIR/docker-compose.yml" down

# Build each service explicitly, one by one. All runtime images come from the
# same multi-stage Dockerfile and BuildKit can intermittently fail when several
# targets are exported near the same time with missing parent snapshot errors.
for service in \
    mdsrv-remote-session \
    mdsrv-yml-server \
    mdsrv-trajectory-registry \
    mdsrv-topology-registry
do
    echo "[mdsrv] Building $service ..."
    docker compose -f "$ROOT_DIR/docker-compose.yml" build "$service"
done

# Start the stack again in detached mode using the freshly built images.
docker compose -f "$ROOT_DIR/docker-compose.yml" up -d

echo "[mdsrv] Active services:"
# Show the final service state after restart.
docker compose -f "$ROOT_DIR/docker-compose.yml" ps

echo "[mdsrv] Done."
