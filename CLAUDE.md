# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

OpenLMIS UI is the web frontend for OpenLMIS.

## Commands

```bash
pnpm dev              # Start Vite dev server with HMR
pnpm build            # TypeScript type-check + production build (tsc -b && vite build)
pnpm preview          # Preview production build locally
pnpm check            # Biome lint + format + organize imports (all-in-one)
pnpm lint             # Biome linter only
pnpm lint:ds          # shadcn/lint design-system rules via Oxlint
pnpm format           # Biome formatter only
pnpm test             # Vitest in watch mode
pnpm test:run         # Vitest single run (CI mode)
```

Run a single test file: `pnpm vitest run src/hooks/use-mobile.test.ts`

Sort translation keys: `pnpm sort-messages`

Pre-commit hooks (lefthook) automatically run `biome check --write --staged` and `tsc --noEmit`.

## Architecture

**Stack**: React 19, TypeScript 7, Vite 8 (Rolldown), Tailwind CSS v4, shadcn/ui, TanStack Router + Query, TanStack Form + Zod, Axios, i18next.

### File-based routing (TanStack Router)

Routes live in `src/routes/`. The route tree is auto-generated (`src/route-tree.gen.ts` - never edit manually). Route groups use parentheses `(protected)` for shared layouts without URL segments. Layout routes use underscore prefix `_protected.tsx`.

### Data fetching pattern

Routes pre-fetch data via `loader()` → `queryClient.ensureQueryData(queryOptions)`, then components read the cache with `useSuspenseQuery(queryOptions)`. Query options are defined in `src/features/*/api/queries.ts` using the key factory from `src/lib/key-factory.ts`.

### Feature-based modules

Each feature is self-contained under `src/features/<name>/`:
- `api/api.ts` - HTTP calls using the shared Axios client (`src/integrations/axios.ts`)
- `api/queries.ts` - TanStack Query options (queryFn + queryKey)
- `components/` - Presentational components
- `lib/types.ts` - Feature-specific types

Shared code lives in `src/lib/` (utils, types, constants, config, key-factory).

### Internationalization (i18next)

Translations are bundled in code under `src/messages/<lang>.json` as **flat key-value pairs** - always flat, never nested (e.g. `"users.title": "Users"`, not `{ users: { title: "Users" } }`). `keySeparator` and `nsSeparator` are both `false` in the i18next config to enforce this. ICU MessageFormat is enabled for plurals/selects. Supported languages are defined in `src/lib/config.ts`. Type safety via module augmentation in `src/types/i18next.d.ts` - `t()` autocompletes keys and `tsc` catches typos. Keys must be sorted alphabetically (`pnpm sort-messages`), enforced by pre-commit hook.

When `en.json` changes, use the `sync-translations` skill to propagate changes to other language files (removes stale keys, translates missing ones, preserves existing translations).

Zod validation messages hold **translation keys**, not translated strings (see
`src/features/auth/lib/types.ts`), and the key is resolved with `t()` at render. A form
keeps whatever a field last validated to, so a message translated at validation time would
stay in the old language after a language switch.

### Design-system linting (shadcn/lint)

`@shadcn/lint` checks Tailwind usage against the design system: restyling shadcn
components via `className`, raw colors, arbitrary values, unknown classes. It is an
ESLint/Oxlint JS plugin and **cannot run under Biome** - Biome's plugin system accepts
GritQL only, so it cannot load a JS plugin (see shadcn-ui/lint#14). Oxlint is therefore
installed purely as the host for this one plugin.

`.oxlintrc.json` turns every Oxlint category off, so Oxlint reports shadcn rules and
nothing else and never overlaps Biome. Biome stays the linter and formatter of record.

All six rules are `error` and gate CI. The codebase is at zero findings, so keep it
there rather than downgrading a rule to `warn`.

`no-restyle` runs with no allowlist: a shadcn component accepts **no** `className` from
the outside. Not colour, not typography, not spacing, and not layout or margin either.

Two ways out when a page needs a different treatment:

1. Add a variant prop to the component in `src/components/ui/` and pass it. Existing
   examples: `Button padding/width` + the `xl` size, `CardHeader spacing/align`,
   `CardTitle size`, `CardFooter align`, `Separator spacing`, `Skeleton shape/fill`,
   `Spinner tone/size`, `Empty height`, `EmptyMedia size`, `EmptyTitle size`,
   `EmptyDescription size`, `DropdownMenuContent width`, `DropdownMenuLabel gap/layout`,
   `Sidebar surface`, `SidebarInset surface`, `SidebarHeader bordered/layout`,
   `SidebarFooter padding`.
2. Put the layout classes on a plain wrapper element around the component. This is the
   right call for one-off positioning (`<div className="w-full max-w-sm"><Card>...`) and
   for `Skeleton`, whose size always belongs to the surrounding layout.

`src/components/ui/` is ignored by the linter - those files define the variants the
rules enforce. This is the one place where editing generated shadcn files is expected.

**Switching presets or re-running `shadcn add` overwrites these files and silently drops
every variant listed above.** `pnpm tsc --noEmit` is what catches it: the call sites keep
passing props the regenerated component no longer accepts. Re-apply the variants to the
new files rather than reverting the preset.

### Integrations

`src/integrations/` contains singleton setup for Axios (with proxy to `/api` → `localhost:8080`), TanStack Query client, TanStack Router instance, and i18next configuration.

### UI components

shadcn/ui components are generated in `src/components/ui/` and excluded from Biome linting. Use `pnpm dlx shadcn@latest add <component>` to add new ones. The `cn` helper comes from the `cn` package and is re-exported from `src/lib/utils.ts`.

### pnpm settings

pnpm is pinned via `packageManager` in `package.json`. Settings that used to live under the `pnpm` key in `package.json` (such as `allowBuilds`, formerly `onlyBuiltDependencies`) belong in `pnpm-workspace.yaml`, which pnpm 12 reads instead. pnpm 12 errors on unrecognized keys there rather than ignoring them.

## Code Conventions

- **pnpm** - always use pnpm, not npm
- **kebab-case filenames** - enforced by Biome (e.g., `user-card.tsx`)
- **`type` over `interface`** - enforced by Biome
- **`@/*` path aliases** - always use for imports (maps to `src/*`)
- **Tests colocated** with source files (e.g., `use-mobile.test.ts` next to `use-mobile.ts`)
- **Biome formatting**: 2-space indent, single quotes, trailing commas, 100 char line width
- **No Co-Authored-By lines** in commits or PRs
- **No em dashes** anywhere in the project - not in code, comments, UI copy, translations, docs, commits, or PRs. Use a plain hyphen or rephrase.
- **Comments only when really necessary** - max 1 line, and never any ticket or issue attributions. Prefer clear naming over explanation.

## Pull Request Format

Keep PR descriptions short and scannable. No walls of text.

1. **Ticket link** at the top, on its own line.
2. **`## Changes`** - bullet points only. One line per change, concise and easy to
   understand. No paragraphs, no narration of the process.
3. **UI artifacts** at the bottom when relevant - screenshots or recordings for any
   visible change.

Omit a section entirely when it does not apply rather than writing "N/A".

```markdown
https://tracker.example.com/BROWSE/ABC-123

## Changes

- Add `surface` variant to `Card` so consumers stop overriding `bg-card`
- Replace arbitrary text sizes with a `text-2xs` theme token

## Screenshots

| Before | After |
| --- | --- |
| ... | ... |
```

## Page layout

Pages inside the app shell compose `src/components/workspace.tsx` rather than
hand-rolling padding:

```tsx
<Workspace>
  <WorkspaceHeader>
    <WorkspaceHeading>
      <WorkspaceTitle>{t('requisitions.title')}</WorkspaceTitle>
      <WorkspaceDescription>{t('requisitions.description')}</WorkspaceDescription>
    </WorkspaceHeading>
    <WorkspaceActions>
      <Button>{t('requisitions.create')}</Button>
    </WorkspaceActions>
  </WorkspaceHeader>
  <WorkspaceContent>{/* page body */}</WorkspaceContent>
</Workspace>
```

Every part takes only `children` - no boolean props, no `renderX` callbacks. A page
without a description or actions just leaves those parts out. None of them accept a
`className`, which is what keeps padding and heading scale identical across pages; if a
page needs a different treatment, add a variant to the component rather than overriding
at the call site.

## Authentication

`/login` exchanges credentials for a token at `POST /api/oauth/token?grant_type=password`.
The auth service authenticates the *client* over HTTP Basic first, so the request also
carries `Basic base64(VITE_AUTH_SERVER_CLIENT_ID:VITE_AUTH_SERVER_CLIENT_SECRET)`.

The token lives in a persisted zustand store (`src/features/auth/store/login-data.ts`),
which is read outside React by the axios request interceptor (attaches the bearer token)
and by the router guards (`_protected.tsx` redirects anonymous users to `/login`; `/login`
redirects authenticated ones to `/dashboard`). A `401` clears the store and returns to
`/login`.

Nothing talks to the API directly in development - the Vite dev server proxies `/api` to
`VITE_API_PROXY_TARGET`, keeping the browser same-origin.

## Environment Variables

Defined in `.env.example`:
- `VITE_API_BASE_URL` - Axios base URL, kept relative (default: `/api`)
- `VITE_API_PROXY_TARGET` - OpenLMIS instance the dev server proxies `/api` to
- `VITE_FE_PORT` - Dev server port
- `VITE_AUTH_SERVER_CLIENT_ID` / `VITE_AUTH_SERVER_CLIENT_SECRET` - OAuth client credentials
- `VITE_SHOW_DEVTOOLS` - Enable TanStack devtools in dev mode
