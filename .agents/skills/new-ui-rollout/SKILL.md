---
name: new-ui-rollout
description: Add, update or remove the new OpenLMIS UI (openlmis/openlmis-ui under /v2) on any OpenLMIS server that routes through Consul and openlmis/nginx, without downtime, and prepare the matching deployment and configuration PRs. Use whenever the user mentions rolling out the new UI, /v2, a no-downtime deploy, a new UI version on a server, or production, even if they don't name the skill.
---

# New UI rollout

The new UI runs beside the legacy UI as its own container. Starting, updating or stopping that
one container never restarts anything else, so the site stays up. The Jenkins deploy jobs do
the opposite: their restart script runs `docker-compose down -v` (on some instances it also
removes every container and image) before recreating everything, which takes the whole site
offline. Never use them for this.

## Safety rules (read first, every time)

1. **Read-only by default.** Inspecting files and running read-only commands is fine. Any change
   (starting/stopping containers, git push, PRs, Consul writes) needs the user's go-ahead for that
   specific step in the current conversation. Approval for one step or one environment does not
   carry over to the next.
2. **Only the environments the user allowed.** Some instances limit you to test unless told
   otherwise. If unsure which environments are allowed, ask.
3. **Production needs its own explicit approval.** Only act on production when the user's latest
   message names production and the action. Before running, restate: environment, host, compose
   project, image tag, exact command. Then wait for "yes". Never infer it from earlier approvals,
   from test succeeding, or from a skill/plan.
4. **Same tag on a test server first.** Production only gets an image tag already checked on that
   instance's test server.
5. **Never run** `docker compose down`, `up` without `--no-deps <service>`, `restart` of other
   services, `--remove-orphans`, `docker system prune`, `docker rm/rmi` of other containers,
   Consul KV writes by hand, the Jenkins deploy or restore jobs, or anything touching the
   database or its volume.
6. **Check the target before every command.** `echo $DOCKER_HOST` must name the intended host, and
   `docker ps` must show that environment's container prefix. Use a fresh shell per environment;
   never leave `DOCKER_HOST` pointing at production.
7. **Secrets stay local and short-lived.** The settings file holds secrets. Keep working copies in
   a `700` folder under `$HOME`, never print values, delete the folder afterwards.

## Will it work here?

The method needs the standard OpenLMIS gateway. Confirm read-only before planning:

- `openlmis/nginx` runs consul-template (`ps` inside the nginx container shows it).
- The legacy UI holds the global catch-all (`resources/<all>` in Consul) and nothing owns `v2`.
- The settings file has `AUTH_SERVER_CLIENT_ID` and `AUTH_SERVER_CLIENT_SECRET` for a client with
  the `password` grant (usually the legacy UI's own client). Without them the UI loads but login
  fails. The new UI also reads `DEFAULT_ISSUE_REASON_ID`, `DEFAULT_RECEIVE_REASON_ID`,
  `KIT_UNPACK_REASON_ID`, `UNPACKED_FROM_KIT_REASON_ID`, `QUANTITY_UNIT_OPTION`,
  `DEFAULT_QUANTITY_UNIT`, `CATCHMENT_POPULATION_CALC_AUTO` and `GS1_SCANNING`.
- The instance's `LOCALE` is one the new UI ships (`en`, `pt`, `ar`, `es`, `fr`).
- **Which branch is live?** It may not be `master`. Compare running images
  (`docker ps --format '{{.Image}}'`) with each branch's versions file and base work on the
  matching branch. Ask the user if unclear.

## How it works

[docs/deployment/deployment.md](../../../docs/deployment/deployment.md) explains the routing,
runtime config and image publishing in depth.

Nothing is built or run locally. Your machine only sends instructions; the server does the rest.

1. **The image already exists.** OpenLMIS Jenkins builds `openlmis/openlmis-ui` from
   `openlmis-ui` `master` and publishes it to Docker Hub.
2. **You describe the container locally.** `docker compose` reads three local files (the compose
   file, the settings file as `settings.env`, the versions file as `.env`) and turns them into one
   container definition: image, settings, network, `BASE_PATH=/v2`.
3. **The server runs it.** With `DOCKER_HOST` set, the `docker` client sends that definition to
   the server's Docker over TLS, as Jenkins does. The server pulls the image from Docker Hub and
   starts the container. The local files never leave your machine.
4. **The container claims `/v2`.** On start it registers `resources/v2` and `resources/v2/<all>`
   in Consul.
5. **nginx follows.** consul-template sees the new keys, rewrites the nginx config and runs
   `nginx -s reload`. The reload is graceful: open connections finish, new ones use the new
   routes. The `/v2` routes come before the legacy UI's catch-all, so `/` and `/api` keep working
   as before.
6. **Stopping reverses it.** The container removes its keys, nginx reloads again, and `/v2` stops
   routing within seconds.

## Procedure

Placeholders: `<host>`, `<certs>`, `<project>` (compose project, usually `<env>_env`), and the
three source files from the instance's deployment and configuration repos.

### 1. Read the current state (read-only)

```bash
export DOCKER_TLS_VERIFY=1
export DOCKER_HOST=tcp://<host>:2376
export DOCKER_CERT_PATH=<certs>
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}'
docker network ls --format '{{.Name}}'                      # <project>_default
docker exec <project>-consul-1 consul kv get -keys resources/ | grep v2
docker inspect <project>-nginx-1 --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}'
```

### 2. Build the working folder (local)

A snap-packaged Docker cannot read `/tmp`; use `$HOME`.

```bash
mkdir -p ~/new-ui-<env>/<project> && chmod 700 ~/new-ui-<env> && cd ~/new-ui-<env>/<project>
git -C <deployment repo> show <branch>:<compose file> > docker-compose.yml
git -C <config repo> show <branch>:<settings file> > settings.env
git -C <versions repo> show <branch>:<versions file> > .env
chmod 600 settings.env .env
```

The compose file needs this service (match the file's style), and `.env` needs
`OL_UI_VERSION=<tag>`:

```yaml
  openlmis-ui:
    image: openlmis/openlmis-ui:${OL_UI_VERSION}
    env_file: settings.env
    environment:
      BASE_PATH: /v2
    depends_on:
      consul:
        condition: service_healthy
    logging:
      <<: *logging
```

Check: `docker compose -p <project> config openlmis-ui` shows the right image, `BASE_PATH: /v2`
and network `<project>_default`.

### 3. Dry run (show the user)

```bash
docker compose -p <project> up -d --no-deps --dry-run openlmis-ui
```

The output must mention only `<project>-openlmis-ui-1`. Anything else: stop and report.

### 4. Probe, then run (needs approval; production needs its own)

Start a probe in the background first (one request per second to `/`, `/api/facilities` and
`/v2/`, logging status codes), then:

```bash
docker compose -p <project> up -d --no-deps openlmis-ui
```

`-p <project>` joins the existing project and network; `--no-deps` leaves every other service
alone.

### 5. Verify

- Probe: `/` always 200, `/api/facilities` always 401. Any other code means stop and report.
- `/v2/` returns 200; `/v2/config.json` has `authServerClientId` and a non-empty secret (never
  print it).
- `docker inspect <project>-openlmis-ui-1 --format '{{.RestartCount}} {{.State.Health.Status}}'`
- `docker exec <project>-consul-1 consul kv get -recurse resources/v2` shows `openlmis-ui`.
- The user signs in on `/` and opens `/v2/` to confirm the session carries over. Instances with
  a forked legacy UI make this check essential.

### 6. Clean up

`rm -rf ~/new-ui-<env>` and unset the `DOCKER_*` variables.

## Updating to a new image

Same steps, with the new tag in `.env`, then `docker compose -p <project> pull openlmis-ui` and
`up -d --no-deps openlmis-ui`. The container is recreated, so `/v2` is unavailable for a few
seconds (the legacy UI and API are not). Say so before running. `-SNAPSHOT` tags are
mutable; production should pin a release tag.

## Rollback

```bash
docker compose -p <project> stop openlmis-ui && docker compose -p <project> rm -f openlmis-ui
```

It deregisters itself, so `/v2` stops routing. Nothing else changes. To roll back to an older
tag, run the update with that tag instead.

## PRs

Commit the same change to the repos so the next full Jenkins deploy keeps the UI (otherwise it
is dropped as an orphan, or the compose file and running state disagree):

- Deployment repo: the `openlmis-ui` service in that environment's `docker-compose.yml`.
- Versions file: `OL_UI_VERSION=<tag>`.
- Settings file: only if the login client or other settings above are missing.
- Branch from the branch the environment runs; PR into that branch. Follow the repo's commit
  style; short body with `## Changes` bullets, no em dashes, no Co-Authored-By.
- **Merge the PR adding `OL_UI_VERSION` first.** A compose file referencing an unset
  `OL_UI_VERSION` makes the whole Jenkins deploy fail, not just the new UI.
- Never push to other people's branches; open PRs only when the user asks.

## Production checklist

Before asking for the production go-ahead, confirm and show the user:

- [ ] The tag has run on that instance's test server and the user checked it there
- [ ] Production PRs prepared and reviewed by the instance's team
- [ ] Read-only state collected: containers, project name, network, no existing `v2` keys
- [ ] Dry run lists only `<project>-openlmis-ui-1`
- [ ] Probe ready; rollback command ready
- [ ] The user approved in their latest message, naming production and the command
