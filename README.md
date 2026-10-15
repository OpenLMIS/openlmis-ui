# OpenLMIS UI

OpenLMIS frontend built with React 19, TypeScript, Vite and Tailwind CSS v4. It runs beside
legacy AngularJS on the same host, under `/v2`, so screens can migrate independently.
The [dual-boot guide](docs/dual-boot/dual-boot.md) explains how users choose between UIs.

## Quick start

Requires Node 24 (`.nvmrc`) and pnpm 12 (`packageManager` in `package.json`).

```bash
cp .env.example .env
pnpm install
pnpm dev
```

The dev server proxies `/api` and `/localeSettings` to `VITE_API_PROXY_TARGET`, keeping
browser requests same-origin without CORS setup.

## Environment variables

Adjust `.env` using `.env.example`. Vite reads these at dev/build time; the table shows
fallbacks when unset, not the example file's values.

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | Same-origin API path, outside the app's URL prefix |
| `VITE_API_PROXY_TARGET` | `http://localhost:8080` | Dev/preview target for `/api` and `/localeSettings` |
| `VITE_FE_PORT` | Vite default | Dev server port |
| `VITE_AUTH_SERVER_CLIENT_ID` | - | OAuth password-grant client id, fallback when runtime config omits it |
| `VITE_AUTH_SERVER_CLIENT_SECRET` | - | OAuth client secret, fallback when runtime config omits it |
| `VITE_DEFAULT_ISSUE_REASON_ID` | - | Default Issue reason id, fallback when runtime config omits it |
| `VITE_DEFAULT_RECEIVE_REASON_ID` | - | Default Receive reason id, fallback when runtime config omits it |
| `VITE_KIT_UNPACK_REASON_ID` | - | Kit debit reason id, fallback when runtime config omits it |
| `VITE_UNPACKED_FROM_KIT_REASON_ID` | - | Kit contents credit reason id, fallback when runtime config omits it |
| `VITE_SHOW_DEVTOOLS` | - | `true` enables TanStack devtools |
| `VITE_BASE_PATH` | `/` | App prefix compiled into asset URLs |

Containers write OAuth credentials, the default Issue and Receive reasons
(`DEFAULT_ISSUE_REASON_ID`, `DEFAULT_RECEIVE_REASON_ID`), kit unpack reasons
(`KIT_UNPACK_REASON_ID`, `UNPACKED_FROM_KIT_REASON_ID`) and deployment flags to `config.json`
at startup. Feature flags have no `.env` fallback.
`VITE_BASE_PATH` remains a build input and must match container `BASE_PATH`; see the
[deployment guide](docs/deployment/deployment.md).

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm build` | Type-check and production build |
| `pnpm preview` | Preview production build |
| `pnpm check` | Biome lint, format and organize imports |
| `pnpm lint` | Biome lint |
| `pnpm lint:ds` | Design-system rules via Oxlint |
| `pnpm format` | Format |
| `pnpm test` | Vitest watch mode |
| `pnpm test:run` | Vitest single run |
| `pnpm test:offline` | Production `/v2` offline suite in headless Chromium |
| `pnpm test:offline:browsers` | Same suite in each runnable browser, with an availability report |
| `pnpm test:offline:proof` | English/Arabic desktop/phone captures in headless Chromium |
| `pnpm sort-messages` | Alphabetize translation keys |

Local test runs use Vitest's `25%` worker limit. CI runs two test shards with its default
worker parallelism.

## Project layout

Each feature owns its API calls, queries, components and types.

```text
src/
  index.tsx           # Entry point
  globals.css         # Base theme tokens; presets in lib/theme-presets.ts
  routes/             # TanStack file-based routes; generated route tree
  features/<name>/    # Feature api/, components/, hooks/, lib/, store/
  components/         # Shared components; ui/ holds generated shadcn components
  integrations/       # Axios, TanStack Query/Router and i18next singletons
  lib/                # Shared config, types, utilities and query keys
  hooks/              # Shared hooks
public/locales/       # Runtime-fetched translation catalogs
docs/                 # User, deployment and offline guides
docker/               # Entrypoint, nginx template and Consul registration
```

## Languages

English, Portuguese, Arabic, Spanish and French ship with the app. Catalogs in
`public/locales/` load at runtime, so deployments can correct strings without rebuilding.
All screens must support both left-to-right and Arabic right-to-left layouts.
See [AGENTS.md](AGENTS.md#internationalization-i18next) for registering another language.

## Deployment

The container runs next to legacy `reference-ui`. Consul routes its prefix without changes
to the shared nginx gateway. To try the full stack locally:

```bash
docker compose up --build   # http://localhost:8080/v2/
```

The [deployment guide](docs/deployment/deployment.md) covers routing, build prefixes and
adding the service to `openlmis-deployment`.

## Offline support

After one online visit, the service worker lets the app open/reload offline in every
supported language. Adjustments downloads, device drafts, queued submission and recovery are
available. See [Working Offline](docs/working-offline/working-offline.md) and the
[offline plan](docs/offline-plan/offline-plan.md).

The worker runs only in production builds. To try it locally, supply `dist/config.json`
with runtime settings after building, then preview:

```bash
VITE_BASE_PATH=/v2 pnpm build
# Place config.json in dist/ before previewing.
VITE_BASE_PATH=/v2 pnpm preview   # http://localhost:4173/v2/
```

The offline suites use fixture API responses and intercept all stock-event POSTs. They build
and stop their own preview server. Install test binaries with `pnpm exec playwright install
chromium firefox webkit`. Chrome and Edge channels run when their Linux installations are
available. WebKit also needs host libraries from `pnpm exec playwright install-deps webkit`
(with permission to install system packages), or the Docker route below. The browser runner
records missing binaries or host dependencies separately from test results in
`.offline/browser-verification.json`; an unavailable engine is not a pass.
`pnpm test:offline` stays Chromium-only. Visual proof writes screenshots and verification JSON
to `.screenshots/fm-165-stage-9/`.

For Linux hosts missing WebKit libraries or Edge, use the matching official image
`mcr.microsoft.com/playwright:v1.64.1-noble` (`docker pull` first). On x86_64 Linux, run with
`--network host --ipc host` and mount this worktree read-only. Copy `node_modules`,
`package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `playwright.config.ts`, `tests` and
`scripts` to a writable container directory. Install Edge there as container root with
`corepack pnpm exec playwright install msedge`; WebKit is already installed. Enable the pinned pnpm
through Corepack. Edge's Linux channel requires x86_64.

On the host, build with `VITE_BASE_PATH=/v2 pnpm build`, copy
`tests/offline/config.json` to `dist/config.json`, then start
`VITE_BASE_PATH=/v2 VITE_API_PROXY_TARGET=http://172.17.0.1 node scripts/preview-offline-tests.mjs`.
Here `172.17.0.1` is the local Docker bridge address; set `VITE_API_PROXY_TARGET` for your
backend, or omit it for the default localhost target. This guarded preview rejects API
fall-through. From the writable container directory, run:

```bash
OFFLINE_PREVIEW_URL=http://127.0.0.1:9165/v2/ corepack pnpm exec playwright test \
  --config playwright.config.ts --project=webkit --project=msedge
```

Copy `.offline/browser-results.json` out before removing the container and stop the host
preview afterwards. Keep container writes in its local copy to avoid root-owned host files.
WebKit's `@offline-shell` cases allow service workers. Six cases pass with the real worker cache: saved access, stale
bundles, exact draft restart, direct-route gates, bare shell reload and offline Submit restart.
Two cases require fixture-backed same-user renewal or connected submission after worker
takeover, which WebKit 27.2 bypasses. They skip only with Playwright 1.64.1 / WebKit 27.2;
a future version reruns them. Other WebKit cases block workers so their API fixtures remain
effective and do not prove app-shell caching. The native timeout case runs in every engine
using a delayed local HTTP response. `node scripts/diagnose-offline-webkit.mjs` compares
WebKit and Chromium against a synthetic worker and loopback server. It reproduces the fixture
bypass and shows that native offline worker navigation now works. Set `OFFLINE_PREVIEW_URL`
to include the actual app reload with no request interception. Shell tests await worker
control, then poll until config and all five language catalogs are readable from the cache.
WebKit on Linux verifies that engine; actual Safari and Apple devices still need testing.

For read-only local storage sizing, preview a production `/v2` build with real runtime OAuth
settings in `dist/config.json` (not the browser fixture config), the configured
`VITE_API_PROXY_TARGET` and port 9166. Then run `node scripts/measure-offline-storage.mjs`.
It needs local demo data: `administrator`, Comfort Health Clinic, Essential Meds and Family
Planning. Supply `OFFLINE_MEASUREMENT_PASSWORD` if the demo password differs. This ordinary
preview must proxy read-only API calls, unlike the guarded test preview. The script blocks
business writes and inserts sizing fixtures only in an isolated browser database. Output is
`.offline/stage-9-storage.json`, with a `completed` flag. `OFFLINE_PREVIEW_URL` selects another
preview URL (default `http://127.0.0.1:9166/v2/`). Results in `.offline/` and screenshots in
`.screenshots/` are local-only, gitignored artifacts. `scripts/measure-offline-bundle.mjs`
remains the separate read-only test-server payload/timing probe.

## Contributing

[AGENTS.md](AGENTS.md) defines coding patterns, constraints and conventions.
[docs/](docs/README.md) indexes the human guides.

Lefthook runs staged Biome fixes, translation sorting and typecheck before commits;
Biome, design-system lint, typecheck and the full test suite before pushes.
