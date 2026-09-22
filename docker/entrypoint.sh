#!/bin/sh
set -eu

BASE_PREFIX=$(printf '%s' "${BASE_PATH:-/}" | sed 's#^/*##; s#/*$##')
export BASE_PREFIX

if [ -z "$BASE_PREFIX" ]; then
  echo "BASE_PATH must name a prefix (for example /v2) so the legacy UI keeps /" >&2
  exit 1
fi

if [ ! -f "/usr/share/nginx/html/${BASE_PREFIX}/index.html" ]; then
  echo "No build at /${BASE_PREFIX}/. BASE_PATH must match the VITE_BASE_PATH it was built with." >&2
  exit 1
fi

envsubst '${BASE_PREFIX}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# Per-environment settings the bundle cannot carry, since Vite resolves
# import.meta.env at build time. Same idea as the legacy UI's openlmis.js.
export AUTH_SERVER_CLIENT_ID="${AUTH_SERVER_CLIENT_ID:-}"
export AUTH_SERVER_CLIENT_SECRET="${AUTH_SERVER_CLIENT_SECRET:-}"
envsubst '${AUTH_SERVER_CLIENT_ID} ${AUTH_SERVER_CLIENT_SECRET}' \
  < /opt/openlmis/config.json.template \
  > "/usr/share/nginx/html/${BASE_PREFIX}/config.json"

if [ "${CONSUL_REGISTRATION:-true}" = "true" ]; then
  node /opt/openlmis/registration.mjs register
  # QUIT matters most: it is the nginx image's STOPSIGNAL, so it is what
  # `docker stop` actually sends. Missing it leaves a stale Consul entry and
  # nginx proxying the prefix to a dead upstream until the health check reaps it.
  trap 'node /opt/openlmis/registration.mjs deregister; nginx -s quit' TERM INT QUIT
fi

nginx -g 'daemon off;' &
wait $!
