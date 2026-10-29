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
  components/         # Shared components, grouped by role:
    ui/               #   generated shadcn components
    app-shell/        #   shell, navigation, status and error pages, offline notices
    workspace/        #   page layout and tabs
    display/          #   cards, record tables and shared dialogs
    pickers/          #   facility/program and product pickers
    auth/ i18n/       #   sign-in pieces, direction and translated labels
    shared/           #   small widgets used everywhere
    data-table/ form/ form-dialog/ valid-assignments/
  integrations/       # Axios, TanStack Query/Router and i18next singletons
  lib/                # Shared config, types, utilities and query keys
  hooks/              # Shared hooks
  test-utils/         # Vitest setup and test helpers
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

The offline scripts build and stop their own guarded preview server. API responses are fixtures;
stock-event POSTs are stubbed or blocked. Install the required browser binaries, then run:

```bash
pnpm exec playwright install chromium firefox webkit
pnpm test:offline              # Chromium scenarios
pnpm test:offline:browsers     # Installed browser engines and channels
```

WebKit needs its host libraries (`pnpm exec playwright install-deps webkit`); Chrome and Edge
need their Linux channels installed. Missing browsers are reported separately from test results.
Reports go to `.offline/`. Set `OFFLINE_PREVIEW_URL` to use an isolated, guarded preview
instead of the server managed by the test configuration. The Chromium suite runs nightly and
on pull requests labeled `offline`; see `.github/workflows/offline.yml`.

## Contributing

[AGENTS.md](AGENTS.md) defines coding patterns, constraints and conventions.
[docs/](docs/README.md) indexes the human guides.

Lefthook runs staged Biome fixes, translation sorting and typecheck before commits;
Biome, design-system lint, typecheck and the full test suite before pushes.
