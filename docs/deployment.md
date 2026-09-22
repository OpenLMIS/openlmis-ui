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

## Runtime configuration

Vite resolves `import.meta.env` at build time, so anything baked in ties one image
to one environment. The OAuth client must therefore be supplied at runtime: the
entrypoint renders `config.json` into the served directory from
`AUTH_SERVER_CLIENT_ID` and `AUTH_SERVER_CLIENT_SECRET`, and the app loads it
during boot alongside the translation catalogues. `import.meta.env` is the
fallback, which is what `pnpm dev` uses.

This is the same approach the legacy UI takes with `openlmis.js`. Without it the
container builds and serves fine but every login fails with
`MissingAuthClientCredentialsError`, because the bundle carries no client.

`VITE_BASE_PATH` stays a build input, since it is compiled into asset URLs.

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
| We sign in | Legacy is **not** signed in, see below |

Login only carries one way, and that is deliberate. Publishing our token into the
legacy keys was tried against a real instance. The legacy UI accepts it and renders
as signed in, but it never backfills the rights its own login caches, and it does
not fetch them later either: navigating straight to Stock on Hand issues **zero**
API calls and dead-ends on an untranslated `openlmisAuth.authorization.error` modal.
Its route guards read the cache synchronously and refuse before requesting anything.

Making that work would mean fetching the whole cache ourselves at login and writing
it in legacy's exact format. Measured on a real instance that is about 2.2 MB:

| Key | Endpoint | Size |
| --- | --- | --- |
| `permissions` | `GET /api/users/{id}/permissionStrings` | 1727 KB (13337 entries) |
| `ROLE_ASSIGNMENTS` | `GET /api/users/auth/{id}` | 511 KB (59 entries) |
| `userPrograms` | `GET /api/users/{id}/programs` | small |
| `homeFacility` | `GET /api/facilities/{homeFacilityId}` | small |

Doing it in the background instead races the user's click, and losing that race
produces the same dead end. So we publish nothing: a user who starts in the new UI
signs into the old one once and gets its normal login screen, which is honest and
self-explanatory. Logout stays symmetric, because tearing a session down needs none
of this setup.

When the new UI needs user context of its own, fetch it per screen through TanStack
Query rather than pulling this at login. Nothing should make signing in wait on
thousands of rows.

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

## Verifying against the real legacy UI

The handoff only works same-origin, so it cannot be checked by pointing at a remote
environment: `uat.openlmis.org` and `localhost` do not share localStorage. The
`docker-compose.legacy.yml` overlay solves that by proxying everything we do not
claim to a live instance, putting the real AngularJS UI and this container on one
origin:

```bash
docker compose -f docker-compose.yml -f docker-compose.legacy.yml up -d --build
./scripts/register-legacy-proxy.sh
```

Then `http://localhost:8080/` is the real legacy UI, `/api` its real API, and `/v2`
this repository. Log in at `/`, open `/v2`, and the session should carry with no
second login. `OL_UPSTREAM` picks the instance, defaulting to `uat.openlmis.org`.

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
      AUTH_SERVER_CLIENT_ID: ${AUTH_SERVER_CLIENT_ID}
      AUTH_SERVER_CLIENT_SECRET: ${AUTH_SERVER_CLIENT_SECRET}
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
