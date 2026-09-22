# Adding the UI to an environment

`openlmis-ui` is already built and published by Jenkins on every merge to `master`.
Rolling it out to another server is four small changes and a check. Nothing about the
image, the pipeline or the gateway has to change.

Done once for `test.openlmis.org`. The same steps work for `uat_env`, `demo_env` and
the rest, with the per-environment differences called out below.

[deployment.md](deployment.md) explains why each piece works the way it does.

## Before you start

- Pick the version from Docker Hub, `openlmis/openlmis-ui`. Latest is `0.1.0-SNAPSHOT`
- You can open PRs on `openlmis-deployment` and the private `openlmis-config`
- You can run that environment's deploy job in Jenkins

## 1. Add the OAuth client

In the private `openlmis-config` repo, add to that environment's file
(`test.env`, `uat.env`, `v3-demo.env`, and so on):

```
# Identifies the new UI at /v2 to the auth service so users can log in.
AUTH_SERVER_CLIENT_ID=user-client
AUTH_SERVER_CLIENT_SECRET=changeme
```

This is the client the platform already uses. Nothing new is registered. An
environment with its own client uses that instead.

Without this the UI loads fine and only login fails.

## 2. Pin the version

In `openlmis-deployment`, in `deployment/<env>_env/.env`, next to the other UI:

```
OL_UI_VERSION=0.1.0-SNAPSHOT
```

## 3. Add the service

In the same folder's `docker-compose.yml`, next to `reference-ui`:

```yaml
  openlmis-ui:
    image: openlmis/openlmis-ui:${OL_UI_VERSION}
    env_file: settings.env
    environment:
      BASE_PATH: /v2
    depends_on: [consul]
    logging:
      <<: *logging
```

> Copy the style of the file you are editing. That block is `test_env`'s. `uat_env`
> is written differently, with `restart: always` and long-form `depends_on` using
> health conditions.

`BASE_PATH` is the only variable worth setting. Everything else has a default that
already matches, and the OAuth client arrives through `settings.env`.

The gateway needs no change. The container tells Consul it owns `/v2`, and nginx
picks that up on its own.

## 4. Deploy

Run that environment's deploy job, for example `OpenLMIS-3.x-deploy-to-test`.

> The parameter differs by environment. Test uses `KEEP_OR_WIPE` (`keep` or `wipe`);
> uat uses `KEEP_OR_RESTORE` (`keep` or `restore`). Either way, `keep` is the one
> that leaves data alone.

It redeploys everything, so the environment is briefly offline. Nothing triggers it
automatically; run it when you want the change live.

Later versions need only a new `OL_UI_VERSION` and another run. `0.1.0-SNAPSHOT` is a
mutable tag that each `master` build overwrites, so re-running alone picks up the
newest build of that version.

## 5. Check it worked

Backends take a few minutes to come back. The UIs answer sooner.

```bash
curl -o /dev/null -w '%{http_code}\n' https://<server>/v2/            # 200
curl -o /dev/null -w '%{http_code}\n' https://<server>/api/facilities # 401, not 502
curl https://<server>/v2/config.json                                  # keys not empty
```

Then sign in at `/`, open `/v2/`, and you should already be signed in.

## If something looks wrong

| What you see | What it means |
| --- | --- |
| `/api/*` returns 502 | Backends still starting. The old UI is broken too. Wait and recheck |
| `/v2/` 404s but `/` works | The service did not register with Consul. Check its container log |
| Login fails with `MissingAuthClientCredentialsError` | Step 1 was missed. `/v2/config.json` will show empty values |
| Container exits with `No build at /x/` | `BASE_PATH` does not match the image. Use the prefix it was built with |
| Random `000` or `429` from curl | You are being rate limited. Slow the requests down |
