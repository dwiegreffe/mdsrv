#!/usr/bin/env bash

# Exit immediately on errors, unset variables, and failed piped commands.
set -euo pipefail

# Resolve the repository root relative to this script location.
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "[mdsrv] Using repository root: $ROOT_DIR"
echo "[mdsrv] Rebuilding and restarting Docker Compose services..."

# Stop the current stack first so containers are recreated cleanly.
docker compose -f "$ROOT_DIR/docker-compose.yml" down
# Rebuild images and start the stack again in detached mode.
docker compose -f "$ROOT_DIR/docker-compose.yml" up --build -d

echo "[mdsrv] Active services:"
# Show the final service state after restart.
docker compose -f "$ROOT_DIR/docker-compose.yml" ps

echo "[mdsrv] Done."
