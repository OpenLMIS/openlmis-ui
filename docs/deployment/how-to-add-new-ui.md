# Adding the UI to an environment

From nothing to `/v2` serving on a live server. Five steps.

[deployment.md](deployment.md) explains why each piece works the way it does.

## Before you start

- `openlmis/openlmis-ui:<version>` exists on Docker Hub
- You have Jenkins admin
- You can open PRs on `openlmis-deployment` and the private `openlmis-config`

## 1. Create the Jenkins job

*New Item* → name it `OpenLMIS-ui-pipeline` → **Multibranch Pipeline**.

> Create it fresh. Do **not** use "Copy from". Copying a multibranch job brings the
> other repo's branches and their revisions with it, and the first build fails.

| Field | Value |
| --- | --- |
| Display Name | `OpenLMIS UI` |
| Description | `The React UI for the OpenLMIS project, deployed beside the reference UI.` |
| Branch Sources | GitHub, credential `GitHub Access Token`, `https://github.com/OpenLMIS/openlmis-ui` |
| Behaviours | Discover branches; PRs from origin; PRs from forks, **Trust: From users with Admin or Write permission** |
| Build Configuration | by Jenkinsfile, `Jenkinsfile` |
| Orphaned Item Strategy | Discard old items |

Trust must not be `Everyone`: the repo is public, and the build holds the shared
Docker Hub push credential.

Save, then **Scan Repository Now**. It finds `master`, builds, and pushes the image.

## 2. Add the OAuth client

In the private `openlmis-config` repo, add to that environment's file
(`test.env`, `uat.env`, and so on):

```
# Identifies the new UI at /v2 to the auth service so users can log in.
AUTH_SERVER_CLIENT_ID=user-client
AUTH_SERVER_CLIENT_SECRET=changeme
```

This is the client the platform already uses. Nothing new is registered.

Without it the UI loads fine and only login fails.

## 3. Add the service

In `openlmis-deployment`, pin the version in `deployment/<env>_env/.env`:

```
OL_UI_VERSION=0.1.0-SNAPSHOT
```

Then add the service to the same folder's `docker-compose.yml`, next to
`reference-ui`:

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

> Copy the style of the file you are editing. `test_env` and `uat_env` are written
> differently, and the block above is `test_env`'s.

The gateway needs no change.

## 4. Deploy

Run `OpenLMIS-3.x-deploy-to-test` with `KEEP_OR_WIPE=keep`.

It redeploys everything, so the environment is briefly offline. Nothing triggers it
automatically; run it when you want the change live.

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
| Login fails with `MissingAuthClientCredentialsError` | Step 2 was missed. `/v2/config.json` will show empty values |
| Container exits with `No build at /x/` | `BASE_PATH` does not match the image. Use the prefix it was built with |
| Random `000` or `429` from curl | You are being rate limited. Slow the requests down |
