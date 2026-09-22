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

if [ "${CONSUL_REGISTRATION:-true}" = "true" ]; then
  node /opt/openlmis/registration.mjs register
  trap 'node /opt/openlmis/registration.mjs deregister; nginx -s quit' TERM INT
fi

nginx -g 'daemon off;' &
wait $!
