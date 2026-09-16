# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `/new-project` demo route - single-screen form showcasing shadcn field primitives wired through TanStack Form + Zod:
  - Paired Input / InputGroup name + slug row with auto-slugification until the slug is manually edited; `app.soldevelo.com/` prefix addon and `USD` suffix addon on the budget InputGroup.
  - Card-style radio groups for priority (2-column) and visibility (3-column) using the documented `FieldLabel has-data-checked:*` hooks.
  - FieldSet + FieldLegend multi-checkbox `notifyOn` array field with per-option descriptions.
  - Cross-field `dueDate >= startDate` rule enforced both live (disabled-date matcher reading the peer via `useStore`) and on submit (combined-schema `superRefine`).
  - CardFooter Reset + Save pair; Reset clears the form and the slug-touched flag.
- `/stock-movement` demo route - 4-step wizard (Type / Locations / Items / Review) backed by a single `useForm` instance:
  - Per-step Zod validation via `stepSchemas` + `setFieldMeta(errorMap.onSubmit)` gate.
  - Card-style movement-type radio; `REF-` prefix InputGroup on the reference code; FieldSet multi-checkbox handling tags (Fragile / Refrigerated / Hazmat / Priority).
  - Signature-required Switch with FieldContent description on the locations step.
  - Array field for items with per-row unit suffix (`pcs`, `kit`, `m`, `box`) read live from the selected SKU; array-level errors (min 1, unique SKU).
  - Read-only review step with jump-to-edit buttons per section.
  - CardFooter Back / Reset (shown when dirty) / Submit actions, mobile-first stacked.
- Generic `Stepper` component (`src/components/stepper.tsx`) - props-only API, three responsive tiers (compact + progress under `@sm/main`, indicators-only under `@md/main`, full labels above), keyboard-navigable completed steps, no internal state.
- Shared `DateField` component (`src/components/date-field.tsx`) - `Popover` + `Calendar` + `Button` composition per shadcn's documented recipe, ISO `YYYY-MM-DD` value contract with timezone-safe `parseISO` / `format(d, 'yyyy-MM-dd')` conversion, `disabled` matcher passthrough, accepts `ariaInvalid` for field error styling.
- Shared `RadioCardGroup` component (`src/components/radio-card-group.tsx`) - generic over the option value type, each option rendered as a selection card that tints on check via the shadcn `FieldLabel has-data-checked:*` pattern, hover affordance, 1 / 2 / 3 column layouts with responsive intermediates, optional per-option icon and description.
- Shared `ConfirmResetButton` component (`src/components/confirm-reset-button.tsx`) - `AlertDialog`-gated Reset trigger with destructive confirm action; used by both forms so a misclick can't wipe a long form or a multi-step wizard.
- New `Forms` sidebar group with localized entries (`nav.forms`, `new-project.title`, `stock-movement.title`) for both routes.

### Changed

- Redesigned `Stepper` (`src/components/stepper.tsx`) per the new inspiration: each step is a square icon card with a step-specific lucide icon, "STEP N" kicker, label, and status badge (Completed / In Progress / Pending) using only shadcn default variants (`default` / `secondary` / `outline`). Three responsive tiers: compact Progress bar under `@sm/main`, icon cards without badges between `@sm` and `@md`, full layout at `@md+`. `StepMeta` now requires an `icon: LucideIcon`.
- New-project form sectioned into Classification / Schedule / Access groups via `FieldSeparator` labels for clearer visual hierarchy; `acceptTerms` refactored so the "project terms" link is a sibling `<a>` in `FieldDescription` rather than a `<Button>` nested in the checkbox's `<label>` (the nested-button pattern caused label-triggered checkbox toggling on link click).
- Review step (`step-review.tsx`): each summary section now its own bordered card with a small-caps category label, instead of three sections sharing one tinted panel.
- Empty-items state (`step-items.tsx`) upgraded from a bare `text-xs` line to a centered `PackageIcon` + `text-sm` prompt.
- `DateField` trigger gained a `hover:bg-muted/40` so it no longer reads as a disabled input.
- Combobox empty states (owner / warehouse / SKU) now render a centered `SearchXIcon` + label instead of a bare sentence.

### Removed

- Custom `--info` / `--success` / `--warning` design tokens (and their `-foreground` pairs) from `src/globals.css`, plus the matching `info` variant on the shadcn `Alert` component. Nothing in the template depends on a status palette beyond what `primary` / `secondary` / `destructive` / `muted` already provide, and the extra tokens drifted from the shadcn base style. The login demo-mode alert now uses `Alert`'s `default` variant.

Initial release of the SolDevelo React template.

### Added

#### Core stack

- React 19 + TypeScript 6 + Vite 8 (Rolldown bundler)
- TanStack Router for type-safe file-based routing with loaders
- TanStack Query for server state with Suspense-first integration
- Axios HTTP client with documented request/response interceptor extension points
- Tailwind CSS v4 + shadcn/ui (base-lyra preset)
- Zod for runtime schema validation

#### App shell & UX

- `AppShell` layout with offcanvas collapsible sidebar, header, and content area
- Grouped navigation (driven by `NAV_GROUPS` in `src/lib/config.ts`), active state via `useLocation`
- Theme switcher (next-themes) with light/dark logo variants
- Language switcher with radio-group dropdown
- Latest-change announcement card with dismiss action
- Sonner `Toaster` mounted at root
- Global error boundary via TanStack Router's `defaultErrorComponent`
- Loading states: inline `PendingFallback` for content loads, full `AppShellSkeleton` for layout loads
- 404 page using shadcn `Empty` component

#### Internationalization

- i18next with ICU MessageFormat for plurals and selects
- English and Polish bundled translations (flat JSON, ~20 keys)
- Automatic language detection with localStorage persistence
- Type-safe `t()` calls via module augmentation - `tsc` catches typos
- Keys auto-sorted alphabetically by `pnpm sort-messages` and pre-commit hook
- `SUPPORTED_LANGUAGES` as the single source of truth in `src/lib/config.ts`

#### Data layer

- `AbortSignal` propagated through `queryFn` to axios for request cancellation
- Query options pattern (`usersListOptions`, `userDetailOptions`) consumed by route loaders
- `QueryClient` defaults tuned: `retry: 1`, `refetchOnWindowFocus: false`, mutations `retry: 0`
- Router `defaultPreload: 'intent'` for hover-based prefetching

#### Developer experience

- Biome for linting, formatting, and import sorting (replaces ESLint + Prettier)
- Vitest + React Testing Library on happy-dom
- Lefthook pre-commit hooks: Biome check, translation key sorting, typecheck
- Lefthook pre-push hooks: full Biome check, typecheck, test suite
- `.editorconfig` for file types Biome doesn't touch (Markdown, YAML, HTML)
- VS Code recommended extensions: Biome, Tailwind CSS IntelliSense
- Path aliases (`@/*` → `src/*`) across TypeScript and Vite

#### CI/CD & automation

- GitHub Actions workflow with three parallel jobs (lint, test, build)
- Concurrency group cancels outdated runs on new commits
- Renovate configuration with package grouping by ecosystem (React, TanStack Query, TanStack Router, Biome, Vite, Vitest, Tailwind, Internationalization, Testing Library)
- Weekly `lockFileMaintenance` on Monday mornings
- Semantic commit format: `chore: update dependency X to vY`

#### Testing examples

- Colocated hook tests (`use-debounce`, `use-mobile`)
- Example component test (`user-card.test.tsx`) demonstrating RTL accessibility queries
- Example query options test (`queries.test.ts`) covering the code path route loaders hit via `ensureQueryData`

#### Claude Code integration

- `CLAUDE.md` with architecture overview, conventions, and command reference
- Bundled skills: `shadcn`, `frontend-design`, `skill-creator`, `vercel-react-best-practices`
- Custom `sync-translations` skill - propagates new keys in `en.json` to other language files, removes stale keys, preserves existing translations
