# Deployment

`openlmis-ui` ships as a container that sits inside an existing OpenLMIS stack
beside the legacy `reference-ui`, serving a URL prefix such as `/v2`. Users pick
which UI to use per screen by choosing a link; both run at once.

This page is the mechanism. [dual-boot/dual-boot.md](../dual-boot/dual-boot.md) covers the
same setup in plain language, for anyone who needs the behaviour but not the wiring.

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

Besides `/api`, the new UI reads one more path the stack already serves for the legacy UI:
`/localeSettings` at the root, for the time zone event times are shown in. It needs no
registration, but a custom proxy in front of the stack must pass it through as well, or times
fall back to the last one read, then to UTC.

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

## Branding and theme

The app name, logo, colour theme and default appearance come from the reference data service
(`GET /api/appConfiguration`), which administrators change in the new UI. The app reads them
before it shows anything:

- A server with nothing configured gets the built-in OpenLMIS look.
- A server that is down, answers slowly (more than 3 seconds) or has no route to the endpoint
  gets the settings this browser saw last, or the built-in look the first time.
- A reference data service without this endpoint, as the released versions are, always gets the
  built-in look.

Nothing about branding needs a rebuild or a redeploy.

## Password reset

Forgot Password works with any auth service: the new UI sends the request, and the auth service
emails a link. Where that link opens depends on the auth service:

- The released versions always link to the legacy UI's reset page, `/#!/resetPassword/<token>`,
  so the user finishes there. Nothing needs setting.
- An auth service with `PASSWORD_RESET_URL` (on its `migration` branch) can link to the new UI's
  page instead, with `PASSWORD_RESET_URL=https://<host>/v2/reset-password/`.

## Feature flags

Optional features are turned on or off in two places:

- **The container's environment**, with the same variables as the legacy UI:
  `BATCH_APPROVE_SCREEN`, `GS1_SCANNING` and `SHOW_REQUISITION_LESS_ORDER` (`true` or `false`),
  `QUANTITY_UNIT_OPTION` (`PACKS`, `DOSES` or `BOTH`) and `DEFAULT_QUANTITY_UNIT` (`PACKS` or
  `DOSES`). The entrypoint writes them into `config.json`; an unset variable means the default.
- **`DEFAULT_ISSUE_REASON_ID`** preselects that reason on new Issue lines and makes Reason
  required when the reason is in the program’s list, like the legacy UI’s build variable.
  Leave it unset for an optional reason.
- **`SYSTEM_SETTINGS`** (`true` or `false`, off by default) offers the Settings page. Turn it on only
  where the reference data service stores the new UI's settings; the released versions do not. It
  is read from the environment alone, so it never appears among the flags below.
- **Settings > Feature Flags**, opened from the account menu at the top right, where an administrator's value wins over
  the environment's. Reset on a flag goes back to the environment's value, or the default.

During dual boot the legacy UI keeps reading its own container environment, so a flag changed in
the new UI only reaches screens that have moved to the new UI.

## Working offline

The app keeps its own files in the browser so it opens without a connection. A service worker,
`/v2/sw.js`, looks after `/v2/` only, and never stores API or sign-in answers. It keeps a copy of
`config.json` and the translations, but fetches them from the network first, so a changed
config or a corrected translation reaches users on their next load.

Nothing in nginx needs to change for it. Everything under `/v2/` except `assets/` is already
served `no-cache`, `sw.js` included, which is what lets a new version be noticed; the gateway
passes those headers through. A deployment then shows open tabs an "Update Available" notice,
and the new version loads when the user chooses Reload.

The legacy UI has its own worker for the whole site. The two keep separate caches and do not
touch each other's.

The first visit downloads the whole app, about 2 MB, in one burst. The gateway's rate limit
applies to that too, so a host that is not on its allowlist may see a few requests refused;
the worker simply finishes on the next visit.

## Session handoff

Both UIs share an origin, so `syncLegacySession()` reads the AngularJS session out
of localStorage. The legacy UI stores its token through `angular-local-storage`
under the `openlmis.` prefix, so the keys are `openlmis.ACCESS_TOKEN`,
`openlmis.USER_ID` and `openlmis.USERNAME`. Values are raw UUIDs, not JSON-encoded,
and the API accepts them as `Authorization: Bearer`. Verified end to end against two
live instances with different builds, `test.openlmis.org` on `reference-ui`
5.2.13-SNAPSHOT and `uat.openlmis.org` on 5.2.15-RC1, so the format is not specific
to one of them.

The store records where a session came from (`sessionSource`), which is what lets
logout work both ways without signing out people who only use the new UI:

| Event | Result |
| --- | --- |
| Legacy signs in, we have no session | We adopt it, marked `legacy` |
| Legacy signs out | A `legacy`-sourced session of ours asks to sign in again, over the page, so nothing unsaved is lost |
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
session even if that session was established separately. To a user these are one
application, so one logout ending both is the intent.

### Where the token lives

The token is kept in the browser's localStorage, in the new UI's own
`login-data-storage` entry. It is never written into the legacy keys (see below).

The auth service hands out one token per user and OAuth client, so a user signed into
both UIs holds the same token in each, even when they signed in separately. Signing
out of either one ends it on the server for both.

A token lasts 30 minutes after its last use (`TOKEN_DURATION` on the auth service),
and every API call extends it. The `expires_in` in the sign-in response is only the
time left at that moment. When a token has expired, or the auth service was restarted,
which drops every token, the new UI asks the user to sign in again over the page they
are on, and nothing they had on screen is lost.

The legacy UI wipes all of the site's localStorage whenever the server refuses its
token, including the new UI's entry. A new UI tab that is still signed in saves its
session again, so a reload keeps working.

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

The trade is not worth it while `/v2` is only a home page and effectively everyone starts
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

## Verifying the session handoff

localStorage is per-origin, so the handoff cannot be checked by pointing a local
container at a remote environment: `test.openlmis.org` and `localhost` do not share
storage, and there is nothing for us to read.

Checking it needs both UIs on one origin. The way that was done here was a throwaway
nginx container proxying everything we do not claim to a live instance, registered in
Consul under the `<all>` global wildcard, which is the key the real `reference-ui`
registers. That puts the genuine legacy UI at `/`, its API at `/api` and this
container at `/v2`, all on `localhost:8080`, so signing in at `/` and opening `/v2`
exercises the real thing.

It is worth redoing whenever an environment moves to a `reference-ui` version that
has not been checked. The current behaviour was verified against `test.openlmis.org`
on 5.2.13-SNAPSHOT and `uat.openlmis.org` on 5.2.15-RC1.

## Publishing the image

Jenkins publishes, matching every other OpenLMIS component. `Jenkinsfile` reads the
version from `project.properties`, builds, and pushes `openlmis/openlmis-ui:<version>`
on `master` and `rel-*` only. It reuses the shared Docker Hub credential
(`cad2f741-7b1e-4ddd-b5ca-2959d40f62c2`), so no new secret is needed.

`project.properties` is the source of the image tag, not `package.json`.

The `Verify` stage runs `docker build --target verify`, which runs the checks inside
the same image the release is built from. An ordinary build never reaches that stage,
so `docker compose up --build` stays fast.

GitHub Actions still gates pull requests. It is faster and needs no Jenkins access,
but it cannot trigger the Jenkins deploy chain, so publishing stays on Jenkins.

The pipeline triggers no deploy. `OpenLMIS-3.x-deploy-to-test` removes every container
and image before recreating, so running it on each merge would take the environment
down every time.

### The Jenkins job, for reference

`OpenLMIS-ui-pipeline` already exists, so this is only needed if it has to be rebuilt.
It is a Multibranch Pipeline pointed at this repo, using the `GitHub Access Token`
credential, `by Jenkinsfile`, and discarding orphaned items.

Two settings are not obvious. **Trust for fork PRs must not be `Everyone`**: the repo
is public and the `Preparation` stage holds the shared Docker Hub push credential, so
`Everyone` would let any fork rewrite the `Jenkinsfile` and run it with that
credential. Use *From users with Admin or Write permission*.

And **create it fresh rather than using "Copy from"**. Copying a Multibranch Pipeline
brings the source job's branch sub-jobs and their recorded revisions along with the
config. Copying `OpenLMIS-reference-ui-pipeline` produced about thirty orphaned branch
jobs that immediately queued builds, and a `master` sub-job pinned to a commit that
does not exist here, so the first real build failed at checkout.

## Adding it to an environment

See [how-to-add-new-ui.md](how-to-add-new-ui.md) for the steps, including the Jenkins
job, the OAuth client, the compose entry and how to verify.
