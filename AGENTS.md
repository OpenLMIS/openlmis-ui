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
no live page, out of the sidebar and the palette until they point at a real route. Both then
show only the pages the user's rights reach, through `useNavGroups()` in
`src/components/nav-access.ts`.

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
        <QueryBoundary
          errorComponent={FacilitiesError}
          pendingFallback={<FacilitiesTableSkeleton />}
          resetKey="facilities"
        >
          <FacilitiesTable />
        </QueryBoundary>
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
  subtree needs a `QueryBoundary` (`src/components/query-boundary.tsx`) above it, which is
  `Suspense` plus a `CatchBoundary` that also resets the query. Without one the error escapes
  to the route's `errorComponent` and replaces the entire page.

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
the OpenLMIS reference data many screens look up (facilities, facility types, programs,
supervisory nodes and roles), named after the backend's `referencedata` service, plus
stock management's organizations, which Valid Destinations and Valid Sources both pick from. It has the
usual `api/` and `lib/` layout and imports no other feature itself, so the exception never
turns into a cycle. Keep it to lookups; a screen that manages reference data, such as a
facilities list, is a feature of its own. When that screen's list is the lookup's own
endpoint, as for Roles, it reads the lookup query and widens its type rather than fetching
the same list twice.

### Internationalization (i18next)

Translations are **static assets** in `public/locales/<lang>.json`, fetched at runtime by
`i18next-http-backend` rather than bundled. A deployment can correct a string or drop in a
language without rebuilding the app. `src/index.tsx` awaits `initI18n()` before the first
render so nothing ever paints raw keys.

They are **flat key-value pairs** - always flat, never nested (e.g. `"users.title": "Users"`, not `{ users: { title: "Users" } }`). `keySeparator` and `nsSeparator` are both `false` in the i18next config to enforce this. ICU MessageFormat is enabled for plurals/selects. Supported languages are defined in `src/lib/config.ts`. Type safety via module augmentation in `src/types/i18next.d.ts`, which type-imports `public/locales/en.json` - `t()` autocompletes keys and `tsc` catches typos. Keys must be sorted alphabetically (`pnpm sort-messages`), enforced by pre-commit hook.

Adding a language takes three steps: the catalog in `public/locales/`, an entry in
`SUPPORTED_LANGUAGES` with its `dir`, **and** its calendar language in `DATE_LOCALES`
(`src/lib/date-locale.ts`), which `tsc` checks. A file on its own is never picked up.

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
   examples: `Button padding/width/align` (incl. `width="shrink"`) + the `xl` size, `CardHeader spacing/align`,
   `CardTitle size`, `CardFooter align`, `Separator spacing`, `Skeleton shape/fill`,
   `Spinner tone/size`, `Empty height`, `EmptyMedia size`, `EmptyTitle size`,
   `EmptyDescription size`, `DropdownMenuContent width`, `DropdownMenuLabel gap/layout`,
   `PopoverContent width/padding`,
   `SidebarHeader bordered/layout`,
   `SidebarFooter padding`, `SidebarMenuSub end`, `SelectTrigger width`,
   `Table density`/`layout`, `TableHeader surface`, `Badge success/warning/info`, `Alert warning/success/info`, `RadioGroup columns` (`tiles`, `row`),
   `DialogContent size`/`layout`, `DialogHeader spacing`, `DialogTitle size`,
   `Field spacing`, `FieldLabel weight`,
   `ComboboxInput width`/`clearLabel`, `ComboboxChip removeLabel`, `ChartContainer height`, `Progress tone`, `Tabs spacing`, `TabsList wrap` (`true`, `column` for an odd number of tabs, or `md` for short labels).
2. Put the layout classes on a plain wrapper element around the component. This is the
   right call for one-off positioning (`<div className="w-full max-w-sm"><Card>...`) and
   for `Skeleton`, whose size always belongs to the surrounding layout.

`src/components/ui/` is ignored by the linter - those files define the variants the
rules enforce. This is the one place where editing generated shadcn files is expected.

**Switching presets or re-running `shadcn add` overwrites these files and silently drops
every variant listed above.** `pnpm tsc --noEmit` is what catches it: the call sites keep
passing props the regenerated component no longer accepts. Re-apply the variants to the
new files rather than reverting the preset. Seven edits carry no prop, so `tsc` cannot catch
them: `checkbox.tsx` shows a minus in the checked colours while `indeterminate`, for a header
that selects part of a page; `calendar.tsx`'s `CalendarDayButton` passes its `ref` to the `Button`, so keyboard focus
follows the highlighted day; `select.tsx` defaults `alignItemWithTrigger` to `false`, so a list opens below its input;
`button.tsx` dims `data-disabled` as well as `:disabled`, so a `focusableWhenDisabled` button
looks disabled; `sonner.tsx`'s `Toaster` reads
`useResolvedAppearance()` from `src/lib/appearance.ts`, not next-themes, which is not installed;
`chart.tsx` lays the chart's SVG out left to right, so axis labels grow into their gutter in
Arabic, and formats tooltip numbers in the page's language; and `avatar.tsx`'s `AvatarGroup`
overlaps with a logical `-ms-2` instead of `-space-x-2`.

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
- **Tests first, never after** - write the failing unit test, then the code that makes it
  pass. A bug fix starts with a test that reproduces the bug. Test our logic, not shadcn or
  Base UI behaviour
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
without an icon, a description or actions just leaves those parts out. The one variant is
`width="narrow"` on `Workspace` and `WorkspaceFooter`, for a page of settings like Profile.

Buttons in `WorkspaceActions` are the page's calls to action and use `size="lg"`, so they
outrank the toolbar controls below them. When the header stacks on a narrow page, they share
its full width; each button is a direct child, so a loading skeleton renders one block per
button to stretch the same way.

A page that edits a draft and saves it at once, like Edit User Roles, renders
`WorkspaceFooter` right after `Workspace`, as its sibling: a muted bar across the content area
that sticks to the bottom of the window, with Cancel at the start and Save at the end, both
`size="lg"` and lined up with the page. Save and Cancel return to the list the page was
opened from, with its page, sort and filters, which the opening link passes in history
state. A settings page opened from no list, like Profile, keeps the user there: Cancel puts
the saved values back and Save stays. Pages that share a header across tabs, like Profile,
render it once in the layout route through `WorkspaceTabs` inside `WorkspaceSlots`, and put
the footer in with `WorkspaceFooterPortal` (`src/components/workspace-tabs.tsx`), `narrow` by
default and `width="default"` under a full-width page such as product edit, so a tab switch
never remounts the header. A tab's own header button, such as Reset To Defaults on System
Settings, goes into the shared header's `WorkspaceActionsSlot` through `WorkspaceActionsPortal`. Toasts appear at the top end corner, just below the header, tinted by their kind.

`Workspace` renders the breadcrumbs itself, derived from `NAV_GROUPS` by `getNavTrail()`,
so a page gets Home / Section / Page for free once its nav entry points at its route.
A page below a nav entry, such as a user's roles below Users, gets that entry's trail with
its own last crumb from the route's `staticData.crumbKey`; the parents link back.
A page outside the nav with a `crumbKey`, such as Profile, gets Home / its crumb. The account
menu, not the sidebar, opens Profile and Settings (`/settings`). `useAccountLinks()` in
`src/components/nav-access.ts` lists them, each behind its right, for the account menu and the
command palette alike.
They are hidden on Home and on pages outside the nav without one. None of them accept a
`className`, which is what keeps padding and heading scale identical across pages; if a
page needs a different treatment, add a variant to the component rather than overriding
at the call site.

Signed-out pages (Sign In, Forgot Password, Reset Password) sit outside the app shell and
compose `src/components/auth-card.tsx` instead: `AuthPage` with the page's title, then
`AuthHeader` holding an `AuthTitle` (the page's heading) and a `CardDescription`, then
`CardContent` holding an `AuthForm` with its fields, an `AuthSubmit` and any `AuthLink`. A card
that replaces the form the user was in, such as a confirmation, passes `focus` to its
`AuthTitle`, so keyboard and screen-reader users land on it.

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

**When the endpoint cannot page or sort**, as `GET /roles`, the list loads every record once
and filters, sorts and pages it in the browser behind the same URL state, clamping a page past
the end; with no request per page, nothing suspends after the first load. Roles is the example.
It moves to server paging once the API can page, as Programs did with `POST /programs/search`.

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

**Rows the user acts on together are selected with a checkbox column**, `selectionColumn()`
from `src/components/data-table/data-table-selection.tsx`: the header picks the page, and a
selection is kept across pages by id, with each row's name, so a confirm can count and name
rows not on screen. A filter change clears it and closes an open confirm, and rows still
showing from the last filter can neither change it nor open a delete (`useFilterScoped`), so
an action never reaches rows the user cannot see. Each row's box is named
for everything that tells it apart, not only its name. While anything is selected,
`DataTableSelectionBar` after the table shows the count, Clear and the actions. It is not in the
URL. Valid Destinations is the example: its bulk delete awaits every request, reports the ones
that failed and then moves focus to the list, since the bar and the rows it came from are gone.

A filter on a short fixed list, such as status, is a `DataTableSelectFilter`; on a long one,
such as Facilities' 200-odd geographic zones, a `DataTableComboboxFilter` the user types into,
with an option's `description` muted after its label.

### The data-table components

`src/components/data-table/` is written to move into the SolDevelo shadcn registry
unchanged, so it follows the registry's rules rather than this app's:

- It imports only stock shadcn primitives from `@/components/ui/`, `@/lib/utils`,
  `@tanstack/react-table`, `lucide-react`, and its sibling files, and nothing from
  `src/hooks`, other `src/lib` modules, `src/features` or i18next. It avoids app variants
  such as `Button tone`; the exceptions are `SelectTrigger width`, `Table density` and
  `layout`, `TableHeader surface`, `DropdownMenuContent width`, `Button width`,
  `ComboboxInput width`/`clearLabel` and `Skeleton fill`, which become plain `className`s in the registry, where layout
  classes are allowed. `selectionColumn` also needs the app's `checkbox.tsx` edit to draw a
  partly selected page as a minus; it ships with that edit.
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
example: Add/Edit User is a dialog, Edit User Roles is a page. A record whose add already has
child records, as a facility's programs, adds on a page too, with one save for the record and
its children: Add Facility (`src/features/facilities/components/facility-editor.tsx`) keeps
one draft above its tabs, the tab in `?tab=`, and opens the tab with the first error on save.
Each field that picks from a lookup loads behind its own `QueryBoundary`, so the page never
waits for one, and the footer's save button submits the fields' `<form>` through its `form`
attribute, so Enter saves. Edit Facility is the same editor given the stored record as
`saved`, read fresh in its loader, since its save sends the whole record back.

**Save sends the form at once**, with no "Do you want to save?" step, even where legacy
asks one: the dialog's Create or Save is already the deliberate act. A confirm stays only
where a save reaches other records, as Roles asks before changing a role users hold.

**The URL owns the open dialog**, like the rest of the list state: `?user=new` or
`?user=<id>`. Opening adds a history entry so Back closes it; closing steps back over it,
or replaces it when the page was opened with the dialog from a link. A page gets this, and
its search updater, from `useSearchNavigation<PageSearch>(CLOSED_DIALOGS)` in
`src/hooks/use-search-navigation.ts` rather than writing its own.

A dialog whose save sends the whole record back reads that record fresh each time it opens, or
a cached copy could undo another admin's change: its detail query key carries a number the
dialog takes once per opening, so every opening fetches, and the loader does not prefetch it.
Programs and Facility Types are the examples, taking that number from `useOpening()`
(`src/hooks/use-opening.ts`); Roles and Users still use one cached detail.
A record that is gone shows `DialogNotFound`, any other load failure `DialogLoadError`, both
from `src/components/dialog-parts.tsx`, and a switch's skeleton is `SwitchSkeleton`.

A page whose tabs save the record whole, like product edit, reads it fresh on every opening: its
loader uses `fetchQuery` with `staleTime: 0` on `cause: 'enter'` and the cached copy on `stay`, as a
tab switch is, and the route sets `preload: false`, since a preloaded match opens at once on the
cache while the fresh read runs behind. Each save then reads the record again and applies only its
own change to it (`saveProductChange`), so a tab left open never sends back an old copy.

Build a form dialog from `src/components/form-dialog/` (`FormDialog`, `FormDialogForm`,
`FormDialogHeader`, `FormDialogTitle`, `FormDialogDescription`, `FormDialogBody`,
`FormDialogFooter`, `FormDialogCancel`, `FormDialogSubmit`) and the fields from `useAppForm` in `src/components/form/form.tsx`
(`TextField`, `NumberField`, `DecimalField`, `TextareaField`, `PasswordField`, `SwitchField`,
`RadioGroupField`, `ComboboxField`, `MultiComboboxField`, `SelectField`, `ImageField`, `DateField`). Two
forms that share their fields, such as Add Product and the product's General tab, define them once
with `withForm`, from the same `form.tsx`. A whole number is a
`NumberField`, which keeps the text as typed, and its schema is `wholeNumberText` from
`src/lib/whole-number.ts`, which also takes Arabic and Persian digits; read the value with
`toWholeNumber`. It fits a Java `int` by default; a `long` on the server passes
`max: Number.MAX_SAFE_INTEGER`, a lower bound passes `min` with its own message, and an optional whole
number passes `optional` and reads with `toOptionalWholeNumber`. A number with decimals, such as a price, is a
`DecimalField` with `decimalText` from `src/lib/decimal.ts`, read with `toDecimal` and shown with
`toNumberText(value, decimalMark(language))`; it takes a dot or the language's comma, and refuses a comma
before exactly three digits as a possible thousands separator, so `toNumberText` shows such a value
with a dot; `maxDecimals` caps
the decimals. A yes/no setting is a `SwitchField`,
one compact row with the label and an info button for its description at the start and the
switch at the end, not a checkbox; picking several of a list is a
`MultiComboboxField` with chips, not a column of checkboxes, and a list too long to load, such as
products, passes `onSearch` and the server's matches as `items`, and keeps the search and the list
open after each pick; one of a short fixed list is a
`SelectField`; an uploaded image, such as a logo, is an `ImageField` row, holding `undefined` to keep the
saved one, `null` to remove it or the picked `File`; it validates on `onChange`, so a refused
file is flagged as soon as it is picked. A date is a `DateField`: a calendar in the page's
language, holding `yyyy-MM-dd` or an empty string, with a `clearLabel` when it is optional. The
calendar and its language (`loadDateLocale` from `FormMessagesProvider`) are fetched once a date
field mounts and again when it is opened after a failed load, so no other page carries the date
libraries; a required date reads out the provider's `requiredLabel` with its name. A `ComboboxField` item takes a `description`, shown
muted after its label, such as a zone's level. Every field takes a `layout`: `stacked` by default; `row` for a settings
page, inside a `SettingsList` (`src/components/form/settings-list.tsx`) with the label at
the start and the value at the end, and `SettingsItem` for a value that is only shown;
`inline` in a table cell, where the column header names it and the label and description
are for screen readers only, so name each one after its row too. Validate with a zod schema on `onDynamic` with
`revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' })`, so errors wait for
the first submit and then follow each correction.

Both folders follow the data-table's registry rules: stock shadcn primitives,
`@tanstack/react-form`, `lucide-react` and their sibling files only, and no i18next. The
exceptions are `DialogContent size`/`layout`, `DialogHeader spacing`, `DialogTitle size`,
`Field spacing`, `FieldLabel weight`,
`ComboboxInput width`/`clearLabel`, `ComboboxChip removeLabel`, `RadioGroup columns`,
`SelectTrigger width`, `Button align/width` and `PopoverContent width/padding`. In a row,
`SwitchField` and `SelectField` take an `action` in the label's row, such as a flag's info button
and Reset; `TextField` takes a `badge` there. Stacked, a `PasswordField` takes an `action` at the
end of its label's line, such as Forgot Password?, reached after the input with Tab, and two of
them that show and hide as one, a password and its confirmation, share `visible` and
`onVisibleChange`. A select's list
opens below its input, never over it: `alignItemWithTrigger` is `false`.
`RadioGroupField` takes `variant="tile"` for a grid of small options such as colours, and
`columns="row"` to put a few cards side by side once the page has room.
Validation messages are translation keys; `TranslatedFormMessages` in the app shell
resolves them through `FormMessagesProvider`.

**Every toast has a title and a description**: a short title in Title Case (`users.roles.saved-title`,
"Roles Saved") and a sentence of detail as `description`, which is cut at two lines. The
shared `Toaster` adds a translated close button, so a call never passes one.

## Rights and dashboards

**A screen shows only what the user's rights allow.** `rightsOptions(userId)` in
`src/features/auth/api/queries.ts` loads the user's permission strings once per session
as a set of right names, and `RIGHTS` names the ones this app checks. A route that
depends on them awaits `ensureQueryData(rightsOptions(...))` in its loader, since that is
a permission check, then prefetches only the parts the user may see and passes plain
flags down. Features stay free of auth imports; the Home route is the example. A save that
may change a user, such as Edit User or Edit User Roles, calls `invalidateUserQueries(queryClient,
userId)` from `src/lib/user-queries.ts`. The cache holds per-user data only for the signed-in
user, so it reloads your rights, Profile and Home only when the user is you.

**A page that needs one right checks it before it loads.** Its loader awaits
`requireRight(queryClient, RIGHTS.x)` from `src/features/auth/lib/access.ts`, alongside the
data it must have, and a missing right throws a `ForbiddenError`. The default error component
shows `NoAccessPage` for it, and for a `403` from the server; a route with its own
`errorComponent` renders `ErrorFallback` with its own `title` and `description`, which checks
`isForbidden(error)` first, and so does a `QueryBoundary` whose data the server may refuse,
showing `NoAccess`. Inside a feature, which has no auth imports, such a boundary checks
`isRefused(error)` from `src/lib/http.ts` and shows a short message in place, not the
full-page panel. Add the page to `NAV_RIGHTS` in
`src/components/nav-access.ts` too, so the sidebar, the palette and the breadcrumbs never offer
it. The Users routes are the example. A page legacy opens with either of two rights passes
both, as a list, to `requireRight` and to `NAV_RIGHTS`; any one opens it. An action inside the
page that needs one of them reads the set `requireRight` resolves with and hides itself, also
when its dialog is opened by its URL, as Add Product does on Products.

**Unsaved work asks before it is lost.** A page with a draft calls `useDiscardGuard` from
`src/hooks/use-discard-guard.ts`, which blocks router navigation to another page and, for
leaving the router cannot see, such as signing out, registers `useLeaveGuard`; the sign-out
calls `whenLeaveAllowed`, and so does anything else that signs the user out, such as a
password change, before it acts. Both open the shared "Discard Unsaved Changes?" dialog,
`src/components/discard-changes-dialog.tsx`, fed by the hook. A reload or a closed tab gets the
browser's own prompt, which is the only one a page is allowed there.

**Charts use Recharts through shadcn's `ChartContainer`** and the `--chart-1`..`--chart-5`
ramp: one hue from the active theme preset, light to dark, checked for even steps and contrast in both modes, used
in order for anything with an order (pipeline stages). Status meaning (good to critical)
uses `success`, `warning` and `destructive` with an icon and a label, never colour alone.

## App configuration

**Branding, theme and feature flags come from the server**, `GET /api/appConfiguration`,
loaded in `src/lib/app-configuration.ts` before the first render and cached in localStorage for
the next boot. A slow or missing server falls back to the cache, then to the built-in defaults.
`startApplyingAppConfiguration()` in `src/lib/apply-app-configuration.ts` keeps the page title,
favicon, preset tokens and light or dark class in step with the store.

**Never hardcode "OpenLMIS" in copy that names the deployment.** Messages take `{appName}`
and pass `useAppName()`, so a renamed deployment reads its own name everywhere. Text about the
platform itself, such as "Powered by OpenLMIS" or what a service account can call, keeps it.

**Light or dark goes through `src/lib/appearance.ts`**, which replaces next-themes. It keeps
the user's choice under the `theme` key; no choice follows the administrator's default
appearance. Read it with `useResolvedAppearance()`.

**A settings tab saves through `useConfigurationSave`**
(`src/features/system-settings/hooks/use-configuration-save.ts`). It keeps the version the draft
started from, so a refetch under unsaved changes turns the save into a conflict rather than a
silent overwrite, and it keeps whatever part of a several-step save the server already stored.

**A feature flag reads through `useFlag(key)`, or `getFlag(key)` outside React.** The
administrator's value wins, then the deployment's `config.json`, then the code default.
`getDeploymentFlags()` has no `import.meta.env` fallback, so `pnpm dev` sees only the defaults
and the admin values. Adding a flag takes:

1. An entry in `FEATURE_FLAGS` (`src/lib/feature-flags.ts`) with its type, default and
   message keys, and those keys in every locale.
2. A line in `docker/config.json.template`, its `export` and `envsubst` name in
   `docker/entrypoint.sh`, and the variable in `docker-compose.yml`.

## Authentication

`/login` exchanges credentials for a token at `POST /api/oauth/token?grant_type=password`.
The auth service authenticates the *client* over HTTP Basic first, so the request also
carries `Basic base64(VITE_AUTH_SERVER_CLIENT_ID:VITE_AUTH_SERVER_CLIENT_SECRET)`.

The token lives in a persisted zustand store (`src/features/auth/store/login-data.ts`),
which is read outside React by the axios request interceptor (attaches the bearer token)
and by the router guards (`_protected.tsx` redirects anonymous users to
`/login?redirect=<page>`; `/login` sends authenticated ones to that page, through
`safeRedirect()` in `src/lib/redirect.ts`, or to `/home`).

**A `401` never leaves the page.** The response interceptor in `src/integrations/axios.ts`
marks the session `expired` (the user and the refused token stay, so the legacy UI still
holding that token is never mistaken for a new one), and `SessionExpiredDialog`,
mounted at the root, asks the same user for their password. Every refused request, and
every new one while expired, waits in `waitForSession()` (`src/features/auth/lib/session.ts`)
and is sent once more with the new token, so pages finish loading and a pressed Save goes
through. Sign Out from the dialog, or another user signing in, fails the waiting requests
with a `SessionEndedError`, and so does a refusal of a request sent for a user who is no
longer the one signed in (`sentFor`), so nothing is ever resent as someone else. A `401` for a token that has since been replaced is resent, not
treated as a new expiry. Signing in and out pass `session: false`, so their own refusals
never open the dialog, and a request that brings its own `Authorization` (the login's Basic
header) keeps it. Forgot Password and Reset Password pass `anonymous: true`: no token at all,
since the auth service refuses any bearer on those endpoints, and no waiting for a session.
The session dialog stays off the signed-out pages `isSignInPage()` lists. Queries never retry a `401` or `403`.

Anything that signs the user out on purpose goes through `useOfflineSignOut()`
(`src/components/offline-sign-out.tsx`) before `whenLeaveAllowed`: offline, it asks first,
since signing in again needs the server. The dialog also counts a sign-in that could not
reach the server as offline, whatever the browser's online flag says.

The server slides a token's expiry with every call, so `expiresAt` (from `expires_in`) is
only the earliest it could end. Nothing signs a user out on it; the `401` decides. One
user's token is the same in both UIs, so our logout signs them out of the legacy UI too.

Nothing talks to the API directly in development - the Vite dev server proxies `/api` to
`VITE_API_PROXY_TARGET`, keeping the browser same-origin.

Both UIs share an origin, so `syncLegacySession()` keeps the two sessions in step. The
legacy keys carry an `openlmis.` prefix: `openlmis.ACCESS_TOKEN`, `openlmis.USER_ID`,
`openlmis.USERNAME`. It runs on boot and on the `storage` event, so signing in or out of
the legacy UI reaches a `/v2` tab that is already open. `syncOtherTab()` handles the same
event for our own store, so a sign-out or a sign-in again in one `/v2` tab reaches the
others. The legacy UI wipes the whole origin's localStorage on every `401`; a live session
of ours saves itself again rather than reading that as a sign-out.

The store records a `sessionSource` (`own` or `legacy`). Only a `legacy`-sourced session
follows the legacy UI, so a user who signed into the new UI directly is unaffected by
what the old one does. When legacy's session disappears, ours expires rather than clears:
legacy wipes its keys the same way on a sign-out and on a refused token, and expiring keeps
the page and its unsaved work behind the dialog. A change of user is followed at once. Our own logout calls `clearLegacySession()`, since the token is
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
| `ticket-review` | local | Checking a shipped Story, Task, Subtask or Bug against its acceptance criteria, then commenting and moving it to Done (never Epics) |
| `shadcn` | `shadcn/ui` | Adding, debugging, styling and composing shadcn components |
| `frontend-design` | `anthropics/skills` | Building new UI with real design quality |
| `vercel-composition-patterns` | `vercel-labs/agent-skills` | Compound components, render props, provider design |
| `vercel-react-best-practices` | `vercel-labs/agent-skills` | React performance review and refactors |
| `skill-creator` | `anthropics/skills` | Authoring or improving a skill |

## Offline

The [offline plan](docs/offline-plan/offline-plan.md) is the design and the order of work. The
foundation is in place; offline data and drafts come with the first stock screen.

**The service worker keeps the app's files, nothing else.** `vite-plugin-pwa` in
`vite.config.ts` precaches the build (`**/*.{js,css,html,png,svg,woff2}`) at scope `BASE_URL`
and, network first, `config.json` and `locales/*.json`, so a deployment can still correct a
string or the OAuth client without a rebuild. Never add a runtime route for `/api` or any
other data: offline data belongs in Dexie. Its caches are named `openlmis-ui-*`, since the
legacy UI's worker at `/` shares the origin. `clientsClaim` lets it control the first visit.

**`src/lib/service-worker.ts` owns the worker; nothing else registers it.**
`registerServiceWorker()` runs once from `src/index.tsx`, only in a production build. It:

- fetches `config.json` and every `SUPPORTED_LANGUAGES` catalog once our worker controls the
  page, so all of them work offline after one visit;
- checks for a new version every hour;
- tells every tab through `useUpdateReady()`.

`applyUpdate()` loads a new version in this tab only: it activates a waiting worker and reloads
once it takes control, or just reloads when another tab already activated it. Never use the
plugin's `virtual:pwa-register` hooks, which register on every mount and reload every tab.

`pnpm dev` never registers the worker. Check it with
`VITE_BASE_PATH=/v2 pnpm build && VITE_BASE_PATH=/v2 pnpm preview`, which proxies `/api` like
`pnpm dev`. Copy a `config.json` into `dist/` first, as the container writes one, or preview
answers it with `index.html`.

**Offline, a request fails at once.** The query client runs with `networkMode: 'always'`, and
`seedOnline()` tells it at boot whether the browser is online, since TanStack Query only hears
the `online`/`offline` events. `src/lib/online.ts` is the one source of that state:

- `useOnline()` and `isOnline()`;
- `useOnReconnect()`;
- `useBackOnline()`.

Never read `navigator.onLine` directly.

**A failure a connection would fix shows "Connect To Download This Data".** That means
`isOfflineError(error)`: the request got no answer at all. Views ask
`useOfflineFailure(error, retry)`, which also runs `retry` once the connection is back:

- `OfflineNotice` for a page, which `ErrorFallback` shows, so a blocking loader such as
  `requireRight` is covered too, and so is a route's own `errorComponent` that renders
  `ErrorFallback` with its `title` and `description`;
- `ListError` for a server-paged list's boundary, which also handles No Access;
- `LoadError` for a boundary inside a feature, which has no auth imports;
- `DialogLoadError` and the Home `WidgetError`, given the `error`.

A new error view with a Try Again uses `useOfflineFailure` the same way. `ErrorFallback`'s
retry calls `router.invalidate()` before `reset()`, since a failed loader is what put the page
there and a reset alone would not run it again. `reportCaughtError` (`src/lib/report-error.ts`),
passed to `createRoot`, leaves those offline failures out of the console and logs every other
caught error with its component stack.

**Status goes above the sidebar's footer buttons.** `SidebarNotices` shows:

- "You're Offline": warning, no close;
- "You're Back Online": success, 4 s;
- "Update Available": info, with Reload.

On the collapsed rail each is its icon with a tooltip, and only Reload is a button.
`OfflineDot` marks the header's menu button while the sidebar is closed. The visual notices are
notes, not live regions: `StatusAnnouncer` in the header is the one always-mounted
`role="status"`, so a screen reader hears each change even with the sidebar out of view.

Reload goes through `whenLeaveAllowed`, then `applyUpdate(allowUnload)`: `allowUnload()` runs
just before the reload, so the discard guard does not raise the browser's own prompt on top,
and stays off if the reload never comes.

**Local data goes in Dexie, one database per deployment and user.** `getLocalDb()` in
`src/integrations/local-db.ts` opens `openlmis-ui:<deployment>:<userId>` for the signed-in user
and closes it when the user changes or signs out; it never deletes. A screen declares its own
tables with a new `version()`. Offline reads must finish with data, an unavailable result or a
handled error; local absence is not a server 404. Tests get IndexedDB from `fake-indexeddb`,
and `src/tests/setup.ts` puts the app back online after every test.
