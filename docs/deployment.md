# Deployment

`openlmis-ui` ships as a container that sits inside an existing OpenLMIS stack
beside the legacy `reference-ui`, serving a URL prefix such as `/v2`. Users pick
which UI to use per screen by choosing a link; both run at once.

This page is the mechanism. [migration/migration.md](migration/migration.md) covers the same setup in
plain language, for anyone who needs to understand the behaviour but not the wiring.

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

The store records where a session came from (`sessionSource`), which is what lets
logout work both ways without signing out people who only use the new UI:

| Event | Result |
| --- | --- |
| Legacy signs in, we have no session | We adopt it, marked `legacy` |
| Legacy signs out | A `legacy`-sourced session of ours is cleared too |
| Legacy switches user | We follow to the new user |
| We sign out | `clearLegacySession()` drops the legacy keys as well |
| We signed in ourselves (`own`) | Legacy signing out does not touch us |
| We sign in | Legacy is untouched, so it still asks for a login |

It runs on boot and again on the `storage` event, so a logout in one tab reaches a
`/v2` tab already open in another. Only session keys are cleared; preferences such
as `openlmis.current_locale` survive. Without this, a legacy logout left us holding
a dead token while still rendering as signed in, because nothing forced the 401 that
would have corrected it.

`clearLegacySession()` is unconditional: signing out of the new UI ends a legacy
session even if that session was established separately and shares no token with
ours. To a user these are one application, so one logout ending both is the intent.

### Decision: login carries one way

**Signing into `/v2` does not sign you into the legacy UI. Crossing over asks for a
login once. Legacy is otherwise completely unaffected: it keeps its full menu and
every rights-guarded page works normally.** We write no `openlmis.*` keys on login,
so legacy simply never sees a session it did not create.

Publishing our token into the legacy keys was tried against a real instance and
rejected. Legacy accepts the token and renders as signed in, but it never backfills
the rights its own login caches, and it does not fetch them on demand either:
navigating straight to Stock on Hand issues **zero** API calls and dead-ends on an
untranslated `openlmisAuth.authorization.error` modal. Its route guards read the
cache synchronously and refuse before requesting anything. A token on its own
therefore produces something worse than a login prompt.

### If single sign-on is wanted later

Publishing can be made to work, and the earlier objection that a background fetch
would race the user's click only applies to a partial write. Publish **atomically**
and there is no broken intermediate state:

1. after a `/v2` login, fetch all four caches in the background
2. write nothing until every one has arrived
3. then write the token and the rights together

A user who crosses over early sees the same login screen they see today, so the
worst case is unchanged. What it costs is the fetch itself, measured on a real
instance at roughly 2.2 MB per login, paid even by users who never open legacy:

| Key | Endpoint | Size |
| --- | --- | --- |
| `permissions` | `GET /api/users/{id}/permissionStrings` | 1727 KB (13337 entries) |
| `ROLE_ASSIGNMENTS` | `GET /api/users/auth/{id}` | 511 KB (59 entries) |
| `userPrograms` | `GET /api/users/{id}/programs` | small |
| `homeFacility` | `GET /api/facilities/{homeFacilityId}` | small |

It also means writing legacy's cache format exactly, quirks included:
`userIdOffline` is injected into each program, and role assignments carry
`isDirect`. That format belongs to a specific `reference-ui` version, so this
couples us to whichever one an environment pins.

The trade is not worth it while `/v2` is a dashboard and effectively everyone starts
in the legacy UI, where the handoff already works with no extra login. Revisit when
`/v2` has screens people land on first.

### Our own user context

Unrelated to the above, and it should not reuse any of it. When the new UI needs the
current user, home facility, programs or rights, fetch them per screen through
TanStack Query with the key factory. Nothing should make signing in wait on thousands
of rows, and nothing should be cached as a multi-megabyte localStorage blob.

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
