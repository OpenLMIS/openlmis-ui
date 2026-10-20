# AGENTS.md

Working reference for humans and agents writing OpenLMIS UI code. The React frontend runs
beside the legacy AngularJS UI under a URL prefix.

Keep each document focused on its audience:

- **AGENTS.md**: coding conventions, patterns and constraints.
- **README.md**: setup, environment variables, scripts and project layout.
- **[docs/](docs/README.md)**: guidance for users, support and deployment. Use plain language;
  include internals only when readers need them. Keep coding guidance here.
- **plans/**: one `plans/<KEY>.md` per Jira ticket, written with `plan-implementation` before
  code and committed with the PR. Include a team summary, mapped API calls and UI/UX decisions.
  Update the plan in the same PR whenever implementation departs from it.

## Commands

See [README.md](README.md#scripts) for all scripts. Use pnpm only.

```bash
pnpm dev              # Vite dev server
pnpm build            # Type-check + production build (tsc -b && vite build)
pnpm check            # Biome lint, format and organize imports
pnpm lint:ds          # shadcn/lint via Oxlint
pnpm test:run         # Vitest single run
pnpm vitest run src/hooks/use-mobile.test.ts   # Single file
pnpm sort-messages    # Sort translation keys
```

Lefthook runs staged Biome fixes, translation sorting and `tsc --noEmit` before commits;
Biome, design-system lint, typecheck and the full test suite before pushes.

Several agents often share one machine. While iterating, run only the test files your change
touches; leave the full suite to the pre-push hook unless asked. Keep the local `maxWorkers`
cap in `vite.config.ts`; CI uses Vitest's default workers across two test shards.

## Architecture

**Stack**: React 19, TypeScript 7, Vite 8 (Rolldown), Tailwind CSS v4, shadcn/ui,
TanStack Router + Query, TanStack Form + Zod, Axios, i18next.

### File-based routing (TanStack Router)

Routes live in `src/routes/`. Never edit generated `src/route-tree.gen.ts`.
Parenthesized groups such as `(protected)` add no URL segment; underscore-prefixed routes
such as `_protected.tsx` provide layouts.

### App shell

The protected layout has an icon-collapsible sidebar (`Ctrl/Cmd+B`) and top bar, adapted
from `@7ovr/app-shell-1`. `NAV_GROUPS` in `src/lib/config.ts` drives both the sidebar and
command palette (`Ctrl/Cmd+K`). `LIVE_NAV_GROUPS` excludes unmigrated `to: '#'` entries and
sections with no live pages. `useNavGroups()` in `src/components/nav-access.ts` then filters
both by the user's rights.

### Data fetching pattern

Define query options in `src/features/*/api/queries.ts` using `src/lib/key-factory.ts`.
**Default to deferred loading**: call `prefetchQuery` without `await` in the loader and put
only the data-dependent subtree inside `QueryBoundary`:

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
```

`FacilitiesTable` reads `useSuspenseQuery(facilitiesListOptions())`.

**Block only when rendering requires the result**, such as a detail-page 404 or permission
check. Return `ensureQueryData` and provide the route's `pendingComponent`:

```tsx
loader: ({ context: { queryClient }, params }) =>
  queryClient.ensureQueryData(facilityDetailOptions(params.facilityId)),
```

- Never await `prefetchQuery`; it would block navigation. Use it for fire-and-forget work
  because it handles rejected requests internally; unawaited `ensureQueryData` does not.
- Put `QueryBoundary` (`src/components/query-boundary.tsx`) above suspended subtrees.
  It combines `Suspense`, `CatchBoundary` and query reset. `useSuspenseQuery` throws errors;
  without this boundary they replace the whole page through the route's `errorComponent`.

### Feature-based modules

Features live in `src/features/<name>/`:

| Path | Responsibility |
|---|---|
| `api/api.ts` | HTTP calls through `src/integrations/axios.ts` |
| `api/queries.ts` | Query options: query function and key |
| `components/` | Presentational components |
| `lib/types.ts` | Feature types |

Shared utilities, types, constants, config and query keys belong in `src/lib/`. Stock event
screens share editor pieces within `src/features/stock-events/`.

**Features never import other features except `reference-data`.** Move shared code to a
shared folder, or compose features in `src/routes/` and pass data as props. Routes may import
any feature.

`src/features/reference-data/` contains lookups for facilities, facility types, programs,
supervisory nodes, processing schedules, roles, products, stock organizations and reasons,
plus the zone filter (`toZoneOption`) and program filter (`toProgramFilter`) helpers in its
`lib/`. It imports no other feature. Keep management screens in their own features. When
their list uses a lookup's endpoint, reuse that query and widen its type, as Roles and
Reasons do.

- Product lookups: `orderablesSearchOptions`, `orderablesByIdsOptions` and
  `orderablesByTradeItemsOptions`, all under `queryKeys.orderables.list` so saves refresh them.
  Trade-item lookups keep only each product's latest version from the server's version list.
- `fetchOrderablesByIds` and `fetchLotsByIds` send at most 100 ids per request and read every
  page, avoiding oversized URLs.
- `userRecordOptions` and `userProgramsOptions` read the signed-in user's record and programs;
  keep their keys separate from the Users page's richer detail.
- `validDestinationsOptions` and `validSourcesOptions` read every page through
  `fetchValidAssignments`, under `queryKeys.validDestinations.all` and `validSources.all` so
  admin saves refresh them. `reasonsOf` keeps visible reasons of one category and, optionally,
  one type.
- `approvedProductsOptions` reads one page of a facility's approved products for a program; it
  has no sort, and name and code are separate filters. `lotsByTradeItemsOptions` reads every
  lot of the given trade items. `facilityOrderableFulfillsOptions` maps a facility's products
  to those they can fulfil.
- Stock event screens choose products through `EventKindConfig.products`: Adjustments, Issue and
  Unpack read legacy's v2 stock list and resolve its cards' products and lots through the id
  lookups above; Receive pages approved products and offers every lot of the picked product's
  trade item. Stock-card filters take `(cards, today)`; Unpack keeps expired kit lots.
- Every event kind sets `columnFit`, `measuredFitKeep`, `products`, `print`, `newLots`,
  `download`, `drafts`, `contents`, `confirmation`, `scanning`, nullable `reasons` and nullable
  `eventOrigin`.
  Components read policies, never kind names. Unpack expands fresh kit contents, verifies
  runtime reason ids against the reasons list, uses simple confirmation and omits
  origin/signature. Other kinds keep signature confirmation; Issue and Receive retain printing
  and Receive retains new lots.
- Picker and editor text comes from kind copy, including `noProducts`. Receive's empty unfiltered
  list describes approved products; a typed search with no hits keeps No Matching Products.
  Stock event discard guards pass `pending` during refresh and posting.

### Internationalization (i18next)

Catalogs are runtime-fetched static assets in `public/locales/<lang>.json` using
`i18next-http-backend`. Deployments can correct strings without rebuilding.
`src/index.tsx` awaits `initI18n()` before rendering, so raw keys never paint.

- Use flat keys, such as `"users.title": "Users"`, never nested objects. Both `keySeparator`
  and `nsSeparator` are `false`. Use ICU MessageFormat for plurals/selects.
- `src/types/i18next.d.ts` type-imports `public/locales/en.json` for key checking. Keep keys
  alphabetically sorted with `pnpm sort-messages`, enforced before commits.
- A new language needs its catalog, a `SUPPORTED_LANGUAGES` entry with `dir` in
  `src/lib/config.ts`, and a `DATE_LOCALES` entry in `src/lib/date-locale.ts` (type-checked).
- When `en.json` changes, use `sync-translations` to remove stale keys, translate missing
  keys and preserve existing translations across catalogs.
- Store translation keys in Zod messages (`src/features/auth/lib/types.ts`). Resolve them
  with `t()` during render so existing errors follow language changes.

### Right-to-left support (RTL)

**Every screen must work in both directions.** Arabic ships with the app.
`components.json` has `"rtl": true`, so `shadcn add` generates logical classes.

Direction follows language, never a separate setting. `SUPPORTED_LANGUAGES` declares `dir`;
`getTextDirection()` handles region fallbacks (`ar-EG` is RTL). `TextDirectionProvider` in
`src/components/text-direction.tsx`, mounted by `src/index.tsx`, sets HTML `lang`/`dir` in a
layout effect before paint and supplies Base UI's `DirectionProvider`, including portals.

#### Rules for writing components

**Use logical direction utilities**, with the physical-side exceptions below:

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

- Pass raw values to `t()`; never isolate them manually. `IsolatingICU` in
  `src/lib/isolate-values.ts`, used by `src/integrations/i18n.ts`, isolates plain `{value}`
  interpolations so names/codes retain their order in Arabic. Select, plural, number and
  date values are unchanged.
- Flip reading-axis icons with `rtl:rotate-180`: chevrons, arrows, `LogOutIcon`, `PanelLeftIcon`.
  Do not flip undo, search or chart icons (`RotateCcwIcon`, `SearchIcon`, `TrendingUpIcon`).
- Base UI floating components (tooltips, dropdowns, popovers) use logical `side` values:
  `"inline-start"` / `"inline-end"`.
- Classes matching physical `data-[side=left/right]` values stay physical, including select
  and dropdown slide animations.
- `Sidebar` and `Sheet` have physical `side` props; their borders, rail offsets and enter/exit
  translates must stay physical too. `AppSidebar` chooses its side with `useDirection()`.
  Revert migrations that logicalize `group-data-[side=left]:border-r`, offcanvas rail offsets
  or the sheet's `data-[side=right]:border-l` and translates.

#### Checking a change

Run `pnpm dev`, switch to العربية and walk the changed screen. Check padding, borders,
directional icons and portalled popovers/tooltips.

### Deployment and the base path

The app runs beside legacy under `/v2`, routed by Consul KV. See the
[deployment guide](docs/deployment/deployment.md).

- Never hardcode an absolute path to a `public/` asset. Use
  `` `${import.meta.env.BASE_URL}olmis.png` ``; `BASE_URL` ends in `/`. Vite rewrites HTML
  assets but leaves TS/TSX string literals unchanged.
- `VITE_BASE_PATH` is a build input, compiled into asset URLs. Router `basepath`, i18next
  `loadPath`, assets and new app URLs must derive from `import.meta.env.BASE_URL`, never
  assume `/`. The shared API remains at `/api`; see Environment Variables.

### Design-system linting (shadcn/lint)

Oxlint hosts `@shadcn/lint`, which checks restyling, raw colors, arbitrary values and unknown
classes. It is a JS plugin and cannot run under Biome. `.oxlintrc.json` disables other Oxlint
categories; Biome owns general linting and formatting. **All six shadcn rules stay at `error`,
gate CI and must have zero findings.**

**Never pass `className` to shadcn components**, including spacing and layout. `no-restyle`
has no allowlist. Add a variant in `src/components/ui/`, or put layout classes on a plain
wrapper. Skeleton sizes always belong to the surrounding layout. Existing variant props
are defined in the typed components; reuse them before adding another. `TabsList wrap="column"`
fits odd tab counts; `wrap="md"` fits short labels. Page tabs use `TabsList size="lg"` (36px);
dialogs keep the default. `Button variant="destructive-solid"` and
`"destructive-outline"` mark the current and other invalid pages in the pager.
`Button variant="warning"` and `"info"` match notice actions to their Alert tones.
`DialogContent size="2xl"` (64rem) fits a one-line summary table of six columns;
`size="table"` (36rem) fits a short form above a compact five-column table.

`src/components/ui/` defines the variants and is excluded from design-system and Biome
linting. Editing these generated files is expected here.

**Preset changes and `shadcn add` overwrite customizations.** Run `pnpm tsc --noEmit` and
reapply missing variants to the new files. Preserve `DialogCloseLabelProvider` in
`dialog.tsx`, supplied by the root route with translated close-button text. Also check these
edits, which have no prop for TypeScript to detect:

| File | Required customization |
|---|---|
| `dialog.tsx` | Keep the app `@/components/page-visibility` dependency, hidden portal state and release after visible close |
| `sheet.tsx` / `dropdown-menu.tsx` / `popover.tsx` / `select.tsx` | Keep page-visibility gates and close transient overlays when the page hides |
| `alert-dialog.tsx` | Keep the page-visibility gate and retained close target; DiscardChangesDialog opts out so navigation/logout remain answerable. Preserve destructive media, the `lg` size and header/media/title `group-not-data-[size=sm]` classes so large dialogs retain the default layout |
| `breadcrumb.tsx` | Keep Breadcrumb `min-w-0`, BreadcrumbList `flex-nowrap whitespace-nowrap`, BreadcrumbPage `truncate`, BreadcrumbSeparator `shrink-0`, BreadcrumbItem `current` prop and no sr-only "More" in BreadcrumbEllipsis |
| `command.tsx` | Keep disabled items muted without lowering their explanation opacity |
| `dialog.tsx`, `alert-dialog.tsx`, `sheet.tsx` | Preserve covered-parent shrink, dim and blur styles, reduced-motion support and explicit body portal containers |
| `checkbox.tsx` | Indeterminate minus in checked colors; dim on Base UI's `data-disabled` |
| `input.tsx` | Preserve `controlSize`, `sizing` and the exported `InputSizer` width formula; `text-sm` at every width (also `textarea.tsx`), as `index.html` stops iOS focus zoom |
| `calendar.tsx` | Pass `CalendarDayButton`'s ref to `Button` for keyboard focus |
| `select.tsx` | Default `alignItemWithTrigger` to `false`; the list grows to its longest option (at least the trigger and 9rem), wrapping only past the screen |
| `button.tsx` | Dim both `data-disabled` and `:disabled`, including `focusableWhenDisabled` |
| `button.tsx` | Preserve `wrap="normal"` for wrapping action labels in cards |
| `sonner.tsx` | Use `useResolvedAppearance()` from `src/lib/appearance.ts`; no next-themes |
| `chart.tsx` | Lay out SVG LTR so Arabic labels fit their gutter; localize tooltip numbers |
| `avatar.tsx` | Overlap `AvatarGroup` with logical `-ms-2`, not `-space-x-2` |
| `sidebar.tsx` | Keep both menu button variants free of `aria-disabled:pointer-events-none` so connection-dependent entries remain clickable offline |
| `table.tsx` | Preserve TableRow `drag` with transform/transition from CSS custom properties and `aria-invalid:bg-destructive/10` for invalid draft lines |
| `combobox.tsx` | Keep page-visibility gates and close transient overlays when the page hides. Keep `ComboboxChip` at `max-w-full min-w-0` so long tags truncate |
| `tabs.tsx` | Keep TabsList `size="lg"` 36px triggers and the stacked `wrap="column"` list's start-aligned, full-strength labels |

### Integrations

`src/integrations/` owns Axios, TanStack Query/Router and i18next singletons. Dev requests to
`/api` and `/localeSettings` use the Vite proxy (`localhost:8080` unless configured).

### UI components

Generate shadcn components in `src/components/ui/` with
`pnpm dlx shadcn@latest add <component>`. Check RTL exceptions and customizations above.
`cn` comes from the `cn` package, re-exported by `src/lib/utils.ts`.

### pnpm settings

pnpm is pinned by `packageManager` in `package.json`. Put settings such as `allowBuilds`
(formerly `onlyBuiltDependencies`) in `pnpm-workspace.yaml`, not a `pnpm` key in
`package.json`. pnpm 12 rejects unrecognized workspace settings.

## Code Conventions

- **pnpm only**; never npm.
- **Kebab-case filenames**, enforced by Biome. Routes retain TanStack's `$param` and `users_`
  (no nesting) syntax.
- **`type` over `interface`**, enforced by Biome.
- **`@/*` imports**, mapping to `src/*`.
- **Logical CSS only**, subject to the physical-side exceptions in RTL above.
- **Colocated tests**, such as `use-mobile.test.ts` beside `use-mobile.ts`.
- **Tests earn their place**: protect a meaningful, plausible regression in our code that
  existing tests or static checks do not adequately cover. Choose the cheapest useful
  boundary: pure logic for domain rules, focused interactions for workflows. No test per
  component/function, routine label/default snapshots, mock-return echoes or tests of stock
  shadcn, Base UI, React or other packages. Trust dependencies; test our decisions and
  integration. Use [test-audit](.agents/skills/test-audit/SKILL.md) for suite audits or disputed
  test value.
- **Tests first when warranted**: write a meaningful failing test before implementation.
  Start bug fixes with a reproducer; reuse adequate coverage instead of adding duplicates.
- **One suite timeout**: `vite.config.ts` sets test timeouts; `src/tests/setup.ts` sets
  `findBy*`/`waitFor` waits for loaded machines. Never pass per-test/query timeouts. Use
  Testing Library's `waitFor`, not `vi.waitFor` (its own 1 s timeout). Cache-seeded
  `useSuspenseQuery` tests set `staleTime: Infinity` to prevent mount refetches.
- **Biome format**: 2 spaces, single quotes, trailing commas, 100-character lines.
- **No Co-Authored-By lines** in commits or PRs.
- **No em dashes** in code, comments, UI copy, translations, docs, commits or PRs.
  Use a plain hyphen or rephrase.
- **Human docs**: `.md` files under `docs/<topic>/`, indexed in `docs/README.md`. Never use a
  PDF as the source. Coding guidance belongs here.
- **Necessary comments only**: maximum one line, no ticket/issue attributions. Prefer clear
  naming.

## Pull Request Format

Keep descriptions short:

1. Ticket link at the top, on its own line.
2. `## Changes` with concise, one-line bullets only. No paragraphs or process narration.

No Screenshots section. Omit inapplicable sections; never write "N/A".

```markdown
https://tracker.example.com/BROWSE/ABC-123

## Changes

- Add `surface` to `Card` so consumers stop overriding `bg-card`
- Replace arbitrary text sizes with the `text-2xs` token
```

## Page layout

App-shell pages compose `src/components/workspace.tsx`:

```tsx
<Workspace>
  <WorkspaceHeader>
    <WorkspaceHeading>
      <WorkspaceIcon><ClipboardListIcon /></WorkspaceIcon>
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

- Parts take `children`, no boolean props or `renderX` callbacks. Every page includes a
  one-sentence `WorkspaceDescription`; omit unused icons/actions. Below `@xl/main` the
  description is screen-reader only and the title centres on the icon. `Workspace` and
  `WorkspaceFooter` accept `width="narrow"` for settings or short stock-program tables,
  `width="large"` (84rem) for tables slightly wider than the default, such as Supervisory
  Nodes, and `width="wide"` for uncapped tables.
- Stock event pending views use the real icon, description, cached title or title-height placeholder,
  disabled picker/toolbar, empty table or empty card list and sticky footer. Stock program
  skeleton actions reserve the real translated Button size. Wrap program, status and action
  text between words.
- Header actions use `size="lg"` and are direct children of `WorkspaceActions`, so each
  stretches on narrow headers. Loading skeletons render one block per button.
- Draft editors put the muted, sticky `WorkspaceFooter` immediately after `Workspace` as a
  sibling, aligned with the page. Cancel sits at the start, Save at the end, both `size="lg"`.
  Both return to the originating list with page/sort/filters supplied by the opening link
  in history state. Settings opened
  without a list stay put: Cancel restores saved values; Save keeps the page open.
- Shared tab headers live in the layout through `WorkspaceTabs` inside `WorkspaceSlots`.
  Use `WorkspaceFooterPortal` (`src/components/workspace-tabs.tsx`): `narrow` by default,
  `width="default"` for full-width editors. Tab switches must not remount the header.
  Tab-specific actions use `WorkspaceActionsPortal` into `WorkspaceActionsSlot`.
- Toasts appear below the header at the top end corner, tinted by kind.

`Workspace` derives breadcrumbs from `NAV_GROUPS` through `getNavTrail()`:

- Keep breadcrumbs on one line: retain Home and the current page, collapse middle crumbs by
  container width and truncate the current label.
- A live nav route gets Home / Section / Page; descendants add `staticData.crumbKey`, with
  linked parents. `staticData.crumbParentSearch(search)` carries list search into the last
  linked crumb, retaining filters on reload/shared links.
- A non-nav page with `crumbKey` gets Home / its crumb. Home and non-nav pages without a
  crumb have no breadcrumbs.
- `useAccountLinks()` (`src/components/nav-access.ts`) supplies rights-filtered Profile and
  `/settings` links to the avatar menu, palette and sidebar, immediately below sidebar Home.
- Workspace parts/breadcrumbs accept no `className`; add a variant for a different treatment.

Signed-out pages compose `src/components/auth-card.tsx`: `AuthPage` with the page title;
`AuthHeader` with `AuthTitle` and `CardDescription`; `CardContent` with `AuthForm`, fields,
`AuthSubmit` and optional `AuthLink`. When a confirmation replaces a form, pass `focus` to
`AuthTitle` for keyboard and screen-reader focus.

## List pages

Follow `src/routes/(protected)/_protected.administration.users.tsx` for server-paged lists.

**URL and requests:**

- Page, size, sort and filters are search params validated with `tableSearchSchema()`,
  `textFilterSchema` and `dateFilterSchema` from `src/lib/table-search.ts`. Invalid values
  fall back to defaults; defaults stay out of the URL. Prefetch from `loaderDeps`.
- Use `useTable` with `manualPagination`, `manualSorting` and the server's `rowCount`.
  `useTableSearchState()` connects to the URL. Compute changes from the latest search,
  never the rendered copy. Sort/filter/size changes return to page 1.
- If the endpoint cannot page/sort, fetch all records once and filter/sort/page locally
  under the same URL state. Clamp pages past the end; no suspension on later pages.
  Roles (`GET /roles`) and Programs (`GET /programs`) are examples.
- **Support backend services on master.** Never depend on branch-only endpoints/parameters.
  Preserve legacy API limits: `GET /orderables` has separate code/name filters, so offer
  Search By Name in the toolbar and Search By Code inside Filters.
- Keep the toolbar outside `QueryBoundary`. Rows read `useDeferredValue(search)`;
  first load shows `DataTableSkeleton`, later requests keep dimmed existing rows until ready.
  Filter typing replaces history; paging/sorting add entries for Back navigation.

**Responsive tables:**

- At or above `CONTAINER_WIDTHS['2xl']` (672px), stock event editors use tables. Below it they
  use cards. Issue, Receive and Unpack use `columnFit: 'measured'` only for the table to hide
  optional columns by measured fit because translated inputs make pixel thresholds language
  dependent. `measuredFitKeep` lists
  columns the fit must keep: Unpack keeps `productCode`; other kinds use `[]`. View can still
  hide kept columns. Unpack hides Pack Size, Total Quantity and Expiry in that order, then scrolls
  sideways if the readable columns still do not fit. With draft lines but no filter
  matches, keep fitted visibility and the last rendered column widths until rows return. Their
  quantity inputs fill their cell while reserving a character-unit minimum based only on their
  translated placeholder, with room for at least five digits; extra digits scroll inside the input.
  Their date column minimum measures all 12 months in the page language. Quantity sizers live
  once in the column header for every stock event layout; VVM and date sizers only serve measured
  layouts. Adjustments keeps full-width inputs, with each quantity input reserving its placeholder
  and at least five digits. At or above 672px, the table scrolls sideways when its column
  minimums do not fit.

- Tables draw vertical column dividers by default.

- Yes/no and active/inactive cells use `FlagBadge` (`src/components/flag-badge.tsx`): a success
  check or destructive cross, always with its label.

- Use content width, never viewport breakpoints such as `md:`. Define lower-priority columns
  with `hideBelow` (container size or pixels) or `defaultHidden`; see `USER_HIDEABLE_COLUMNS`.
  Combine `useElementWidth()`, `useColumnVisibility()` and `useStoredState`. User choices
  override defaults; Reset Columns clears them. Share visibility across table, skeleton and
  View menu.
- Column widths (`meta.className`) and toolbar use `Workspace`'s `@container/main`, such as
  `@xl/main:w-2/5` and `@2xl/main:w-72`. Pagination uses the card's `@container/table`: current
  page plus up to three on each side, only current on narrow tables. Links accept sizes 1-100.
  `isPageInvalid` turns pages holding invalid rows red, with no icon: solid for the current
  page, outlined for others, and named "Page N: " plus the `invalidPage` label. A page that marks
  rows clears each mark as soon as its cause is fixed, so the pager follows live.
- Stock On Hand is the model for phone cards, also used by Stock Card and Transaction History.
  Use `useCardLayout` for measured layout and `useCardView` for stored visibility too
  (`src/hooks/use-card-view.ts`). Below `CONTAINER_WIDTHS['2xl']`, compose `CardList`,
  `CardListItem`, `CardBand`, `CardRows` and `CardListSkeleton`
  (`src/components/card-list.tsx`). Stock On Hand gives each product a card with its lots as
  bands (lot label, View) over `SettingsItem` rows; Stock Card
  uses a date band, Transaction History a band with the document number (or date) and View.
  Details use a product band. Reverse ticks a line from anywhere in its band (`CardSelectBand`),
  which tints, and enables the card's reason field. Cards ignore width defaults, so stored View
  choices apply; every visible detail is a row, `EMPTY_VALUE` when empty. View passes
  `layout="cards"` (Toggle Details). Use `usePageStart(key, cards)`
  (`src/hooks/use-page-start.ts`) for the pager wrapper and navigation options;
  `usePagedTableSearch` wires it into `useTableSearchState` for URL-paged tables. Each new card
  page opens at its first card below the header; filters and past-end clamps never request a
  scroll. Confirm Reversal cards collapse behind `CardToggleBand`, showing the stock change in
  the band; every card starts collapsed and the dialog's cards have no shadow.
  Stock program pickers for Issue, Receive, Adjustments, Unpack and Physical Inventory use one
  card per program, with program and action in the band; Physical Inventory adds a Status row.
  Issue, Receive, Adjustments and Unpack editors use one card per line, with the product label
  and Remove trash button in the band. `productLabel` from
  `src/features/stock-events/lib/products.ts` formats `name - displayUnit (code)`. Read-only
  rows show Pack Size, Lot Code with the table's no-lot text, Expiry and Stock On Hand;
  Total Quantity follows Quantity. `CardControlRow` (`src/components/card-list.tsx`) pairs
  labels with centred controls for counterparty and comments, reason and comments, VVM and
  Date, and Quantity; in Packs its row is `width="wide"` and shows `[Packs] + [Doses]`.
  Measured fit and `measuredFitKeep`
  apply only to the table. Pending editors show the same empty card list.
  Physical Inventory drafts put category headings between product cards, with each lot and
  its action in a band, using the table's No lot defined text. Rows show Pack Size, Expiry,
  Stock On Hand, Current Stock, VVM, Reasons and Unaccounted. Multi-lot products add a Total
  section matching the table summary. Add Products dialog lines use flat cards with inline errors.
  Every table switches to cards below 672px. Other tables use `TableCards` and
  `TableCardsSkeleton` (`src/components/table-cards.tsx`) over the same TanStack table: the `title` column and the
  `actions` cell form the band; every other visible column is a row labelled by `meta.label`.
  Text cells use `CellText` (`overflow="nowrap"` for scrolling tables, `"clamp"` for two lines),
  which wraps in full in cards; `TableCards` bolds the band title. It calls each column's `cell`
  directly, so cells must not call hooks and must return `null` or `''` when empty to show
  `EMPTY_VALUE`. Sortable card lists pass `sort` to `DataTableViewOptions` from `searchSort`
  (`src/lib/table-search.ts`); lists without a View menu show it only as cards. Sorting adds
  history. A `select` column turns the band into `CardSelectBand`, with a Select Page control
  above the cards; `heading` renders group rows as headings, as on product Facility Types.
  Row action cells render `RowActions` with one `actions` list: `CardActions` in cards, the
  table's ghost "..." menu otherwise; other cell components read `useInCards()`. Every card band action, Stock included, goes through `CardActions`
  (`src/components/card-actions.tsx`), given as data: outline icon buttons with a tooltip and the
  table's accessible name, tinted `destructive` for destructive ones, inside a group named like
  the table's "..." menu (`label`, required). Pass the main action (Edit, then Configure, then
  View) first in `actions`; it sits at the band's end. Up to three show as buttons; four or more
  show two plus a "..." menu holding the rest, destructive last. Server deletes always confirm;
  draft-row removal is instant. Skeletons pass the same count to `CardActionsSkeleton` or
  `TableCardsSkeleton actions`. Editor and dialog tables follow the same rule. Dialogs measure
  with `useDialogCardLayout(size)` (`src/hooks/use-card-view.ts`): below 672px or once the screen
  squeezes a narrower dialog below its own width. `DialogTable` and `DialogTableSkeleton`
  (`src/components/dialog-table.tsx`) render flat `TableCards` in `DialogCards`: the dialog body
  scrolls forms, cards and pager as one, with no nested scroll area, and a pager move scrolls to
  the first card; filters and past-end clamps do not. Measure outside `FormDialogBody`, whose scrollbar would flip the layout.
  Requisition template Columns cards keep drag-to-reorder: the handle, indicator, label and
  Display checkbox form the band, `CardListItem drag` moves the card and `CardDragPreview` draws
  the overlay. Keep headers on one line;
  every table header uses `DataTableHeaderLabel`'s style, including loading skeletons.
- Table cells with no value stay blank. Use `tableValue` (`src/lib/empty-value.ts`) when
  normalizing missing values; `orEmpty`/`EMPTY_VALUE` is for values shown outside tables.
- Identifying/actions columns stay visible and out of View. Other columns, including status,
  may hide. Table row actions use an end-of-row "..." menu; cards use `CardActions`. Draft
  editor line tables whose only row action is Remove use a trash icon button.
- Put Create at the toolbar's end, after View.

**Filters and states:**

- Every toolbar follows one layout: one text search first and always visible, then one
  `DataTableFilters` button holding every other filter, then View, Print and Create at the end.
  Where the API filters code and name separately (Products, Stock On Hand), Name stays visible
  and Code goes inside. Selects, comboboxes, dates, switches and secondary text such as Lot Code
  go inside too. No search means the button stands alone; no other filters means no button.
  Physical Inventory is the exception: its progress bar leads the toolbar, so Keywords sits
  inside Filters there. Wrap toolbars in `DataTableToolbar` (`align="end"` for unit/View rows).
- Page-level controls (header actions, toolbars, pickers and Add buttons above child tables)
  pass the `lg` size: 36px at every width, with h-9 skeleton blocks. Controls in table rows
  stay `sm`; those in cards, dialogs and the Filters popover keep the default. Never resize
  shadcn controls from a parent.
- `DataTableFilters` badges the count of its own active filters and offers Clear Filters for
  them only, as a `destructive` Button. Fields apply live, without an Apply button. Pending
  toolbars render it disabled.
- Short fixed lists use `DataTableSelectFilter`, with `allLabel` when legacy offers All.
  Long lists use searchable `DataTableComboboxFilter`; optional `description` follows labels
  in muted text.
- Server-search filters pass `onSearch` and display `options` as given. Fetch only on first
  opening; retain the picked option, using its own lookup for linked selections. `status`
  announces listed/matching counts and that typing finds more. Products on Lots is the example.
- Date filters use `DatePicker`; pair `earliest`/`latest` for from/to bounds.
- Cover rows, loading skeleton, empty and error with retry. Distinguish no records from
  no filter matches; the latter has Clear Filters.

**Selection and reports:**

- Use `selectionColumn()` (`src/components/data-table/data-table-selection.tsx`); the header
  picks the page. Preserve selection across pages by id and name for confirmations.
- Filter changes clear selection and close confirmations. `useFilterScoped` prevents stale
  visible rows from changing selection or opening deletion. Name each checkbox with every
  distinguishing row detail.
- Render `DataTableSelectionBar` after the table with count, Clear and actions: one line, info
  tint, outline Clear; actions label through `SelectionBarLabel` with `full` and `short` text so
  the bar stays on one line on phones. Selection
  stays out of the URL. Bulk delete awaits every request, reports failures and focuses the
  list after rows/bar disappear; see Valid Destinations.
- PDF actions use `usePrintReport` (`src/hooks/use-print-report.ts`) for permission checks,
  user-change guards and toasts. Render the page's Button; `onReport` starts delivery in its
  click handler. Stock Card's `openReport` opens a waiting tab synchronously and downloads if
  blocked/closed; Stock On Hand uses `downloadFile`. Use `fetchReport`
  (`src/lib/fetch-report.ts`) for blobs and JSON error decoding.

### The data-table components

`src/components/data-table/` must move unchanged into the SolDevelo shadcn registry:

- Import only stock `@/components/ui/` primitives, `@/lib/utils`, `@tanstack/react-table`,
  `lucide-react` and sibling files. No hooks, other lib modules, features or i18next.
- Avoid app variants such as `Button tone`. Allowed exceptions: `SelectTrigger width`,
  `Table density/layout/width/scroll`, `TableHeader surface`, `DropdownMenuContent width`, `Button width`,
  `ComboboxInput width/clearLabel`, `InputGroup size="lg"`, `PopoverContent width`, `Skeleton fill`,
  `Button variant="destructive-solid"` and `"destructive-outline"`. These become plain
  `className`s in the registry; `InputGroup size="lg"` becomes `h-9`. `selectionColumn` ships the checkbox's indeterminate-minus
  customization too.
- Dialog, AlertDialog, Popover, Select, Combobox, DropdownMenu and Sheet import the app
  `@/components/page-visibility` gate. Its context defaults to false, keeping these primitives
  stock-like outside the app. This is an accepted app dependency exception; strip the gate
  when moving them into the registry.
- `isRowInvalid` row tint depends on app `table.tsx` aria-invalid styling; carry that styling
  into the registry.
- Text comes from `DataTableLabelsProvider` (English defaults); the shell's
  `TranslatedDataTableLabels` supplies `data-table.*` translations.
- `DataTable` and `DataTableSkeleton` share column metadata: `density="comfortable"` by
  default, `default` for compact tables needing room, `compact` for tighter cell padding;
  `layout="fixed"` by default, `auto`
  for content-sized columns such as bin cards. `DataTableSkeleton pagination={false}` omits
  the pager placeholder for unpaged tables; pagination defaults to true.
- Columns holding a button or inline control set `meta: { skeleton: 'control' }`, so loading rows
  reserve a 28px block and keep the real row height. Pending headers use the real icon, title and
  description, with a placeholder only inside `WorkspaceTitle`/`WorkspaceDescription` when the
  title needs data; Stock On Hand's View link passes `cardHasLot` so Stock Card's skeleton
  draws the lot rows only for lots.
- URL/table state stays in `src/lib/table-search.ts` as app glue.

TanStack Table is **v9**: use `useTable` and `dataTableFeatures`, never v8 `useReactTable`.
Version-matched guides live in `node_modules/@tanstack/react-table/skills/`.

## Forms and dialogs

Nested modals use the shared popup defaults: Base UI's `data-nested-dialog-open` slightly
shrinks, dims and blurs the parent while its content stays mounted. Keep child portals sharp;
do not add feature-specific offsets, clipping or hidden parent content. Respect reduced motion.
Child modal roots belong under their parent root in the React tree, even when portalled;
sibling roots cannot activate native nesting. Keep HTML forms separate. Sequential dialogs
replace one another rather than stacking. Global interruptions and page guards can have
sibling roots; shared popups also use Base UI's standard `aria-hidden` on themselves or their
portal ancestors to style covered modals consistently. Shared modal portals default their
public `container` to `document.body`, preserving React nesting while preventing a new global
prompt from inheriting a covered ancestor portal's `aria-hidden`. Preserve caller overrides.

**Choose the container:**

- Use a dialog for a few fields and one save; a page for tabs, child tables or multiple steps.
  Add/Edit User is a dialog; Edit User Roles and facility editors are pages.
- Facility editors keep one draft above tabs, use `?tab=`, and open the first invalid tab on
  save. Add children through an Add button above their table opening `FormDialog`, never
  inline fields. Every field, including descriptions/tags, occupies one column of the
  two-column grid. Lookup fields each get a `QueryBoundary`. Footer Save targets the form's
  `form` attribute so Enter submits.
- Save immediately without an extra confirmation, even if legacy asks. Confirm only when
  the save affects other records, such as changing a role held by users.
- Dialog state belongs in the URL (`?user=new` / `?user=<id>`). Opening adds history; closing
  steps back, or replaces for a directly linked dialog. Use
  `useSearchNavigation<PageSearch>(CLOSED_DIALOGS)` (`src/hooks/use-search-navigation.ts`).
- Inline add forms with one picker, where picking reveals no further field, drop the label
  and card: a picker with a leading icon and a placeholder naming the choice, then a separate
  Add button beside it (never attached). The row sits above the toolbar, capped at
  `@3xl/main:max-w-xl`, with a `Separator` below it. Decide from the offered list before
  anything is picked: stock event pickers use this compact row when no offered item has lots
  and keep labelled fields in a card otherwise. Receive can create lots, so it always keeps
  labelled fields. Compose `PickerAdd`, `PickerAddField`, `PickerAddIcon` and `PickerAddButton`
  (`src/components/picker-add.tsx`); anchor the list to `PickerAddField` so it spans the icon. The loading skeleton repeats the layout last shown for
  that kind and program (`rememberedPickerLayout`), compact on a first visit.

**Whole-record saves require fresh reads:**

- Edit Facility passes fresh `saved` data to its `facility-editor.tsx`.
  Pages reading fresh records for whole-record saves, including Edit Reason, set
  `preload: false` to prevent hover-cache reuse.
- Dialogs fetch fresh on each opening: add a per-opening number from `useOpening()`
  (`src/hooks/use-opening.ts`) to the detail key, and do not prefetch it in the loader.
  Programs and Facility Types do this; Roles and Users retain one cached detail.
- Whole-record tabbed editors, such as Product Edit, use `fetchQuery` with `staleTime: 0`
  on loader `cause: 'enter'`, cached data on `stay` (tab switches), and `preload: false`.
  Each save rereads the record and applies only its own change (`saveProductChange`).
- Missing records show `DialogNotFound`; other load failures show `DialogLoadError`, both
  from `src/components/dialog-parts.tsx`. Switch placeholders use `SwitchSkeleton`.

Compose dialogs from `src/components/form-dialog/`: `FormDialog`, `FormDialogForm`,
`FormDialogHeader`, `FormDialogTitle`, `FormDialogDescription`, `FormDialogBody`,
`FormDialogFooter`, `FormDialogCancel`, `FormDialogSubmit`. Use `useAppForm` fields from
`src/components/form/form.tsx`; define shared field sets once with its `withForm`.

**Field contracts:**

| Field | Contract |
|---|---|
| `TextField`, `TextareaField`, `PasswordField` | Text, multiline text and passwords; `TextareaField maxLength` caps input, `inline` is one row; `TextField controlSize="sm"` opts into 28px controls, including inline fields |
| `NumberField` | Keep typed text; validate `wholeNumberText` (`src/lib/whole-number.ts`), including Arabic/Persian digits; read with `toWholeNumber`; `controlSize="sm"` opts into small controls |
| `QuantityField` | Keep doses, packs and remainder text in `QuantityValue` across unit switches; submit doses; `sizing="minimum"` fills the cell while reserving each input's translated placeholder minimum with room for at least five digits; `InputSizer` measures it once in the column header; `sizing="full"` uses Input's `full-minimum` mode to divide the wrapper equally while reserving the same content minimum with full input padding; `sizing="fill"` with `notation="plus"` lets card Packs inputs share a wide `CardControlRow` as `[Packs] + [Doses]` |
| `DecimalField` | Validate `decimalText` (`src/lib/decimal.ts`); read with `toDecimal`; display with `toNumberText(value, decimalMark(language))` |
| `SwitchField` | Yes/no as one row: label/info at start, switch at end; never a checkbox |
| `MultiComboboxField` | Multiple choices as chips, never a checkbox column |
| `TagsField` | Enter/Tab/blur takes the highlighted suggestion or typed text; comma adds typed text; `minLength`/`maxLength` failures show a message |
| `SelectField` | One choice from a short fixed list; opens below input (`alignItemWithTrigger: false`); `placeholder` shows when empty, unless an item's value is `''` |
| `ComboboxField` | Searchable choices; item `description` appears muted after label |
| `ImageField` | `undefined` keeps saved image, `null` removes it, `File` replaces it; validate `onChange` immediately |
| `FileField` | `File` selects a file; `undefined` clears it and its errors; pass translated `emptyLabel`, `removeLabel`, `accept` and optional external `describedBy`; the entire paperclip/filename row opens the file chooser, and the selected-file card takes a caller-localized `fileSize` and a destructive clear control; required validation stays in the schema |
| `DateField` | Page-language calendar; draft is `yyyy-MM-dd` or empty; optional dates get `clearLabel` |
| `RadioGroupField` | `variant="tile"` for option grids, `variant="segmented"` for 2-3 short options, `columns="row"` for cards side by side when room permits |

- `TextField`/`NumberField`, `TextareaField` and `SelectField` accept `errorDescriptionId`
  to mark the control invalid and reference an existing visible error instead of rendering another
  error or tooltip. `TextareaField describedBy` adds a description such as a character counter.
  `ComboboxField invalid` and `describedBy` associate a separate selection field error with its picker.
- Inline `SelectField`, `TextareaField`, `QuantityField` and `DateField` accept `hideErrors`.
  Editor line tables use it to hide error text, retain `aria-invalid` and
  screen-reader descriptions, and show the message on field hover or focus through Tooltip without
  adding tab stops. Invalid Submit and server failures open an AlertDialog, as Reverse does; closing
  validation focuses the first invalid field on its page. In cards, `revealField`
  (`src/lib/reveal-field.ts`) scrolls the card into view, then the field, then focuses it.
- Inline fields use `Field surface="background"` for opaque controls on selected or hovered rows.
  Textareas use `resize-none` and grow with their content. Inline `SelectField size="sm"` and
  `Textarea size="inline"` are both 28px; where they appear on tick, as on Reverse, wrap the
  cell in a fixed width rendered on every row, so ticking never shifts the table.
- Whole numbers default to Java `int` bounds. Server `long` fields pass
  `max: Number.MAX_SAFE_INTEGER`; lower bounds pass `min` and their message. Optional values
  pass `optional` and read with `toOptionalWholeNumber`.
- Decimals accept a dot or the language's comma. Reject comma before exactly three digits
  as ambiguous with thousands separators; `toNumberText` uses a dot for those values.
  Set `maxDecimals` to cap precision.
- Dates use `earliest`/`latest` calendar bounds and schema validation too. Lazy-load the
  calendar and language (`loadDateLocale` through `FormMessagesProvider`) on mount; retry
  failed loads when opened. Required dates announce the provider's `requiredLabel` with
  their name. Outside forms use `DatePicker`, which `DateField` wraps; display dates with
  localized `formatDateValue` (`src/components/form/date-value.ts`).
- Timestamps use `formatTimestamp` with `useDeploymentTimeZone()` (`src/hooks/`). It suspends
  on reference-data's `deploymentTimeZoneOptions`, reading public `/localeSettings` and
  retaining it on failure, so both UIs use deployment time rather than the viewer's clock.
  Loaders showing timestamps start this query too.
- Field `layout` is `stacked` by default. Settings use `row` inside `SettingsList`
  (`src/components/form/settings-list.tsx`), label at start/value at end; read-only values
  use `SettingsItem`. Table fields use `inline` with screen-reader-only labels/descriptions;
  include row identity as well as the column name.
- Validate Zod schemas on `onDynamic` with
  `revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' })`: first submit, then
  every correction. `TranslatedFormMessages` in the shell supplies `FormMessagesProvider`
  with the translation-key messages described under Internationalization.
- Row `SwitchField`/`SelectField` accept a label-row `action`; `TextField` accepts `badge`.
  Stacked `PasswordField` puts `action` at the label's end but after the input in tab order.
  Password/confirmation pairs share `visible` and `onVisibleChange`.

Both form folders follow registry boundaries: stock shadcn primitives, `@/lib/utils`,
`@tanstack/react-form`, `lucide-react` and sibling files only; no app hooks, other lib modules,
features or i18next. Allowed variants: `DialogContent size/height/layout`, `DialogHeader spacing`,
`DialogTitle size`, `Input controlSize/sizing`, `InputSizer`, `Field spacing/surface`,
`FieldLabel weight`, `Textarea size`, `ComboboxInput width/clearLabel/size`,
`ComboboxChip removeLabel`, `RadioGroup columns/size`, `SelectTrigger width/wrap/size="lg"`,
`Button align/width`, `PopoverContent width/padding`. Each `lg` size is a plain `h-9` className
in the registry.
The app Dialog, AlertDialog, Popover, Select, Combobox, DropdownMenu and Sheet primitives
import `@/components/page-visibility`; form-dialog and form-fields inherit this dependency.
This is an accepted app dependency exception. The context defaults to false, keeping them
stock-like outside the app. Strip the gate when moving these components into the registry.

**Every toast has a short Title Case title and a detail sentence as `description`**, displayed
at most two lines. `Toaster` supplies the translated close button; callers never pass one.

## Barcode scanning

Behind `GS1_SCANNING`, compose `useBarcodeScan` and `ScanStatus`. The GS1 parser and stock
resolver live in `src/lib/`. Pause while dialogs are open, check cancellation before applying
pending results, and abort on unmount. Each screen supplies its own lot policy. Stock event
scanning follows the kind policy; Unpack keeps it off, as legacy.

## Facility and program picker

Facility/program screens use `FacilityProgramSelector`
(`src/components/facility-program-selector/`).
`facilityProgramOptions` (`src/lib/facility-program-selection.ts`) builds options from the
home facility, user programs, all facilities and page grants, following legacy:

- My Facility offers home programs; Supervised offers programs granted away from home,
  then those programs' facilities, home included. Routes pass the required right's grants;
  the picker imports no auth.
- Keep edits as a draft until Search writes `mode`, `programId` and `facilityId` to the URL.
  Hide results that no longer match the draft.
- Refuse linked selections the picker cannot offer (`validSelection`); leave unavailable
  choices blank, never silently substitute. Supervised links to a home program open as
  My Facility. Auto-pick a required list's sole option.
- Load stock only for a granted pair, without awaiting picker lookups; load both in parallel.
- Like the stock event pickers, it has no card and a `Separator` below; Facility Type, Facility
  and Program each take the shared field width (`min-w-0 flex-1 @3xl/main:max-w-96`).
- Stock On Hand and Transaction History show their search and Filters before Search, as
  legacy does; View, Print and the unit toggle wait for results.

## Rights and dashboards

**Render only what rights allow:**

- `permissionsOptions(userId)` (`src/features/auth/api/queries.ts`) loads permission strings
  once per session, parsed by `src/lib/permissions.ts` into names and `RIGHT|facility|program`
  grants. `RIGHTS` names the app's checks.
- Loaders await `ensureQueryData(permissionsOptions(...))` and read `.rights`; prefetch only
  allowed data and pass plain flags to features. `rightsOptions` uses `select` for components
  only: `fetchQuery`/`ensureQueryData` ignore `select`. Features never import auth; see Home.
- Facility/program pages check exact grants with `hasProgramGrant`. Unscoped rights or
  grants elsewhere never count.
- User-changing saves call `invalidateUserQueries(queryClient, userId)`
  (`src/lib/user-queries.ts`). Per-user caches hold only the signed-in user's data; rights,
  Profile and Home refresh only when saving that user.
- Before loading protected pages, await `requireRight(queryClient, RIGHTS.x)` or
  `requirePermissions` for grants (`src/features/auth/lib/access.ts`), alongside required data.
  Missing rights throw `ForbiddenError`. Add matching `NAV_RIGHTS` entries in
  `src/components/nav-access.ts` for sidebar, palette and breadcrumb filtering.
- For legacy's either-right pages, pass both rights to `requireRight` and `NAV_RIGHTS`.
  Gate individual actions with the resolved rights set, including directly linked dialogs.
- Record-and-grant pages (Stock Card, stock events) use `useReloadForUser`
  (`src/hooks/use-reload-for-user.ts`) after identity changes.

**Access errors:** the default route error shows `NoAccessPage` for forbidden errors/server
`403`. Custom route errors use `ErrorFallback` with title/description and optional `back`
(replacing Back Home for list returns); it checks `isForbidden(error)` first. Refusable
`QueryBoundary` content shows `NoAccess`. Feature boundaries use `isRefused(error)`
(`src/lib/http.ts`) and a short in-place message, without importing auth.

**Unsaved work:** draft pages use `useDiscardGuard` (`src/hooks/use-discard-guard.ts`) for
router navigation. It registers `useLeaveGuard` for exits outside the router; sign-out,
password changes and other deliberate sign-outs call `whenLeaveAllowed` before acting.
Both use `src/components/discard-changes-dialog.tsx`. Its `pending` option keeps leaving blocked
during a save without offering Discard. Device drafts pass `flushBeforeLeave` to commit staged edits
before navigation/sign-out; only a failed flush asks first, and sign-out retains saved work.
Reload/tab close uses only the browser's native prompt. External identity changes follow
Authentication below.

**Charts:** use Recharts through `ChartContainer` and theme ramp `--chart-1`..`--chart-5`,
one hue light-to-dark, checked for even steps/contrast in both modes. Use the ramp in order
for ordered data. Status uses `success`, `warning`, `destructive` plus icon and label;
never color alone. `--offline`/`--offline-foreground` in globals.css define the lavender/purple
light/dark status pair; expose them through Tailwind and Alert variant="offline". This is a fixed
status palette, like info/warning/success, outside preset brand/chart tokens. The kind-specific
pending offline-events Alert uses it in either connection state; its offline lead-in is a
translator-controlled `<strong>` within the complete ICU message. Keep the sidebar offline
connection notice in its warning tone.

## App configuration

- Load branding, theme and flags from `GET /api/appConfiguration` before first render
  (`src/lib/app-configuration.ts`). Cache in localStorage; slow/missing servers fall back to
  cache, then defaults. `startApplyingAppConfiguration()` (`src/lib/apply-app-configuration.ts`)
  synchronizes title, favicon, preset tokens and light/dark class.
- `SYSTEM_SETTINGS` is off by default while the released backend lacks the endpoint.
  It is `deploymentOnly`, read solely from `config.json`, excluded from `ADMIN_FLAG_KEYS`
  so admins cannot disable Settings there. Dev also needs `public/config.json` to enable it.
- Deployment-name messages use `{appName}` and `useAppName()`, never hardcoded "OpenLMIS".
  References to the platform, such as "Powered by OpenLMIS", keep that name.
- Appearance uses `src/lib/appearance.ts`, never next-themes. Store user choice under `theme`;
  without a choice use the admin default. Read through `useResolvedAppearance()`.
- Settings tabs save with `useConfigurationSave`
  (`src/features/system-settings/hooks/use-configuration-save.ts`), retaining the draft's
  starting version. Refetches under edits cause conflicts instead of silent overwrites;
  preserve server-stored portions of multi-step saves.
- Read flags through `useFlag(key)` or `getFlag(key)` outside React. Precedence:
  administrator, deployment `config.json`, code default. `getDeploymentFlags()` has no
  `import.meta.env` fallback; dev gets defaults/admin values unless config supplies flags.
- `deploymentOnly` flags ignore administrator values and use deployment `config.json` or the
  code default. `CATCHMENT_POPULATION_CALC_AUTO` defaults off and must match the referencedata backend.

To add a flag, add its type/default/message keys to `FEATURE_FLAGS` (`src/lib/feature-flags.ts`)
and every locale; add its template entry in `docker/config.json.template`, export and
`envsubst` name in `docker/entrypoint.sh`, and variable in `docker-compose.yml`.

## Authentication

Login sends `POST /api/oauth/token?grant_type=password`. The service authenticates the client
first with `Basic base64(VITE_AUTH_SERVER_CLIENT_ID:VITE_AUTH_SERVER_CLIENT_SECRET)`, resolved
through runtime config. The persisted zustand store (`src/features/auth/store/login-data.ts`)
supplies bearer tokens to Axios and identity to router guards. `_protected.tsx` redirects
anonymous users to `/login?redirect=<page>`; login returns authenticated users through
`safeRedirect()` (`src/lib/redirect.ts`) or `/home`.

### Expiry and requests

- **A `401` keeps the page and drafts.** Axios marks the session `expired`, preserving user
  and refused token so legacy's old token cannot look new. Root `SessionExpiredDialog`
  asks the same user for a password when connected; offline editing remains available.
- Refused requests and new requests while expired await `waitForSession()`
  (`src/features/auth/lib/session.ts`), then replay once with the new token.
- Sign-out, another user signing in, or a refusal for an obsolete `sentFor` identity fails
  waits with `SessionEndedError`. Never resend as another user. A `401` for an already
  replaced token replays without treating it as a new expiry.
- Login/logout pass `session: false`, so their refusals do not open the dialog. Preserve
  explicit `Authorization`, including login's Basic header. Forgot/Reset Password use
  `anonymous: true`: no bearer and no session wait. Hide the dialog on `isSignInPage()` routes.
- Queries never retry `401`/`403`. Server expiry slides on calls: `expiresAt` from `expires_in`
  is only the earliest expiry, never a sign-out timer. Let `401` decide.
- Deliberate sign-outs call `useOfflineSignOut()` (`src/components/offline-sign-out.tsx`).
  It owns `whenLeaveAllowed`, flushing edits before counting device work and asking once.
  Never wrap its callback in another leave check. Offline re-login needs the server; a
  failed renewal connection offers Continue Offline even when the browser claims online.

### Shared-origin sessions

`syncLegacySession()` runs on boot/storage events for `openlmis.ACCESS_TOKEN`,
`openlmis.USER_ID` and `openlmis.USERNAME`. `syncOtherTab()` handles our persisted store's
storage events across `/v2` tabs. A live session restores itself when legacy wipes the
origin's localStorage on a `401`.

- Track `sessionSource` (`own`/`legacy`). Only borrowed legacy sessions follow legacy changes.
  Direct logins remain independent.
- Missing legacy keys expire borrowed sessions, preserving drafts; legacy clears keys on
  both sign-out and refused tokens.
- Token changes without id changes are ambiguous because keys are written separately:
  retain the previous token and expire until identity changes or dialog login succeeds.
- Id changes always advance identity, even with the same token. If id arrives first,
  expire under it until its token arrives. Retain the token's original id in
  `legacyTokenUserId`; neither write order may release requests with mismatched credentials.
- Borrowed usernames follow late writes too, so reauthentication uses the latest username.
- Tokens are shared between UIs, so our logout also signs out legacy and calls
  `clearLegacySession()`. Leave preferences such as `openlmis.current_locale` untouched.
- Login is one-way: never publish our token or any `openlmis.*` keys. Legacy needs its own
  login; publishing the token leaves its rights-guarded routes inaccessible. See the
  [deployment guide](docs/deployment/deployment.md) for evidence and SSO requirements.
- Access auth through the store, never direct localStorage reads.

### Identity isolation

- `src/integrations/tanstack-query.ts` clears all queries when the user changes, including
  sign-out, another login and legacy identity changes. Keys need no user id except actual
  per-user data such as rights.
- `_protected.tsx` hides/remounts routed content on identity changes, awaiting
  `router.invalidate()` to rerun loaders/rights/facility-program checks. External changes
  drop drafts without prompting. Deliberate navigation/sign-out uses discard guards;
  expiry and same-user renewal preserve drafts and loader data.
- Routed writes, including dialogs, use `useSessionMutation` (`src/hooks/use-session-mutation.ts`).
  It captures mounting identity, checks before/after work, suppresses stale callbacks and
  checks again when callbacks settle. After **every await**, including caught refetch failures,
  async completions call `isCurrent()` before fallback cache writes, form resets or callbacks.
  Features import this shared hook, never auth. Auth operations use ordinary `useMutation`.
- HTTP captures identity at request creation and checks before sending, after session waits
  and on responses. Reject obsolete `sentFor` before sending; stale successful reads must
  not continue multi-step saves as another user.
- Multi-request operations capture `getSessionScope()` and check before each request/batch.
  `settleFew` checks before/after each task and rejects on `SessionEndedError` or scope changes,
  clearing its queue. Ordinary item failures allow remaining tasks to finish.
- Error-path rollbacks also capture scope and call `assertSessionScope()` before cleanup.
  Already-sent writes may finish server-side with the original token; their results must
  never update the next user's page.

## Environment Variables

See `.env.example` and [README.md](README.md#environment-variables).

- Keep `VITE_API_BASE_URL` root-absolute (`/api`), shared with legacy outside the app prefix.
- `VITE_BASE_PATH` is compiled at build time; follow the base-path rules above.
- Per-environment settings use `src/lib/runtime-config.ts`, reading `config.json` written
  at container startup so one image works everywhere. OAuth credentials, default Issue and Receive
  reasons and both kit unpack reason ids fall back to `import.meta.env` for dev; feature flags
  deliberately do not.
  Never rely on build-time `import.meta.env` for deployment-varying runtime settings.

## Skills

Skills live in `.agents/` and `.claude/`; `skills-lock.json` pins external skills.
Read the applicable skill before using it.

| Skill | Use for |
|---|---|
| `plan-implementation` | Research legacy/ticket and write `plans/<KEY>.md` before code |
| `review-pr` | Parallel correctness, simplification, conventions, React/shadcn and legacy review; fix verified findings |
| `ticket-review` | Verify shipped acceptance criteria, comment and mark Done; never Epics |
| `new-ui-rollout` | Add, update or remove the UI on a server without downtime; prepare deployment PRs |
| `sync-translations` | Sync all catalogs after `en.json` changes |
| `test-audit` | Audit test value, redundancy and feedback cost |
| `shadcn` | Add, debug, style and compose shadcn components |
| `frontend-design` | Design and build new UI |
| `vercel-composition-patterns` | Compound components, render props and providers |
| `vercel-react-best-practices` | React performance review/refactors |
| `skill-creator` | Create or improve skills |

## Offline

Follow the [offline plan](docs/offline-plan/offline-plan.md). Adjustments supports offline
downloads, drafts, submission and recovery. Other stock screens follow in FM-166. Tickets with
offline criteria stay open until those criteria are met.

### Browser tests

- Specs import `test` from `tests/offline/browser-fixtures.ts`; persistent profiles use its
  `persistentContext` fixture so the selected engine, channel and base URL are respected.
  Create persistent profiles under `os.tmpdir()` and remove them after the scenario.
  Fixture handlers abort on exceptions before surfacing the failure. The preview server also
  refuses all `/api` requests independently of interception. Stock event POSTs must always be
  stubbed or blocked; a failed handler must never fall through to a backend.
- Vitest covers the no-Web-Locks fallback: coordinator/uploader stay disabled while online
  bundle reads remain available. The browser suite does not certify that fallback.
- Keep page URLs relative to `baseURL`, such as `./stock-management/adjustments`.
- Run `pnpm test:offline` (Chromium) during development and `pnpm test:offline:browsers`
  for the installed-engine matrix. Reproduction recipes belong in the ticket plan.
- Firefox removes request routes only while natively offline to preserve its worker cache,
  then re-dispatches online/offline events. This does not prove native reconnect events after
  navigation. WebKit skips must name the unavailable behavior and retain diagnostic evidence.

### Service worker

- Only `registerServiceWorker()` in `src/lib/service-worker.ts` registers the worker, once
  from `src/index.tsx` in production. Never use `virtual:pwa-register` hooks or register on mount.
  Keep scope and asset/catalog URLs under `BASE_URL`; use Dexie for business data, never API caches.
- Precache app assets and network-first runtime config/catalogs. Use `openlmis-ui-*` cache
  names to coexist with the legacy worker; `clientsClaim` controls the first visit. Fetch config
  and every supported catalog after takeover. Check updates hourly and notify all tabs.
- `applyUpdate()` activates/reloads only the requesting tab, or reloads if another tab already
  activated the worker.
- Reload calls `whenLeaveAllowed`, then `applyUpdate(allowUnload)`. Call `allowUnload()` just
  before reload to avoid a second prompt; retain guards if reload never comes. Verify offline
  behavior using a production build, not the dev server.

### Connection failures and notices

- Use `online.ts` hooks/helpers, never `navigator.onLine` outside that module. No-response
  network failures establish disconnection; cancellation, local absence and timeouts do not.
  Browser hints/retries request a probe rather than asserting server reachability. Keep probe
  backoff across public-probe success until a real API request succeeds; retries may replace
  a waiting timer but never overlap an active probe.
- Queries use `networkMode: 'always'`. Pass errors to `ErrorFallback` for pages/blocking
  loaders, `ListError` for paged boundaries, `LoadError` inside features without auth imports,
  `DialogLoadError` for dialogs and Home's `WidgetError` for widgets. They use `OfflineNotice`
  and `useOfflineFailure(error, retry)`; new retry views use the same hook for reconnect retries.
- Custom route errors use `ErrorFallback`; retry reseeds connection state and invalidates failed
  loaders before reset only while online. Pass `reportCaughtError` (`src/lib/report-error.ts`)
  to `createRoot` to suppress offline errors and log other caught errors with component stacks.
- `SidebarNotices` above footer buttons shows You're Offline (warning, persistent), You're Back
  Online (success, four seconds) and Update Available (info, Reload). `OfflineDot` marks the
  header menu while the sidebar is closed. Download and sync progress switch in place to
  success checks for four seconds: Offline Data Ready and Offline Events Synced. All timed
  notices share createNoticeCountdown with dismissal, and show a decorative tone-coloured
  draining edge bar. Hover/focus pauses both; resume with the exact remaining time. Collapse
  releases pauses; the rail has no bar. Reduced motion hides the bar while retaining timing. Publish sync
  completion only after a verified successful run leaves no pending queue rows or unresolved
  errors. No-op uploader passes preserve its timer. The announcer reads completion once from
  the notice; do not also announce individual acceptance as run completion. Spinners respect
  reduced motion. Download statuses carry their trigger through local and cross-tab updates;
  hide progress/completion for accepted-event `refresh` runs, retaining boot/force/retry notices.
  Coalesce queued triggers by force > retry > boot > refresh; refresh cannot silence visible work.
  Collapsed actions remain clickable with title/count tooltips.
  Auto-dismiss Alerts use countdown to isolate and clip the flush full-width bottom bar to
  the alert border radius. The decorative 2px fill inherits the notice tone; preserve the shared
  dismissal timer, hover/focus pause and reduced-motion behavior.
- While offline, You're Offline is the only connection notice. Suppress Sign In To Sync and
  connection-related Sync Paused notices and download failures with reason `offline`, including
  in StatusAnnouncer. Reconnecting may show a retained download failure again. Show sign-in again
  when connected if needed. Keep distinct capability, held-work, receipt-write and update notes.
- Visual notices are notes. The shell `StatusAnnouncer` is the single persistent live region;
  device saves and sync outcomes announce through it. Keep notice ids stable and cap/scroll
  the sidebar footer. Collapsed actions have translated action-first accessible names.

### Shell capabilities and identity

- `src/lib/offline-capability.ts` owns route capabilities, separately from downloaded readiness and
  rights. Connection-dependent navigation stays clickable offline, with a disconnected icon and
  accessible description. Use `useOfflineNavigation` for the shared Close-only AlertDialog,
  without navigation, native disabled states or connection tooltips. Use `data-unavailable`
  on SidebarMenuButton/SubButton, CommandItem and DropdownMenuItem to keep the previous
  dimmed appearance, cursor-default and no hover/active highlight while allowing focus and
  activation. Keep a neutral visible keyboard focus/selection ring in menus and the palette.
  Collapsed unavailable-item tooltips add the translated connection reason on its own line.
  Keep normal keyboard/menu navigation and the accessible connection description.
  Retain menu/palette context and restore focus on close. Keep collapsed-rail title/count tooltips; only connection-reason
  tooltips are removed. Block online-only direct routes/preloads before child loaders.
- An already-open server page may hide while retaining its draft/guards. Same-path changes
  reuse it only after a successful protected match for the current session scope. Hidden
  Dialog/AlertDialog portals retain drafts until a visible close; transient overlays close.
  DiscardChangesDialog opts out so navigation and logout decisions remain answerable.
- Guard Print/Refresh/server actions before work and after asynchronous permission reads.
  Use focusable disabled controls, tooltips and accessible descriptions.
- Logout flushes drafts, then counts owner-scoped unsynced work once and offers one combined
  retention/offline warning. Deduplicate event ids; exclude accepted/resolved work. Failed or
  bounded-out checks offer a neutral unknown-count warning. Confirmation is identity-scoped,
  closes on identity change and never deletes device work. Password changes use this path too.
- Offline expiry preserves editing without a blocking dialog. Sign In To Sync appears only
  with adjustment access or pending device work; a warning never expires auth on a timer.
  Session waits reject on connection loss, enabling device fallback without request replay.
- Route composition supplies shell device-work summaries/counting callbacks. Share subscriptions
  and avoid full event reads for users without adjustment rights or owned device work. Start
  offline services through dynamic imports after sign-in; clean up on unmount.

### Local data

- `getLocalDb()` opens one deployment/user database and closes it on identity change without
  deleting records. Preserve released schema data when upgrading. Keep development-version
  compatibility and migration evidence in the ticket plan, not coding guidance.
- Local data tests use `fake-indexeddb`; `src/tests/setup.ts` restores online state after each test.
- Only the coordinator publishes complete access/bundle generations under `offlineDownloadLock`.
  Online foreground reads never persist partial generations. Keep the upload lock separate.
- Use `onlineOrDevice` for fallback after unreachable reads, timeouts or non-JSON gateway
  errors. Definitive service errors/cancellations never fall back. Missing data uses
  `LocalDataUnavailableError`, never a server 404. Check session scope after async boundaries.
- `offlineAccessQuery` preserves device markers, bounds device freshness and makes saved access
  stale on reconnect before checking rights. `homeFacilityOptions` uses the stripped snapshot;
  whole-record `facilityOptions` reads remain server-only.
- Foreground bundle reads may join background downloads but retain ordinary renewal/replay;
  only coordinator downloads use fail-fast `backgroundRead`. Retain complete older bundles
  after refresh failure. Accepted events request nonblocking scoped refreshes.
- Scans consult saved mappings only when offline/unreachable. Absence in a complete scan-enabled
  bundle means not in local stock, never globally unregistered.

### Stock event device drafts

- Kind policies enable device drafts/downloads independently. Preserve the existing behavior of
  kinds whose offline pass has not shipped. Keep kind-specific routes/copy in configuration.
- Capture database owner/session scope. Check after awaits inside write transactions so stale
  operations roll back. Keep display snapshots and every typed `QuantityValue` text part.
- Enforce one editing draft per kind/facility/program. Compare draft id and revision for every
  durable transition; increment editing revisions. Conflicts stop writes until explicit Load or
  Copy. Subscriptions must never replace edits. Copy/Restore archive the active edits atomically.
- Use one serial autosave writer. Stage immediately for leave protection and flush before
  durable transitions/navigation/logout. Announce Saved On This Device only after commit.
  Failures remain visible during retries. Logout retains committed drafts.
  EventDraftStatus and archived-copy actions occupy the line toolbar end group before the
  quantity-unit toggle and View. Reserve the same status slot in pending/empty editors so
  controls stay anchored; narrow toolbars wrap the status above the controls. Keep the status
  a note and retain the shared announcement path without a second live region.
- Refresh resumed product/lot snapshots by identity while preserving typed text. Explain missing
  cards/invalid lots through the existing invalid-submit dialog and the kind's card policy.
- Offline submission never POSTs from the editor. Flush, validate, collect signature and atomically
  revision-check/freeze the draft with one immutable queue row. Preserve its exact body and unique
  localEventId; repeated confirmation reuses it. Queued drafts cannot autosave or be discarded.
- Uploader POSTs are serialized by the owner database's Web Lock. Without Web Locks automatic
  sync is disabled; never substitute a timeout lease. Fresh identity/session/connection-scoped
  access and exact grants precede dispatch. Missing grants pause work without inventing refusals.
- Queue transport never waits for renewal or replays a 401. Typed not-sent failures return to
  the original owner's queue and clear attempt metadata. Disable mutation retries. Teardown
  removes polling/listeners; successful passes and owner changes reset retry state.
- Commit sending status and attempt metadata before dispatch. Send oldest eligible work once.
  Sending/uncertain work blocks later events in that facility/program. Recover orphaned sending
  only under the upload lock. Draft mismatches pause for review; recheck pauses on later passes.
- A verified 201 UUID atomically saves receipt/accepted state and removes the queue row. Late
  results may persist only in the captured owner's database; never update the next user's UI.
  Receipt-write failures retry local persistence while holding the lock, never POST again.
- Definite service refusals retain original/error data. Recognized service 401 pauses until
  same-user renewal and fresh grants. Timeout, abort, gateway errors, unrecognized responses,
  crashes before receipt commit and post-dispatch scope failures stay uncertain. Never auto-resend.
- Unknown-result recovery checks exact owner/revision/status/attempt in one transaction.
  It Was Recorded writes a user receipt without POST; Send Again requires the duplicate warning
  and retains body/sequence/history. Stale decisions explain that the event changed.
- Refusal Copy For Correction makes an editable copy in one explained confirmation. Dismiss
  hides the refusal from review/counts while retaining audit data. Only never-attempted queued
  events may be deleted; remove the linked draft only if it still matches. Accepted receipt
  removal keeps the minimal duplicate-protection record as described below.
- Offline Events at `/offline-events` sits directly below Home in the shared nav source. Its
  badge counts queued, sending, uncertain and unresolved refused events, including held work;
  zero hides it, and the collapsed label/tooltip includes the count.
  SidebarMenuBadge collapsed="indicator" retains a logical-positioned dot on the rail icon. Count-only sidebar cards are
  omitted; StatusAnnouncer announces user queue saves plus uncertain and refused counts,
  without standing waiting counts on load or while sync reduces them. Share
  `isPendingDeviceEvent` between the shell summary and kind-specific picker counts.
- Offline Events uses one compact row per event: type, facility, program, occurred dates,
  status and View Details in the end-of-row menu. Offer Remove Event directly for never-attempted
  queued events, accepted events and refusals; omit it for sending/uncertain work. Refused removal
  dismisses without deleting correction copies. Accepted removal drops the local payload/draft,
  hides the row and keeps a minimal receipt for duplicate protection; explain that server stock
  is unchanged. Use session-scoped mutations and focus the list after removal. Hide facility/program
  by measured width; stored View choices override defaults. Below 672px use type/View Details bands and rows for
  facility, program, date and status. Card bands use aria-labelled icon-sm actions without tooltips: destructive
  trash before outline Eye/View Details. Reserve the trash slot when removal is unavailable.
  Table menu View Details has EyeIcon; Remove Event uses destructive and Trash2Icon. Every
  destructive removal uses a confirmation AlertDialog, including the details footer.
  Line details appear only in the Event Details dialog.
  Share descriptive action labels and EventStatus badges across list/cards/dialog: accepted
  success/check, queued info/clock, sending info/spinner with reduced motion, uncertain warning
  and refused destructive. Preserve pagination, sorting and live status filtering through Filters.
  Event Details uses DialogContent size="xl" (48rem). Its compact metadata and footer stay
  fixed while only the lines/recovery context scrolls. Its title has no visible subtitle or separate
  status. Keep a meaningful screen-reader-only description, and wrap the status badge beside the
  Pending Event value.
  Dialog metadata uses SettingsList density="compact"/SettingsItem and omits empty rows.
  Its lines use a bordered compact table with blank missing cells, one-line headers and vertical
  dividers. Show Reason Comments/VVM only when at least one line has a value;
  below 672px measured within the dialog, use flat product-band cards with settings rows.
  DialogFooter wrap puts Transaction History (outline) and recovery actions before the final
  primary Close button in DOM order. Recovery actions are outline; Remove Event uses the
  standard destructive Button with Trash2Icon and shared removal confirmation. Set initial
  focus to Close, never a destructive action.
  History is an outline footer link with no preload or wrapping height override. Stock Card
  links use the same offline dialog behaviour. Lot cards use break-all so fitting codes stay
  intact and long codes break anywhere, preserving copied hyphens. The table keeps codes nowrap.
  Recovery dialogs live in URL search via `useSearchNavigation`/`CLOSED_DIALOGS`, retaining their
  target during close; missing events use DialogNotFound. Unknown reason ids stay blank in tables.
- Offline Events/nav require adjustment rights or owned non-accepted work. Non-sending recovery
  stays available without adjustment rights; Send Again still needs its scoped grant. History
  links require exact viewing rights, no preloading and a connection explanation when offline.
  Receipt metadata appears only for receipts. Never expose raw transport JSON or saved revisions.
- Prune only accepted receipts/drafts. Keep queue rows, refusals, sync errors and archived copies.
  Queue-save announcements retain their own count; the nav count includes held work.
  Offer Review once on the most severe substantive note. Sign In To Sync
  leaves reauthentication to SessionExpiredDialog. Timing/retention values and sequencing
  evidence belong in the ticket plan.
- Stock event program pickers show no download readiness column. Pending work for the kind
  appears in an offline Alert with a bolt icon and Offline Events link. Copy follows connection
  state and uses one complete ICU message with a translated link through `Trans`, plurals
  and a kind select with proper singular/plural nouns in each language. Pass the raw kind
  identifier to the ICU select. Use a named tag such as `eventLink`; HTML `link` is a void tag.
  Keep generic picker status support for inventories.

- SignatureDialog puts Submitted By below Signature as TextField description, linked by the
  field's aria-describedby. Use one ICU Trans message with a strong component around the raw
  username; IsolatingICU handles RTL. Keep the title and omit the header description.
