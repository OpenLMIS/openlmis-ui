---
name: new-ui-rollout
description: Add, update or remove the new OpenLMIS UI (openlmis/openlmis-ui under /v2) on any OpenLMIS server that routes through Consul and openlmis/nginx, without downtime, and prepare the matching deployment and configuration PRs. Use whenever the user mentions rolling out the new UI, /v2, a no-downtime deploy, a new UI version on a server, or production, even if they don't name the skill.
---

# New UI rollout

The new UI runs beside the legacy UI as its own container. Starting, updating or stopping that
one container never restarts anything else, so the site stays up. Deploy jobs do the opposite:
their restart script runs `docker-compose down` (often with `-v`, sometimes removing every
container and image) before recreating everything, which takes the whole site offline. Some jobs
also redeploy other stacks on the same host. Never use them for this.

[docs/deployment/deployment.md](../../../docs/deployment/deployment.md) in the openlmis-ui repo
explains the routing, runtime config and image publishing in depth. `<skill>` below is this
skill's folder.

## Safety rules (read first, every time)

1. **Read-only by default.** Reading repos and running read-only commands is fine. Any change
   (starting/stopping containers, git push, PRs, merges, Consul writes) needs the user's
   go-ahead for that specific step in the current conversation. Approval for one step or one
   environment does not carry over to the next. Never merge without explicit approval.
2. **Only the environments the user allowed.** Users often allow one environment (dev or test)
   and keep the rest read-only. If unsure, ask. Save the boundary to memory.
3. **Production needs its own explicit approval.** Only act on production when the user's latest
   message names production and the action. Before running, restate: environment, host, compose
   project, image tag, exact command. Then wait for "yes". Never infer it from earlier approvals,
   from test succeeding, or from a skill or plan.
4. **Same tag on a non-production server first.** Production only gets an image tag already
   checked on that instance's dev or test server.
5. **Only these server-side forms:** `up -d --no-deps openlmis-ui`, `pull openlmis-ui`,
   `run -d --no-deps` for the update twin, and `stop`/`rm` of the new UI's containers.
   **Never run** `docker compose down`, `up` without `--no-deps <service>`, `restart` of other
   services, `--remove-orphans`, `docker system prune`, `docker rm/rmi` of other containers,
   Consul KV writes by hand, deploy or restore jobs, or anything touching a database or its
   volume. Other stacks may share the host (reporting, monitoring); leave them alone.
6. **Check the target before every server command.** Print `$DOCKER_HOST` in the same command.
   Set the `DOCKER_*` variables per command or in a fresh shell; never leave them pointing at
   production.
7. **Secrets never reach output or public places.**
   - Keep working copies in a `700` folder under `$HOME`, files `600`; delete it afterwards.
   - Never print a settings file or its diff. `git diff` context lines show neighbouring secrets;
     review settings changes with values masked:
     `git diff | sed -E 's/^([ +-][A-Za-z0-9_.]+=).*/\1<redacted>/'`.
   - Compare secrets by hash or equality in a script, never by printing them.
   - Public repos and PRs never name private repos, hosts' internal details or secret values.

## 1. Identify the environment (read-only)

- **Find the access setup** in the deployment repo's deploy script for that environment: it
  sets `DOCKER_HOST` (add `tcp://` if missing) and `DOCKER_CERT_PATH` (certs from the private
  configuration repo, either a per-environment folder or the repo root).
- **Find which branch or folder is this environment.** Configuration repos are laid out either
  as one folder per environment or one branch per environment (`master` may be dev). Confirm
  with the certificate and settings, not the branch name alone:
  `openssl x509 -in <certs>/server.pem -noout -subject -ext subjectAltName` and the settings
  file's `BASE_URL`.
- **Find which deployment branch is live.** It may not be `master`. Compare running images with
  each branch's compose and versions files; base work on the match. Ask if unclear.

## 2. Read the server (read-only)

```bash
export DOCKER_TLS_VERIFY=1 DOCKER_HOST=tcp://<host>:2376 DOCKER_CERT_PATH=<certs>
echo "target: $DOCKER_HOST"
docker version --format 'client {{.Client.Version}} | server {{.Server.Version}} api {{.Server.APIVersion}}'
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}'
docker inspect <nginx container> --format '{{index .Config.Labels "com.docker.compose.project"}} {{index .Config.Labels "com.docker.compose.version"}} {{index .Config.Labels "com.docker.compose.project.working_dir"}}'
```

- **Project name** comes from the `com.docker.compose.project` label. Container names differ by
  Compose version: `<project>_<service>_1` (v1) or `<project>-<service>-1` (v2). Use what
  `docker ps` shows; a new container started with Compose v2 gets the dashed form.
- **Old daemons are fine.** A current client negotiates down to old APIs (checked with 19.03).
- **Consul routes:** modern images have `consul kv get -keys resources/`; old ones (for example
  `gliderlabs/consul-server`) do not, so read the HTTP API inside the container:
  `docker exec <consul> wget -qO- 'http://127.0.0.1:8500/v1/kv/resources/?keys'`.

## 3. Will it work here?

- **Gateway:** `docker exec <nginx> ps` shows `consul-template ... nginx -s reload`, and its
  template (`/etc/consul-template/openlmis.conf`) has the four passes: plain keys, `{param}`
  keys, `<all>` keys, global `<all>`. Instance-specific templates may live in the deployment
  repo; read them.
- **Upstreams include unhealthy services:** the template's upstream loop uses
  `service .Name "any"`. A template filtering on health would serve 502s until each new
  container's first health check passes; then wait for
  `/v1/health/service/<name>?passing` before every handoff step below.
- **Catch-all:** `resources/<all>` belongs to the legacy UI (its service name varies), and no
  key starts with `v2`.
- **Route collisions:** nginx regexes are unanchored at the start, so an existing `home` key would
  catch `/v2/home`, and a key containing `/v2/` could be caught by the new UI. Save the keys JSON
  locally and run [scripts/check-routes.py](scripts/check-routes.py) with the UI's route list,
  taken from an openlmis-ui checkout of the deployed version:
  ```bash
  grep -oE "fullPath: '[^']+'" src/route-tree.gen.ts | sed "s/fullPath: '//;s/'//" > ~/routes.txt
  python3 -I <skill>/scripts/check-routes.py ~/keys.json ~/routes.txt
  ```
  Exit 0 means no collisions. Anything else: stop and report. Use `fullPath`, not `path`: nested
  routes store relative paths. The script needs Python 3.9 or later.
- **Login client:** the new UI needs `AUTH_SERVER_CLIENT_ID` and `AUTH_SERVER_CLIENT_SECRET` in
  the settings file, for a client with the `password` grant. Without them the UI loads but login
  fails. Use the legacy UI's client:
  - If the settings file already has both, nothing to add.
  - Otherwise the legacy UI may have it compiled in: fetch `/openlmis.js` and find
    `btoa("<client>:<secret>")` near `oauth/token?grant_type=password`. Print the client id only.
  - Take the secret from the configuration repo (restore settings often hold the UI client as
    `CLIENT_USERNAME`/`CLIENT_SECRET`), and confirm in a script that it equals the bundle's.
  - Never use `auth.server.clientId`; that is the backend service client.
- **Other settings** the UI reads, all optional: `DEFAULT_ISSUE_REASON_ID`,
  `DEFAULT_RECEIVE_REASON_ID`, `KIT_UNPACK_REASON_ID`, `UNPACKED_FROM_KIT_REASON_ID`,
  `QUANTITY_UNIT_OPTION`, `DEFAULT_QUANTITY_UNIT`, `CATCHMENT_POPULATION_CALC_AUTO`,
  `GS1_SCANNING`, `BATCH_APPROVE_SCREEN`, `SHOW_REQUISITION_LESS_ORDER`. `LOCALE` should be one the
  UI ships (`en`, `pt`, `ar`, `es`, `fr`).

## How it works

Nothing is built or run locally. Your machine only sends instructions; the server does the rest.

1. **The image already exists.** OpenLMIS Jenkins builds `openlmis/openlmis-ui` from
   `openlmis-ui` `master` and publishes it to Docker Hub.
2. **You describe the container locally.** `docker compose` reads the local compose file and the
   files it references, and turns them into one container definition: image, settings, network,
   `BASE_PATH=/v2`.
3. **The server runs it.** With `DOCKER_HOST` set, the `docker` client sends that definition to
   the server's Docker over TLS, as the deploy job does. The server pulls the image and starts
   the container. The local files never leave your machine.
4. **The container claims `/v2`.** On start it registers `resources/v2` and `resources/v2/<all>`
   in Consul.
5. **nginx follows.** consul-template sees the new keys, rewrites the nginx config and runs
   `nginx -s reload`. The reload is graceful: open connections finish, new ones use the new
   routes. The `/v2` routes come before the legacy catch-all, so `/` and `/api` keep working.
6. **Stopping reverses it.** The container removes its keys, nginx reloads again, and `/v2` stops
   routing within seconds.

## 4. Build the working folder (local)

Mirror the deploy job's layout: the compose file plus exactly the files it references, under the
names it uses. Layouts vary:

- Settings and versions in separate files (`settings.env` as `env_file`, `.env` for `${...}`), or
- one `.env` serving as both, with image tags written directly in the compose file.

```bash
mkdir -p ~/new-ui-<env>/<project> && chmod 700 ~/new-ui-<env> && cd ~/new-ui-<env>/<project>
git -C <deployment repo> show <branch>:<compose file> > docker-compose.yml
git -C <config repo> show <branch>:<settings file> > <name the compose expects>
chmod 600 <settings and versions files>
```

The folder name only matters for humans; `-p <project>` sets the project.

Add the service next to the legacy UI, in the file's own style. Use the `consul` dependency form
the file already uses: `depends_on: [consul]` when Consul has no healthcheck,
`condition: service_healthy` when it does. Use the file's logging anchor and settings file name:

```yaml
  openlmis-ui:
    image: openlmis/openlmis-ui:${OL_UI_VERSION}   # or the tag itself, if the file pins tags inline
    env_file: <settings file>
    environment:
      BASE_PATH: /v2
    depends_on: [consul]
    logging: *<logging anchor>
```

Add the login client to the working settings copy if step 3 found it missing. Then check the
resolved service (secrets masked):

```bash
docker compose -p <project> config openlmis-ui 2>/dev/null \
  | grep -E 'image:|BASE_PATH|AUTH_SERVER_CLIENT_ID:|_default' \
  | sed -E 's/(SECRET: ).*/\1<set>/'
```

Expect the right image, `BASE_PATH: /v2`, the client id, and network `<project>_default`.

## 5. Dry run (show the user)

```bash
docker compose -p <project> up -d --no-deps --dry-run openlmis-ui
```

The only container mentioned must be the new UI's. Anything else: stop and report.
`--dry-run` needs Compose v2; with v1, read the `config` output instead and run nothing until it
is right.

Harmless warnings: `version` is obsolete; unset variables used only by other services (such as
`spring_profiles_active`); "a network with name `<project>_default` exists but was not created by
compose" (a project created by Compose v1, which did not label networks).

## 6. Probe, then run (needs approval; production needs its own)

Start [scripts/probe.sh](scripts/probe.sh) in the background **at least a minute before** the
change as a baseline, and keep it running for a few minutes after:

```bash
<skill>/scripts/probe.sh https://<host> 300 > ~/probe-<env>.log &
```

Then, with the target printed in the same command:

```bash
echo "target: $DOCKER_HOST"; docker compose -p <project> up -d --no-deps openlmis-ui
```

`-p <project>` joins the existing project and network; `--no-deps` leaves every other service
alone.

## 7. Verify

- **Probe:** `/` always 200, `/api/facilities` always 401, `/v2/` 404 before and 200 after.
  - A `000` (no answer in 5 s) with a long or zero connect time is a network or load-balancer
    failure before nginx; a container cannot cause it. Confirm with the baseline and a slower
    loop, and compare with another server from the same machine.
  - Any 5xx, or a `/` or `/api` failure with a fast connect, means stop and report.
- `/v2/` returns 200; `/v2/config.json` has `authServerClientId` and a non-empty secret (check in
  a script, never print it).
- `docker inspect <ui container> --format '{{.RestartCount}} {{.State.Status}}'` shows 0 restarts.
  Health stays `starting` for up to a minute.
- Consul has `resources/v2` and `resources/v2/<all>` pointing at `openlmis-ui`.
- Ask the user to sign in on `/`, then open `/v2/`: they should already be signed in. Forked
  legacy UIs make this check essential.

## 8. Clean up

`rm -rf ~/new-ui-<env>` and any downloaded bundle or keys file, then unset the `DOCKER_*`
variables.

## Updating to a new image

Build the working folder as in step 4 with the new tag (a mutable `-SNAPSHOT` tag stays the
same), start the probe, then pull while the old container keeps serving:

```bash
docker compose -p <project> pull openlmis-ui
docker image inspect openlmis/openlmis-ui:<tag> --format '{{index .RepoDigests 0}}'
```

Compare the digest with Docker Hub's, so you know the intended build is the one about to run.

**Twin handoff (no gap).** Images whose `registration.mjs` releases only its own keys on stop
(look for `releaseResource`) can hand `/v2` to a temporary twin:

```bash
# 1. A twin on the new image takes over /v2 under another service name
docker compose -p <project> run -d --no-deps --name <project>-openlmis-ui-next \
  -e SERVICE_NAME=openlmis-ui-next openlmis-ui
# wait until resources/v2 reads openlmis-ui-next, then:
# 2. Recreate the main container; it takes /v2 back on start
docker compose -p <project> up -d --no-deps --force-recreate openlmis-ui
# wait until resources/v2 reads openlmis-ui again, then:
# 3. Remove the twin; it leaves the keys alone because they are no longer its own
docker stop <project>-openlmis-ui-next && docker rm <project>-openlmis-ui-next
```

Check `resources/v2` between steps (`?raw` on the KV API) and that it ends on `openlmis-ui`.
If the twin never takes over, remove it and stop; nothing has changed. If step 2 fails after the
twin took over, the twin keeps serving `/v2`: leave it running, fix or roll back the main
container (Rollback below), and remove the twin only once `resources/v2` reads `openlmis-ui`.

The container being stopped decides whether there is a gap. When the running container is an
older image that deletes the keys unconditionally, step 2 leaves `/v2` unrouted until the new
main container registers: plan for a few seconds then, and skip the twin entirely if you like
(`up -d --no-deps --force-recreate openlmis-ui` alone gives the same gap). Say which case
applies before running. The legacy UI and API are unaffected either way.

`-SNAPSHOT` tags are mutable; production should pin a release tag.

## Rollback

```bash
docker compose -p <project> stop openlmis-ui && docker compose -p <project> rm -f openlmis-ui
```

It deregisters itself, so `/v2` stops routing. Nothing else changes. To roll back to an older
tag, run the update with that tag instead.

## PRs

Commit the same change so the next full deploy keeps the UI (otherwise it is dropped as an orphan,
or the compose file and running state disagree):

- **Deployment repo:** the `openlmis-ui` service in that environment's compose file.
- **Configuration repo:** `OL_UI_VERSION` when tags live in a versions file, and the login client
  when step 3 found it missing.
- Create branches in separate worktrees (`git worktree add ../<repo>-new-ui -b feat/new-ui
  <live branch>`), never by switching the user's checkout. PR into the live branch.
- Follow the repo's commit style; short body with `## Changes` bullets, no em dashes, no
  Co-Authored-By. Public PR bodies stay free of private details.
- **State the merge order** in both PRs: the PR providing settings or versions first.
  A missing `OL_UI_VERSION` fails the whole deploy; a missing login client only breaks login.
- Never push to other people's branches; open PRs only when the user asks; never merge without
  approval.

## Production checklist

Before asking for the production go-ahead, confirm and show the user:

- [ ] The tag has run on that instance's dev or test server and the user checked it there
- [ ] Production PRs prepared and reviewed by the instance's team
- [ ] Steps 1 to 3 done for production: access, live branch, gateway, collisions, login client
- [ ] Dry run lists only the new UI container; for updates, the exact twin and recreate commands
      are written out
- [ ] Baseline probe running; rollback command ready
- [ ] The user approved in their latest message, naming production and the command
