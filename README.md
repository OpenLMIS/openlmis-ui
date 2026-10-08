# OpenLMIS UI

Web frontend for OpenLMIS, built with React 19, TypeScript, Vite and Tailwind CSS v4.

It is designed to run **beside** the legacy AngularJS UI rather than replace it in one
step. Both are served from the same host, the new UI under a URL prefix (`/v2`), so a
screen can move over on its own schedule and users pick which one to use.

[docs/dual-boot/dual-boot.md](docs/dual-boot/dual-boot.md) explains what that looks like for users.

## Quick start

Requires Node 24 (see `.nvmrc`) and pnpm 12 (pinned via `packageManager` in `package.json`).

```bash
cp .env.example .env
pnpm install
pnpm dev
```

The dev server proxies `/api` and `/localeSettings` to the OpenLMIS instance named by
`VITE_API_PROXY_TARGET`, so the browser stays same-origin and there is no CORS to configure.

## Environment variables

Copy `.env.example` to `.env` and adjust. All are read at build time by Vite.

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | Axios base URL. Keep it relative so the proxy decides the target |
| `VITE_API_PROXY_TARGET` | `http://localhost:8080` | OpenLMIS instance the dev server forwards `/api` and `/localeSettings` to |
| `VITE_FE_PORT` | Vite default | Dev server port |
| `VITE_AUTH_SERVER_CLIENT_ID` | - | OAuth client id for the password grant |
| `VITE_AUTH_SERVER_CLIENT_SECRET` | - | OAuth client secret for the password grant |
| `VITE_SHOW_DEVTOOLS` | - | Set to `true` to enable TanStack devtools |
| `VITE_BASE_PATH` | `/` | URL prefix the app is served under, compiled into asset paths |

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server |
| `pnpm build` | Type-check + production build |
| `pnpm preview` | Preview production build |
| `pnpm check` | Lint + format + sort imports |
| `pnpm lint` | Lint only |
| `pnpm lint:ds` | Design-system rules (shadcn/lint via Oxlint) |
| `pnpm format` | Format only |
| `pnpm test` | Tests in watch mode |
| `pnpm test:run` | Tests single run (CI) |
| `pnpm sort-messages` | Sort translation keys alphabetically |

## Project layout

Features are self-contained: each owns its API calls, queries, components and types.

```
src/
  index.tsx           # Entry point
  globals.css         # Global styles + base theme tokens (presets in lib/theme-presets.ts)
  routes/             # File-based routes (TanStack Router), route tree is generated
  features/<name>/    # api/, components/, hooks/, lib/, store/ per feature
  components/         # Shared components; components/ui/ is shadcn-generated
  integrations/       # Axios, TanStack Query/Router, i18next singletons
  lib/                # config, shared types, utils, query key factory
  hooks/              # Shared hooks
public/locales/       # Translation catalogs, fetched at runtime
docs/                 # Deployment notes, the dual-boot guide and the offline plan
docker/               # Container entrypoint, nginx template, Consul registration
```

## Languages

Ships with English, Portuguese, Arabic, Spanish and French. Catalogs are static assets under
`public/locales/`, fetched at runtime rather than bundled, so a deployment can correct a
string or add a language without rebuilding.

Arabic means the app renders right-to-left, and every screen is expected to work in both
directions.

## Deployment

The app runs as a container inside an existing OpenLMIS stack, next to the legacy
`reference-ui`, serving a URL prefix so both UIs are available at once. Routing comes from
Consul, so the shared nginx gateway needs no change.

To run the whole thing locally, including Consul and the real gateway image:

```bash
docker compose up --build   # then http://localhost:8080/v2/
```

See [docs/deployment/deployment.md](docs/deployment/deployment.md) for how routing works, why the prefix is a
build input, and the snippet to add to `openlmis-deployment`.

## Offline support

After one online visit the app opens and reloads offline, in every language: a service worker
keeps its files. Offline data and drafts come next. The [offline plan](docs/offline-plan/offline-plan.md)
says what is done and what follows.

The service worker only runs in a production build. To try it, build with the base path and
preview it, since `pnpm dev` never registers one:

```bash
VITE_BASE_PATH=/v2 pnpm build && VITE_BASE_PATH=/v2 pnpm preview   # http://localhost:4173/v2/
```

## Contributing

[AGENTS.md](AGENTS.md) is the working reference for anyone writing code here, human or
agent. It covers the data-fetching pattern, the RTL rules, i18n, the design-system lint
constraints, page layout and commit conventions.

[docs/](docs/README.md) indexes the longer-form documentation.

Pre-commit and pre-push hooks (lefthook) run Biome, typecheck and the test suite, so
`pnpm check && pnpm test:run` before pushing saves a round trip.
