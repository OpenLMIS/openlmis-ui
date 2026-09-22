#!/usr/bin/env bash
#
# Registers the legacy-proxy container with the local Consul so the gateway
# routes everything we do not claim to it. Uses the `<all>` global wildcard, the
# same key the real reference-ui registers, so the generated nginx config has the
# same shape as a deployed environment.
set -euo pipefail

CONSUL=${CONSUL:-http://localhost:8500}
SERVICE=${SERVICE:-legacy-proxy}

container=$(docker compose -f docker-compose.yml -f docker-compose.legacy.yml ps -q legacy-proxy)
if [ -z "$container" ]; then
  echo "legacy-proxy is not running. Start it with the legacy overlay first." >&2
  exit 1
fi

address=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$container")
if [ -z "$address" ]; then
  echo "Could not determine the legacy-proxy container address." >&2
  exit 1
fi

curl -fsS -X PUT "$CONSUL/v1/agent/service/register" -d @- <<JSON > /dev/null
{
  "Name": "$SERVICE",
  "ID": "$SERVICE-service",
  "Address": "$address",
  "Port": 80,
  "Tags": ["openlmis-service"],
  "Check": {
    "HTTP": "http://$address:80/",
    "Interval": "30s",
    "Timeout": "10s",
    "DeregisterCriticalServiceAfter": "10m"
  }
}
JSON

curl -fsS -X PUT "$CONSUL/v1/kv/resources/%3Call%3E" -d "$SERVICE" > /dev/null

echo "Registered $SERVICE at $address:80 as the catch-all upstream."
echo "  http://localhost:8080/      real legacy UI"
echo "  http://localhost:8080/v2/   this repository"
