# Deployment

`openlmis-ui` ships as a container that sits inside an existing OpenLMIS stack
beside the legacy `reference-ui`, serving a URL prefix such as `/v2`. Users pick
which UI to use per screen by choosing a link; both run at once.

## How routing works

OpenLMIS environments have no static nginx config. `openlmis/nginx` is the only
thing on port 80 and it regenerates its config from Consul via `consul-template`:

- every container registers a **service** tagged `openlmis-service`, which
  becomes an nginx `upstream`
- every container also writes **KV entries** under `resources/<path>` whose value
  names that upstream, and each becomes a `location` block

`reference-ui` registers `/` and `<all>`. The `<all>` key hits the template's
global-wildcard branch, which is emitted **last** in the generated config. nginx
matches regex locations in file order, so any service claiming a narrower path
wins over the legacy catch-all. That is why `/v2` works without changing nginx or
the legacy UI.

`docker/registration.mjs` registers two keys:

| KV key | Generated location |
| --- | --- |
| `resources/v2` | `location ~ /v2/?$` |
| `resources/v2/<all>` | `location ~ /v2/.+/?$` |

## The prefix is a build input

It is compiled into asset URLs, so it cannot be changed at runtime.
`VITE_BASE_PATH` drives Vite's `base`, which drives `import.meta.env.BASE_URL`,
which the router (`basepath`), i18next (`loadPath`) and `Logo` all read.

```bash
docker build --build-arg BASE_PATH=/v2 -t openlmis/openlmis-ui:x.y.z .
```

The runtime `BASE_PATH` env must match what the image was built with. The
entrypoint fails fast if no build exists at that path rather than serving 404s.

**Absolute asset paths in TS/TSX do not get rewritten.** Vite rewrites
`index.html`, but a literal like `src="/olmis.png"` in a component ships as-is
and 404s under a prefix. Use `` `${import.meta.env.BASE_URL}olmis.png` ``.

## Session handoff

Both UIs share an origin, so `syncLegacySession()` reads the AngularJS session out
of localStorage. The legacy UI stores its token through `angular-local-storage`
under the `openlmis.` prefix, so the keys are `openlmis.ACCESS_TOKEN`,
`openlmis.USER_ID` and `openlmis.USERNAME`. Verified against the `reference-ui`
version pinned in `uat_env`: raw UUIDs, not JSON-encoded, and accepted by the API
as `Authorization: Bearer`.

The store records where a session came from (`sessionSource`), which is what makes
logout work in both directions without logging out people who only use the new UI:

| Event | Result |
| --- | --- |
| Legacy signs in, we have no session | We adopt it, marked `legacy` |
| Legacy signs out | A `legacy`-sourced session of ours is cleared too |
| Legacy switches user | We follow to the new user |
| We sign out | `clearLegacySession()` drops the legacy keys as well |
| We signed in ourselves (`own`) | Legacy signing out does not touch us |

It runs on boot and again on the `storage` event, so a logout in one tab reaches a
`/v2` tab already open in another. Only session keys are cleared; preferences such
as `openlmis.current_locale` survive.

Without this, a legacy logout left us holding a dead token while still rendering as
signed in, because nothing forced the 401 that would have corrected it.

## Stopping cleanly

The image inherits `STOPSIGNAL SIGQUIT` from nginx, so that is what `docker stop`
sends, not `SIGTERM`. The entrypoint traps `TERM INT QUIT`; dropping `QUIT` would
mean every ordinary stop skipped deregistration and left nginx proxying the prefix
to a dead upstream until Consul's `DeregisterCriticalServiceAfter` (10m) reaped it.

## Running the stack locally

`docker-compose.yml` brings up Consul and the real `openlmis/nginx` gateway, so
routing is exercised the same way it is in a deployed environment.

```bash
docker compose up --build   # then http://localhost:8080/v2/
```

There is no legacy UI or backend in that stack, so `/` returns 404 and API calls
fail. What it does prove is the prefix, the Consul registration, the SPA
fallback on deep links, and the asset paths.

`VIRTUAL_HOST` is `localhost:8080` there because the gateway's rate-limit
allowlist compares the `Host` header verbatim, and locally it carries the
published port. A mismatch means every request is rate limited and the browser
gets 429s on parallel asset loads.

## Adding it to an environment

In `openlmis-deployment`, pin the version in `deployment/<env>_env/.env`:

```
OL_UI_VERSION=x.y.z
```

and add the service to `deployment/<env>_env/docker-compose.yml`:

```yaml
  openlmis-ui:
    restart: always
    image: openlmis/openlmis-ui:${OL_UI_VERSION}
    env_file: settings.env
    environment:
      BASE_PATH: /v2
      CONSUL_HOST: consul
      CONSUL_PORT: 8500
      SERVICE_NAME: openlmis-ui
      SERVICE_TAG: openlmis-service
      SERVICE_PORT: 80
    depends_on:
      consul:
        condition: service_healthy
      auth:
        condition: service_healthy
      referencedata:
        condition: service_healthy
```

The gateway needs no change. Nothing else claims `/v2`, so the new routes appear
as soon as Consul reports the service healthy.
