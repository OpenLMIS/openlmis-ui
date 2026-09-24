# AGENTS.md

Working reference for anyone writing code in this repository, human or agent.

OpenLMIS UI is the web frontend for OpenLMIS. It runs beside the legacy AngularJS UI under
a URL prefix rather than replacing it in one step.

Four places, four audiences. Keep them apart rather than repeating:

- **AGENTS.md**, this file: how to write code here. Conventions, patterns, constraints.
- **README.md**: setup, environment variables, scripts, project layout.
- **[docs/](docs/README.md)**: written for humans using, supporting or deploying the
  system. Plain language, no conventions, no internals unless a reader needs them.
- **plans/**: one `plans/<KEY>.md` per Jira ticket, written by the `plan-implementation`
  skill before any code and committed with that ticket's PR. A plain summary for the team,
  then an agent brief with every API call mapped, and the UI/UX calls. Keep it true: when
  the build departs from the plan, update the plan in the same PR.

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

### App shell

The protected layout is an icon-collapsible sidebar (`Ctrl/Cmd+B`) plus a top bar, adapted
from the `@7ovr/app-shell-1` block. `NAV_GROUPS` in `src/lib/config.ts` is the single
source for both the sidebar menu and the `Ctrl/Cmd+K` command palette. Entries with
`to: '#'` are pages not migrated yet: `LIVE_NAV_GROUPS` leaves them, and any section with
no live page, out of the sidebar and the palette until they point at a real route.

### Data fetching pattern

Query options live in `src/features/*/api/queries.ts` and use the key factory from
`src/lib/key-factory.ts`. The loader starts the request; how it starts decides whether
navigation waits.

**Default to deferred.** `prefetchQuery` without `await` warms the cache while the route
transitions, so navigation is instant and only the data-dependent subtree suspends:

```tsx
export const Route = createFileRoute('/(protected)/_protected/facilities')({
  loader: ({ context: { queryClient } }) => {
    queryClient.prefetchQuery(facilitiesListOptions());
  },
  component: FacilitiesPage,
});

function FacilitiesPage() {
  return (
    <Workspace>
      <WorkspaceHeader>{/* renders immediately */}</WorkspaceHeader>
      <WorkspaceContent>
        <CatchBoundary getResetKey={() => 'facilities'} errorComponent={ErrorFallback}>
          <Suspense fallback={<PendingFallback />}>
            <FacilitiesTable />
          </Suspense>
        </CatchBoundary>
      </WorkspaceContent>
    </Workspace>
  );
}

function FacilitiesTable() {
  const { data } = useSuspenseQuery(facilitiesListOptions());
  // ...
}
```

**Block only when the route cannot render without the data** - a detail page that must 404
on a missing record, or a permission check. Then `return` the promise so the router awaits
it, and let the route's `pendingComponent` cover the wait:

```tsx
loader: ({ context: { queryClient }, params }) =>
  queryClient.ensureQueryData(facilityDetailOptions(params.facilityId)),
```

Three rules that follow from this:

- `prefetchQuery` is the fire-and-forget call, not `ensureQueryData`. It swallows errors
  internally, so an unawaited rejection cannot become an unhandled promise rejection.
- Never `await` a `prefetchQuery` - that blocks navigation and gives up the whole benefit.
- `useSuspenseQuery` throws on error instead of returning an error state, so a suspended
  subtree needs a `CatchBoundary` above it. Without one the error escapes to the route's
  `errorComponent` and replaces the entire page.

### Feature-based modules

Each feature is self-contained under `src/features/<name>/`:
- `api/api.ts` - HTTP calls using the shared Axios client (`src/integrations/axios.ts`)
- `api/queries.ts` - TanStack Query options (queryFn + queryKey)
- `components/` - Presentational components
- `lib/types.ts` - Feature-specific types

Shared code lives in `src/lib/` (utils, types, constants, config, key-factory).

**A feature never imports another feature**, with one exception below. When two
features need the same thing, it moves to a shared folder, or the route composes them and
passes data down as props. `src/routes/` may import any feature, since composing them is
its job.

**`src/features/reference-data/` is the exception: every feature may import it.** It holds
the OpenLMIS reference data many screens look up (facilities, and soon programs,
supervisory nodes and roles), named after the backend's `referencedata` service. It has the
usual `api/` and `lib/` layout and imports no other feature itself, so the exception never
turns into a cycle. Keep it to lookups; a screen that manages reference data, such as a
facilities list, is a feature of its own.

### Internationalization (i18next)

Translations are **static assets** in `public/locales/<lang>.json`, fetched at runtime by
`i18next-http-backend` rather than bundled. A deployment can correct a string or drop in a
language without rebuilding the app. `src/index.tsx` awaits `initI18n()` before the first
render so nothing ever paints raw keys.

They are **flat key-value pairs** - always flat, never nested (e.g. `"users.title": "Users"`, not `{ users: { title: "Users" } }`). `keySeparator` and `nsSeparator` are both `false` in the i18next config to enforce this. ICU MessageFormat is enabled for plurals/selects. Supported languages are defined in `src/lib/config.ts`. Type safety via module augmentation in `src/types/i18next.d.ts`, which type-imports `public/locales/en.json` - `t()` autocompletes keys and `tsc` catches typos. Keys must be sorted alphabetically (`pnpm sort-messages`), enforced by pre-commit hook.

Adding a language takes two steps: the catalog in `public/locales/`, **and** an entry in
`SUPPORTED_LANGUAGES` with its `dir`. A file on its own is never picked up.

When `en.json` changes, use the `sync-translations` skill to propagate changes to other language files (removes stale keys, translates missing ones, preserves existing translations).

Zod validation messages hold **translation keys**, not translated strings (see
`src/features/auth/lib/types.ts`), and the key is resolved with `t()` at render. A form
keeps whatever a field last validated to, so a message translated at validation time would
stay in the old language after a language switch.

### Right-to-left support (RTL)

**Arabic ships as a supported language, so every screen renders in both directions. Write
direction-agnostic markup by default - there is no "fix RTL later" pass.**

`components.json` has `"rtl": true`, so `shadcn add` emits logical classes. Existing
components were converted with `pnpm shadcn migrate rtl`.

Direction is derived from the language, never chosen separately.
`SUPPORTED_LANGUAGES` in `src/lib/config.ts` declares a `dir` per language and
`getTextDirection()` resolves it (region subtags fall through, so `ar-EG` is `rtl`).
`TextDirectionProvider` (`src/components/text-direction.tsx`) wraps the app in
`src/index.tsx`: it sets `<html lang>`/`<html dir>` in a layout effect so the first frame is
never painted LTR, and feeds the same value to Base UI's `DirectionProvider` so portalled
popovers, menus and tooltips flip too.

#### Rules for writing components

**Never use a physical direction utility.** Use the logical equivalent:

| Instead of | Use |
|---|---|
| `ml-*` / `mr-*` | `ms-*` / `me-*` |
| `pl-*` / `pr-*` | `ps-*` / `pe-*` |
| `left-*` / `right-*` | `start-*` / `end-*` |
| `border-l` / `border-r` | `border-s` / `border-e` |
| `rounded-l-*` / `rounded-r-*` | `rounded-s-*` / `rounded-e-*` |
| `text-left` / `text-right` | `text-start` / `text-end` |
| `space-x-*` | `gap-*` on a flex/grid parent |
| `slide-in-from-left/right` | `slide-in-from-start/end` |

**Flip directional icons with `rtl:rotate-180`.** Anything that points along the reading
axis: `ChevronLeft`/`ChevronRight`, `ArrowLeft`/`ArrowRight`, `LogOutIcon`, `PanelLeftIcon`.
Do **not** flip icons whose meaning is not reading-order: `RotateCcwIcon` (undo),
`SearchIcon`, `TrendingUpIcon` and other chart marks.

**`side` props come in two flavours.** Base UI's floating components (`TooltipContent`,
`DropdownMenuContent`, popovers) take logical sides - use `"inline-start"`/`"inline-end"`
so they follow `DirectionProvider`, not `"left"`/`"right"`.

Classes keyed off a physical `data-[side=left]`/`data-[side=right]` value (the slide-in
animations in `select.tsx` and `dropdown-menu.tsx`) stay physical too, since the value they
match is physical.

`Sidebar` and `Sheet` are the exception: their `side` is physical, so every rule keyed off
`data-[side=...]` has to stay physical too. A `side="right"` sidebar borders on its left in
either direction. `AppSidebar` picks the side from `useDirection()` instead. If a future
`shadcn migrate rtl` logicalizes `group-data-[side=left]:border-r`, the offcanvas rail
offsets, or the sheet's `data-[side=right]:border-l` and enter/exit translates, revert that
hunk - the migration gets these wrong and the border lands on the viewport edge.

#### Checking a change

`pnpm dev`, switch the language to العربية, and walk the screen you touched. Look for
padding or borders on the wrong edge, arrows pointing the wrong way, and popovers or
tooltips sliding in from the wrong side.

### Deployment and the base path

The app is deployed beside the legacy AngularJS UI under a URL prefix (`/v2`),
routed by Consul KV rather than any nginx config. See
[docs/deployment/deployment.md](docs/deployment/deployment.md) for the full picture.

Two rules follow from the prefix:

**Never hardcode an absolute path to a `public/` asset.** Vite rewrites
`index.html` but not string literals in TS/TSX, so `src="/olmis.png"` ships
unchanged and 404s under a prefix. Use `` `${import.meta.env.BASE_URL}olmis.png` ``.
`BASE_URL` always ends in a slash.

**`VITE_BASE_PATH` is a build input, not runtime config**, because it is compiled
into asset URLs. It feeds Vite's `base`, and everything else derives from
`import.meta.env.BASE_URL`: the router's `basepath`, i18next's `loadPath`, assets.
Anything new that builds a URL should read `BASE_URL` too, never assume `/`.

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
   `SidebarFooter padding`, `SidebarMenuSub end`, `SelectTrigger width`,
   `Table density`/`layout`, `TableHeader surface`, `Badge success/warning`, `Alert warning`,
   `DialogContent size`/`layout`, `DialogHeader spacing`, `DialogTitle size`,
   `DialogDescription size`, `Field spacing`, `FieldDescription size`,
   `ComboboxInput width`/`clearLabel`, `ChartContainer height`, `Progress tone`.
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

shadcn/ui components are generated in `src/components/ui/` and excluded from Biome linting. Use `pnpm dlx shadcn@latest add <component>` to add new ones; with `"rtl": true` in `components.json` the CLI emits logical classes already, so check the generated file only for the exceptions listed under RTL. The `cn` helper comes from the `cn` package and is re-exported from `src/lib/utils.ts`.

### pnpm settings

pnpm is pinned via `packageManager` in `package.json`. Settings that used to live under the `pnpm` key in `package.json` (such as `allowBuilds`, formerly `onlyBuiltDependencies`) belong in `pnpm-workspace.yaml`, which pnpm 12 reads instead. pnpm 12 errors on unrecognized keys there rather than ignoring them.

## Code Conventions

- **pnpm** - always use pnpm, not npm
- **kebab-case filenames** - enforced by Biome (e.g., `user-card.tsx`). Route files are the exception: TanStack Router's `$param` and `users_` (no nesting) syntax
- **`type` over `interface`** - enforced by Biome
- **`@/*` path aliases** - always use for imports (maps to `src/*`)
- **Logical CSS properties only** - `ms`/`me`/`ps`/`pe`/`start`/`end`/`text-start`, never
  `ml`/`mr`/`pl`/`pr`/`left`/`right`/`text-left`. The app renders RTL in Arabic.
- **Tests colocated** with source files (e.g., `use-mobile.test.ts` next to `use-mobile.ts`)
- **Biome formatting**: 2-space indent, single quotes, trailing commas, 100 char line width
- **No Co-Authored-By lines** in commits or PRs
- **No em dashes** anywhere in the project - not in code, comments, UI copy, translations, docs, commits, or PRs. Use a plain hyphen or rephrase.
- **Docs are for humans** - `docs/` is written for people using, supporting or
  deploying the system, not for agents. Plain language, concise, easy to follow.
  Guidance for whoever writes code belongs here in AGENTS.md instead.
- **Docs are markdown** - write `.md` under `docs/`, one directory per topic
  (`docs/dual-boot/dual-boot.md`), and add a row to `docs/README.md`. Never generate a
  PDF as the source of a document.
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
      <WorkspaceIcon>
        <ClipboardListIcon />
      </WorkspaceIcon>
      <WorkspaceTitle>{t('requisitions.title')}</WorkspaceTitle>
      <WorkspaceDescription>{t('requisitions.description')}</WorkspaceDescription>
    </WorkspaceHeading>
    <WorkspaceActions>
      <Button size="lg">{t('requisitions.create')}</Button>
    </WorkspaceActions>
  </WorkspaceHeader>
  <WorkspaceContent>{/* page body */}</WorkspaceContent>
</Workspace>
```

Every part takes only `children` - no boolean props, no `renderX` callbacks. A page
without an icon, a description or actions just leaves those parts out.

Buttons in `WorkspaceActions` are the page's calls to action and use `size="lg"`, so they
outrank the toolbar controls below them.

`Workspace` renders the breadcrumbs itself, derived from `NAV_GROUPS` by `getNavTrail()`,
so a page gets Home / Section / Page for free once its nav entry points at its route.
They are hidden on Home and on pages outside the nav. None of them accept a
`className`, which is what keeps padding and heading scale identical across pages; if a
page needs a different treatment, add a variant to the component rather than overriding
at the call site.

## List pages

Server-paged lists follow the Users page (`src/routes/(protected)/_protected.administration.users.tsx`).
Copy its shape rather than inventing a new one.

**The URL owns the state.** Page, size, sort and every filter are search params, validated
by a zod schema built from `tableSearchSchema()` and `textFilterSchema` in
`src/lib/table-search.ts`. Invalid params fall back to their default and defaults stay
out of the URL, so links are short and shareable. The loader prefetches from
`loaderDeps`, deferred as usual.

**The server does the work.** `useTable` runs with `manualPagination` and `manualSorting`
and gets `rowCount` from the response. `useTableSearchState()` wires its pagination and
sorting to the URL. Every change is computed from the latest search, not the rendered
one, so quick repeated clicks never build on a stale page. A new sort, filter or page
size returns to page 1.

**Only the rows suspend.** The toolbar sits outside the `QueryBoundary`
(`src/components/query-boundary.tsx`), so the search box never unmounts mid-typing. The
table reads the query through `useDeferredValue(search)`: the first load shows
`DataTableSkeleton`, and later pages keep the current rows on screen, dimmed, until the
next ones arrive. Filter typing uses `replace` on navigation; paging and sorting add
history entries so Back steps through them.

**Lay out by the room the page has, not the window.** The sidebar takes up to 16rem, so
the same window can leave very different room for the table. Everything responsive on a
list page therefore follows the content width, never viewport breakpoints like `md:`:

- Column defaults: the page lists its columns with a `hideBelow` container size for the
  lower-priority ones (see `USER_HIDEABLE_COLUMNS`), measures its content with
  `useElementWidth()`, and `useColumnVisibility()` combines that with the user's View menu
  choices, stored with `useStoredState`. A choice wins over the default; Reset Columns
  clears the choices. One visibility state drives the table, its skeleton and the View
  menu, so the menu always shows what is on screen.
- Column widths and the toolbar use container queries on `Workspace`'s
  `@container/main`, e.g. `meta: { className: '@xl/main:w-2/5' }` and `@2xl/main:w-72`.
- The pagination follows the table card's own `@container/table`.

Keep the identifying column and actions always on by leaving them out of the View menu;
everything else, status included, can drop on a narrow page and come back from it. Row actions live in a "..." menu
at the end of the row at every width, so the actions column stays narrow.
`meta.className` sets column widths with Tailwind width classes, which keeps them steady from
page to page.

**The create action ends the toolbar**, after the View menu, rather than sitting in the
page header, so everything that acts on the list is in one row.

**Every list has four states:** rows, loading skeleton, empty, and error with retry. Use
two different empty states: no records at all, and no matches for the filters with a
Clear Filters action.

### The data-table components

`src/components/data-table/` is written to move into the SolDevelo shadcn registry
unchanged, so it follows the registry's rules rather than this app's:

- It imports only stock shadcn primitives from `@/components/ui/`, `@/lib/utils`,
  `@tanstack/react-table`, `lucide-react`, and its sibling files, and nothing from
  `src/hooks`, other `src/lib` modules, `src/features` or i18next. It avoids app variants
  such as `Button tone`; the exceptions are `SelectTrigger width`, `Table density` and
  `layout`, `TableHeader surface`, `DropdownMenuContent width`, `Button width`
  and `Skeleton fill`, which become plain `className`s in the registry, where layout
  classes are allowed.
- Text comes from `DataTableLabelsProvider`, which defaults to English.
  `TranslatedDataTableLabels` in the app shell feeds it the `data-table.*` keys.
- Table state and the URL are app glue and stay in `src/lib/table-search.ts`.

`@tanstack/react-table` is v9. Build tables with `useTable` and `dataTableFeatures`,
not the v8 `useReactTable`. The installed package ships version-matched guides under
`node_modules/@tanstack/react-table/skills/`.

## Forms and dialogs

**A dialog for a short form, a page for a task.** Add and edit screens of a handful of
fields with one save open in a dialog over the list. Anything with its own structure,
such as tabs, tables of child records or several steps, gets a page. Users is the
example: Add/Edit User is a dialog, Edit User Roles is a page.

**The URL owns the open dialog**, like the rest of the list state: `?user=new` or
`?user=<id>`. Opening adds a history entry so Back closes it; closing replaces it.

Build a form dialog from `src/components/form-dialog/` (`FormDialog`, `FormDialogForm`,
`FormDialogHeader`, `FormDialogTitle`, `FormDialogDescription`, `FormDialogBody`,
`FormDialogFooter`, `FormDialogCancel`, `FormDialogSubmit`) and the fields from `useAppForm` in `src/components/form/form.tsx`
(`TextField`, `SwitchField`, `ComboboxField`). A yes/no setting is a `SwitchField`,
a switch in a bordered card, not a checkbox. Validate with a zod schema on `onDynamic` with
`revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' })`, so errors wait for
the first submit and then follow each correction.

Both folders follow the data-table's registry rules: stock shadcn primitives,
`@tanstack/react-form`, `lucide-react` and their sibling files only, and no i18next. The
exceptions are `DialogContent size`/`layout`, `DialogHeader spacing`, `DialogTitle size`,
`DialogDescription size`, `Field spacing`, `FieldDescription size` and
`ComboboxInput width`/`clearLabel`.
Validation messages are translation keys; `TranslatedFormMessages` in the app shell
resolves them through `FormMessagesProvider`.

## Rights and dashboards

**A screen shows only what the user's rights allow.** `rightsOptions(userId)` in
`src/features/auth/api/queries.ts` loads the user's permission strings once per session
as a set of right names, and `RIGHTS` names the ones this app checks. A route that
depends on them awaits `ensureQueryData(rightsOptions(...))` in its loader, since that is
a permission check, then prefetches only the parts the user may see and passes plain
flags down. Features stay free of auth imports; the Home route is the example.

**Charts use Recharts through shadcn's `ChartContainer`** and the `--chart-1`..`--chart-5`
ramp: one blue hue, light to dark, checked for even steps and contrast in both modes, used
in order for anything with an order (pipeline stages). Status meaning (good to critical)
uses `success`, `warning` and `destructive` with an icon and a label, never colour alone.

## Authentication

`/login` exchanges credentials for a token at `POST /api/oauth/token?grant_type=password`.
The auth service authenticates the *client* over HTTP Basic first, so the request also
carries `Basic base64(VITE_AUTH_SERVER_CLIENT_ID:VITE_AUTH_SERVER_CLIENT_SECRET)`.

The token lives in a persisted zustand store (`src/features/auth/store/login-data.ts`),
which is read outside React by the axios request interceptor (attaches the bearer token)
and by the router guards (`_protected.tsx` redirects anonymous users to `/login`; `/login`
redirects authenticated ones to `/home`). A `401` clears the store and returns to
`/login`.

Nothing talks to the API directly in development - the Vite dev server proxies `/api` to
`VITE_API_PROXY_TARGET`, keeping the browser same-origin.

Both UIs share an origin, so `syncLegacySession()` keeps the two sessions in step. The
legacy keys carry an `openlmis.` prefix: `openlmis.ACCESS_TOKEN`, `openlmis.USER_ID`,
`openlmis.USERNAME`. It runs on boot and on the `storage` event, so signing in or out of
the legacy UI reaches a `/v2` tab that is already open.

The store records a `sessionSource` (`own` or `legacy`). Only a `legacy`-sourced session
follows the legacy UI out, so a user who signed into the new UI directly is unaffected by
what the old one does. Our own logout calls `clearLegacySession()`, since the token is
shared and killing it server-side while leaving the keys behind would only render a dead
session. Preferences such as `openlmis.current_locale` are left alone.

Login deliberately carries one way: signing in here does not sign the user into the legacy
UI, and we write no `openlmis.*` keys. Legacy keeps working normally, it just asks for a
login once. Do not "fix" this by publishing our token, which leaves legacy unable to enter
any rights-guarded route. [docs/deployment/deployment.md](docs/deployment/deployment.md) records the evidence and
what a real single sign-on would cost.

Anything touching auth state should go through the store rather than reading localStorage
directly, or these two views of the session drift apart again.

Cached query data belongs to whoever fetched it: `src/integrations/tanstack-query.ts`
clears the whole cache whenever the store's user changes, on sign-out, on sign-in as
someone else, and when the session follows the legacy UI. Query keys therefore need no
user id, except for per-user data such as rights.

## Environment Variables

`.env.example` is the source of truth and README.md has the annotated table. Two that
affect how code is written:

- `VITE_API_BASE_URL` stays root-absolute (`/api`). The API is shared with the legacy UI
  and is not behind the base path.
- `VITE_BASE_PATH` is a build input, not runtime config. See the base path rules above.

Anything that varies per environment cannot go through `import.meta.env`, because Vite
resolves it at build time and one image serves every environment. Add it to
`src/lib/runtime-config.ts`, which reads `config.json` written by the container at start
and falls back to `import.meta.env` for `pnpm dev`. The OAuth client works this way.

## Skills

Skills live in `.agents/` and `.claude/`; external ones are pinned in `skills-lock.json`.

| Skill | Source | Use for |
|---|---|---|
| `sync-translations` | local | Syncing `public/locales/*` with `en.json` after changing keys |
| `plan-implementation` | local | Researching a Jira ticket against legacy and writing `plans/<KEY>.md` before any code |
| `review-pr` | local | Reviewing a PR diff in parallel (correctness, simplify, conventions, React/shadcn, legacy UI parity), then getting it ready to merge |
| `shadcn` | `shadcn/ui` | Adding, debugging, styling and composing shadcn components |
| `frontend-design` | `anthropics/skills` | Building new UI with real design quality |
| `vercel-composition-patterns` | `vercel-labs/agent-skills` | Compound components, render props, provider design |
| `vercel-react-best-practices` | `vercel-labs/agent-skills` | React performance review and refactors |
| `skill-creator` | `anthropics/skills` | Authoring or improving a skill |

## Planned offline work

The [two-page offline plan](docs/offline-plan/offline-plan.pdf) describes planned behavior.
Build a tested online draft workflow first, then add durable local saving and synchronization.
Update the Query/loader and auth guidance alongside the implementation. Offline reads must
finish with data, an unavailable result or a handled error; local absence is not a server 404.
