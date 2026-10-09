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
supervisory nodes, roles, products, stock organizations and reasons. It imports no other
feature. Keep management screens in their own features. When their list uses a lookup's
endpoint, reuse that query and widen its type, as Roles and Reasons do.

- Product lookups: `orderablesSearchOptions`, `orderablesByIdsOptions` and
  `orderablesByTradeItemsOptions`, all under `queryKeys.orderables.list` so saves refresh them.
  Trade-item lookups keep only each product's latest version from the server's version list.
- `fetchOrderablesByIds` and `fetchLotsByIds` send at most 100 ids per request and read every
  page, avoiding oversized URLs.
- `userRecordOptions` and `userProgramsOptions` read the signed-in user's record and programs;
  keep their keys separate from the Users page's richer detail.
- `validDestinationsOptions` reads every page through `fetchValidAssignments`, under
  `queryKeys.validDestinations.all` so admin saves refresh it; Receive's valid sources reuse
  the fetcher. `reasonsOf` keeps visible reasons of one category and, optionally, one type.
- Stock event screens read legacy's v2 stock list and resolve its cards' products and lots
  through the id lookups above.

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
fits odd tab counts; `wrap="md"` fits short labels.

`src/components/ui/` defines the variants and is excluded from design-system and Biome
linting. Editing these generated files is expected here.

**Preset changes and `shadcn add` overwrite customizations.** Run `pnpm tsc --noEmit` and
reapply missing variants to the new files. Preserve `DialogCloseLabelProvider` in
`dialog.tsx`, supplied by the root route with translated close-button text. Also check these
edits, which have no prop for TypeScript to detect:

| File | Required customization |
|---|---|
| `checkbox.tsx` | Indeterminate minus in checked colors; dim on Base UI's `data-disabled` |
| `calendar.tsx` | Pass `CalendarDayButton`'s ref to `Button` for keyboard focus |
| `select.tsx` | Default `alignItemWithTrigger` to `false` |
| `button.tsx` | Dim both `data-disabled` and `:disabled`, including `focusableWhenDisabled` |
| `sonner.tsx` | Use `useResolvedAppearance()` from `src/lib/appearance.ts`; no next-themes |
| `chart.tsx` | Lay out SVG LTR so Arabic labels fit their gutter; localize tooltip numbers |
| `avatar.tsx` | Overlap `AvatarGroup` with logical `-ms-2`, not `-space-x-2` |
| `combobox.tsx` | Keep `ComboboxChip` at `max-w-full min-w-0` so long tags truncate |

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
  one-sentence `WorkspaceDescription`; omit unused icons/actions. `Workspace` and
  `WorkspaceFooter` accept `width="narrow"` for settings or short stock-program tables.
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
  Search By Code and Search By Name.
- Keep the toolbar outside `QueryBoundary`. Rows read `useDeferredValue(search)`;
  first load shows `DataTableSkeleton`, later requests keep dimmed existing rows until ready.
  Filter typing replaces history; paging/sorting add entries for Back navigation.

**Responsive tables:**

- Use content width, never viewport breakpoints such as `md:`. Define lower-priority columns
  with `hideBelow` (container size or pixels) or `defaultHidden`; see `USER_HIDEABLE_COLUMNS`.
  Combine `useElementWidth()`, `useColumnVisibility()` and `useStoredState`. User choices
  override defaults; Reset Columns clears them. Share visibility across table, skeleton and
  View menu.
- Column widths (`meta.className`) and toolbar use `Workspace`'s `@container/main`, such as
  `@xl/main:w-2/5` and `@2xl/main:w-72`. Pagination uses the card's `@container/table`: current
  page plus up to three on each side, only current on narrow tables. Links accept sizes 1-100.
- Keep tables at every width, never stacked cards. Hide lower-priority columns and allow
  sideways scrolling on phones. Keep headers on one line.
- Missing values use `orEmpty`/`EMPTY_VALUE` (`src/lib/empty-value.ts`). Inapplicable cells,
  such as a product row's lot, stay blank.
- Identifying/actions columns stay visible and out of View. Other columns, including status,
  may hide. Row actions use an end-of-row "..." menu at every width.
- Put Create at the toolbar's end, after View.

**Filters and states:**

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
- Render `DataTableSelectionBar` after the table with count, Clear and actions. Selection
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
  `Table density/layout`, `TableHeader surface`, `DropdownMenuContent width`, `Button width`,
  `ComboboxInput width/clearLabel`, `Skeleton fill`. These become plain `className`s in the
  registry. `selectionColumn` ships the checkbox's indeterminate-minus customization too.
- Text comes from `DataTableLabelsProvider` (English defaults); the shell's
  `TranslatedDataTableLabels` supplies `data-table.*` translations.
- `DataTable` and `DataTableSkeleton` share column metadata: `density="comfortable"` by
  default, `default` for compact tables needing room; `layout="fixed"` by default, `auto`
  for content-sized columns such as bin cards.
- URL/table state stays in `src/lib/table-search.ts` as app glue.

TanStack Table is **v9**: use `useTable` and `dataTableFeatures`, never v8 `useReactTable`.
Version-matched guides live in `node_modules/@tanstack/react-table/skills/`.

## Forms and dialogs

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

**Whole-record saves require fresh reads:**

- Edit Facility passes fresh `saved` data to `src/features/facilities/components/facility-editor.tsx`.
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
| `TextField`, `TextareaField`, `PasswordField` | Text, multiline text and passwords |
| `NumberField` | Keep typed text; validate `wholeNumberText` (`src/lib/whole-number.ts`), including Arabic/Persian digits; read with `toWholeNumber` |
| `QuantityField` | Keep doses, packs and remainder text in `QuantityValue` across unit switches; submit doses |
| `DecimalField` | Validate `decimalText` (`src/lib/decimal.ts`); read with `toDecimal`; display with `toNumberText(value, decimalMark(language))` |
| `SwitchField` | Yes/no as one row: label/info at start, switch at end; never a checkbox |
| `MultiComboboxField` | Multiple choices as chips, never a checkbox column |
| `TagsField` | Enter/Tab/blur takes the highlighted suggestion or typed text; comma adds typed text; `minLength`/`maxLength` failures show a message |
| `SelectField` | One choice from a short fixed list; opens below input (`alignItemWithTrigger: false`) |
| `ComboboxField` | Searchable choices; item `description` appears muted after label |
| `ImageField` | `undefined` keeps saved image, `null` removes it, `File` replaces it; validate `onChange` immediately |
| `DateField` | Page-language calendar; draft is `yyyy-MM-dd` or empty; optional dates get `clearLabel` |
| `RadioGroupField` | `variant="tile"` for option grids, `variant="segmented"` for 2-3 short options, `columns="row"` for cards side by side when room permits |

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
`DialogTitle size`, `Field spacing`, `FieldLabel weight`, `ComboboxInput width/clearLabel`,
`ComboboxChip removeLabel`, `RadioGroup columns`, `SelectTrigger width`, `Button align/width`,
`PopoverContent width/padding`.

**Every toast has a short Title Case title and a detail sentence as `description`**, displayed
at most two lines. `Toaster` supplies the translated close button; callers never pass one.

## Barcode scanning

Behind `GS1_SCANNING`, compose `useBarcodeScan` and `ScanStatus`. The GS1 parser and stock
resolver live in `src/lib/`. Pause while dialogs are open, check cancellation before applying
pending results, and abort on unmount. Each screen supplies its own lot policy.

## Facility and program picker

Facility/program screens use `FacilityProgramSelector` (`src/components/facility-program-selector/`).
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
Both use `src/components/discard-changes-dialog.tsx`. Reload/tab close uses only the
browser's native prompt. External identity changes follow Authentication below.

**Charts:** use Recharts through `ChartContainer` and theme ramp `--chart-1`..`--chart-5`,
one hue light-to-dark, checked for even steps/contrast in both modes. Use the ramp in order
for ordered data. Status uses `success`, `warning`, `destructive` plus icon and label;
never color alone.

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

To add a flag, add its type/default/message keys to `FEATURE_FLAGS` (`src/lib/feature-flags.ts`)
and every locale; add its template entry in `docker/config.json.template`, export and
`envsubst` name in `docker/entrypoint.sh`, and variable in `docker-compose.yml`.

## Authentication

Login sends `POST /api/oauth/token?grant_type=password`. The service authenticates the client
first with `Basic base64(VITE_AUTH_SERVER_CLIENT_ID:VITE_AUTH_SERVER_CLIENT_SECRET)`, resolved
through runtime config. The persisted zustand store (`src/features/auth/store/login-data.ts`)
supplies bearer tokens
to Axios and identity to router guards. `_protected.tsx` redirects anonymous users to
`/login?redirect=<page>`; login returns authenticated users through `safeRedirect()`
(`src/lib/redirect.ts`) or `/home`.

### Expiry and requests

- **A `401` keeps the page and drafts.** Axios marks the session `expired`, preserving user
  and refused token so legacy's old token cannot look new. Root `SessionExpiredDialog`
  asks the same user for a password.
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
- Deliberate sign-outs use `useOfflineSignOut()` (`src/components/offline-sign-out.tsx`)
  before `whenLeaveAllowed`; offline re-login needs the server, so ask first. A failed
  server connection counts as offline even when the browser claims online.

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
  at container startup so one image works everywhere. OAuth credentials fall back to
  `import.meta.env` for dev; feature flags deliberately do not. Never rely on build-time
  `import.meta.env` for deployment-varying runtime settings.

## Skills

Skills live in `.agents/` and `.claude/`; `skills-lock.json` pins external skills.
Read the applicable skill before using it.

| Skill | Use for |
|---|---|
| `plan-implementation` | Research legacy/ticket and write `plans/<KEY>.md` before code |
| `review-pr` | Parallel correctness, simplification, conventions, React/shadcn and legacy review; fix verified findings |
| `ticket-review` | Verify shipped acceptance criteria, comment and mark Done; never Epics |
| `sync-translations` | Sync all catalogs after `en.json` changes |
| `test-audit` | Audit test value, redundancy and feedback cost |
| `shadcn` | Add, debug, style and compose shadcn components |
| `frontend-design` | Design and build new UI |
| `vercel-composition-patterns` | Compound components, render props and providers |
| `vercel-react-best-practices` | React performance review/refactors |
| `skill-creator` | Create or improve skills |

## Offline

Follow the [offline plan](docs/offline-plan/offline-plan.md). The foundation exists; stock
screens ship online first, then offline data/drafts. Tickets with offline criteria stay open
until those criteria are met.

### Service worker

- `vite-plugin-pwa` in `vite.config.ts` precaches `**/*.{js,css,html,png,svg,woff2}` at
  `BASE_URL` scope. Runtime-cache only `config.json` and `locales/*.json`, network-first,
  so deployments can correct strings/OAuth config without rebuilding.
- Never cache `/api` or other data in the worker; use Dexie. Cache names are `openlmis-ui-*`
  to coexist with legacy's root worker. `clientsClaim` controls the first visit.
- Only `registerServiceWorker()` in `src/lib/service-worker.ts` registers it, once from
  `src/index.tsx` in production. Once it controls the page, fetch config and every
  `SUPPORTED_LANGUAGES` catalog for offline use. Check updates hourly and notify all tabs
  through `useUpdateReady()`.
- `applyUpdate()` activates/reloads only this tab on takeover, or reloads if another tab
  already activated the worker. Never use `virtual:pwa-register` hooks; they register per
  mount and reload all tabs.
- Dev never registers it. Verify with `VITE_BASE_PATH=/v2 pnpm build` then
  `VITE_BASE_PATH=/v2 pnpm preview`; preview proxies `/api` too. Copy `config.json` into `dist/`
  first, or preview serves HTML for it.

### Connection failures and notices

- Queries use `networkMode: 'always'` to fail immediately offline. `seedOnline()` seeds boot
  state; TanStack otherwise only hears online/offline events. Use `src/lib/online.ts`:
  `useOnline()`, `isOnline()`, `useOnReconnect()`, `useBackOnline()`. Never read
  `navigator.onLine` directly.
- No-response failures (`isOfflineError`) show "Connect To Download This Data" through
  `useOfflineFailure(error, retry)`, which retries on reconnect. Use `OfflineNotice` through
  `ErrorFallback` for pages/blocking loaders; `ListError` for server-paged boundaries (also
  No Access); `LoadError` inside features without auth imports; `DialogLoadError` or Home's
  `WidgetError`, passing the error. New retry views use the same hook.
- Custom route errors render `ErrorFallback` with title/description. Its retry calls
  `router.invalidate()` before `reset()` to rerun failed loaders. `reportCaughtError`
  (`src/lib/report-error.ts`), passed to `createRoot`, suppresses offline errors and logs other
  caught errors with component stacks.
- `SidebarNotices` above footer buttons shows You're Offline (warning, no close), You're Back
  Online (success, 4 s), and Update Available (info, Reload). Collapsed rail: tooltip icons,
  only Reload clickable. `OfflineDot` marks the header menu when the sidebar is closed.
- Visual notices are notes, never live regions. Header `StatusAnnouncer` is the single
  always-mounted `role="status"` so announcements survive sidebar visibility changes.
- Reload uses `whenLeaveAllowed`, then `applyUpdate(allowUnload)`. Run `allowUnload()` just
  before reload to avoid a second browser prompt; the guard stays active if reload never comes.

### Local data

Use Dexie with one database per deployment/user. `getLocalDb()` (`src/integrations/local-db.ts`)
opens `openlmis-ui:<deployment>:<userId>` for the signed-in user, closes on identity change or
sign-out, and never deletes it. Screens add tables with a new `version()`. Offline reads
return data, unavailable or a handled error; local absence is never a server 404. Tests use
`fake-indexeddb`; `src/tests/setup.ts` restores online state after each test.
