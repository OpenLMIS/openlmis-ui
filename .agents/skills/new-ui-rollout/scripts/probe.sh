#!/usr/bin/env bash
# Usage: probe.sh <https://host> <seconds> [prefix]
# One request per second to /, /api/facilities and /<prefix>/, one line each:
# time path status connect_seconds total_seconds. Status 000 means no response within 5 s.
set -u
host=${1:?host URL}
end=$((SECONDS + ${2:?seconds}))
prefix=${3:-v2}

while [ "$SECONDS" -lt "$end" ]; do
  for path in / /api/facilities "/$prefix/"; do
    curl -s -o /dev/null -m 5 \
      -w "$(date +%T) $path %{http_code} %{time_connect} %{time_total}\n" "$host$path"
  done
  sleep 1
done
