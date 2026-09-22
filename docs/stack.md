# Stack

Why each dependency is here. Versions are the major line; `package.json` is authoritative.

## Core

| Package | Version | Rationale |
|---|---|---|
| [react](https://react.dev) | 19 | UI library |
| [react-dom](https://react.dev) | 19 | React DOM renderer |
| [typescript](https://www.typescriptlang.org) | 7 | Static type checking |
| [vite](https://vite.dev) | 8 | Build tool and dev server (Rolldown bundler) |
| [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react) | 6 | React Fast Refresh + JSX transform via Oxc |

## Routing and server state

| Package | Version | Rationale |
|---|---|---|
| [@tanstack/react-router](https://tanstack.com/router) | 1 | Type-safe file-based routing with loaders |
| [@tanstack/router-plugin](https://tanstack.com/router) | 1 | Vite plugin for auto code-splitting and route tree generation |
| [@tanstack/react-query](https://tanstack.com/query) | 5 | Server state management, caching, synchronization |
| [@tanstack/react-query-devtools](https://tanstack.com/query) | 5 | Browser devtools for Query cache inspection |
| [@tanstack/react-router-devtools](https://tanstack.com/router) | 1 | Browser devtools for route inspection |
| [zustand](https://zustand.docs.pmnd.rs) | 5 | Auth state, persisted to `localStorage` and readable outside React (axios interceptors, route guards) |

## HTTP

| Package | Version | Rationale |
|---|---|---|
| [axios](https://axios-http.com) | 1 | HTTP client with interceptors for auth tokens and global error handling |

## Internationalization

| Package | Version | Rationale |
|---|---|---|
| [i18next](https://www.i18next.com) | 26 | i18n framework - interpolation, fallbacks, language switching |
| [react-i18next](https://react.i18next.com) | 17 | React bindings - `useTranslation`, context, re-render on language change |
| [i18next-icu](https://github.com/i18next/i18next-icu) | 2 | ICU MessageFormat - plurals, selects, number/date formatting |
| [i18next-browser-languagedetector](https://github.com/i18next/i18next-browser-languageDetector) | 8 | Detects language from localStorage / browser |
| [i18next-http-backend](https://github.com/i18next/i18next-http-backend) | 4 | Loads catalogs from `public/locales/` at runtime |

## Forms and validation

| Package | Version | Rationale |
|---|---|---|
| [@tanstack/react-form](https://tanstack.com/form) | 1 | Headless, type-safe form state with field-level validation |
| [zod](https://zod.dev) | 4 | Schema validation, used as the form validator and for parsing API payloads |

## Styling

| Package | Version | Rationale |
|---|---|---|
| [tailwindcss](https://tailwindcss.com) | 4 | Utility-first CSS framework |
| [@tailwindcss/vite](https://tailwindcss.com/docs/installation/vite) | 4 | Native Vite plugin for Tailwind |
| [tw-animate-css](https://github.com/magicuidesign/tw-animate-css) | 1 | Tailwind animation utilities, Tailwind v4 compatible |

## UI components

| Package | Version | Rationale |
|---|---|---|
| [shadcn](https://ui.shadcn.com) | 4 | CLI for generating accessible, customizable UI components |
| [@base-ui/react](https://base-ui.com) | 1 | Headless accessible primitives (used by shadcn v4) |
| [lucide-react](https://lucide.dev) | 1 | Tree-shakeable SVG icon library |
| [class-variance-authority](https://cva.style) | 0.7 | Type-safe component variant API |
| [cn](https://github.com/shadcn-ui/cn) | 0.3 | Conditional className joining plus conflict-free Tailwind merging, replacing clsx + tailwind-merge |

Peers required by specific shadcn components, loaded only where that component is used:

| Package | Used by | Rationale |
|---|---|---|
| [cmdk](https://cmdk.paco.me) | Command | Command menu (Ctrl+K) |
| [next-themes](https://github.com/pacocoursey/next-themes) | Theme toggle | Dark / light / system switching |
| [sonner](https://sonner.emilkowal.ski) | Toast | Toast notifications |

Adding a shadcn component that needs another peer (charts, calendar, drawer) installs it at
that point via `pnpm dlx shadcn@latest add <component>`.

## Fonts

| Package | Rationale |
|---|---|
| [@fontsource-variable/geist](https://fontsource.org/fonts/geist) | Primary sans-serif, self-hosted |
| [@fontsource-variable/roboto](https://fontsource.org/fonts/roboto) | Secondary font, self-hosted variable |
| [@fontsource-variable/noto-sans-arabic](https://fontsource.org/fonts/noto-sans-arabic) | Arabic script coverage. Sits behind Geist in the `--font-sans` stack, so `unicode-range` keeps LTR users from downloading it |

## Tooling

| Package | Rationale |
|---|---|
| [@biomejs/biome](https://biomejs.dev) | Linter, formatter and import sorter, replacing ESLint + Prettier |
| [oxlint](https://oxc.rs/docs/guide/usage/linter) | Host for the `@shadcn/lint` plugin, every built-in category disabled |
| [@shadcn/lint](https://github.com/shadcn-ui/lint) | Design-system rules - blocks restyling shadcn components, raw colors, arbitrary values, unknown classes |
| [vitest](https://vitest.dev) | Test runner, shares the Vite config and transforms |
| [happy-dom](https://github.com/capricorn86/happy-dom) | DOM environment, faster than jsdom |
| [@testing-library/react](https://testing-library.com/docs/react-testing-library/intro) | Component testing by user interaction |
| [@testing-library/jest-dom](https://github.com/testing-library/jest-dom) | DOM assertion matchers |
| [@testing-library/user-event](https://testing-library.com/docs/user-event/intro) | Realistic interaction simulation |
| [lefthook](https://lefthook.dev) | Git hooks - pre-commit runs Biome, sort-messages and typecheck on staged files; pre-push runs the full suite |
| [@total-typescript/ts-reset](https://github.com/total-typescript/ts-reset) | Stricter built-in types (`.filter(Boolean)` narrows, `.json()` returns `unknown`) |

Plus `@types/node`, `@types/react` and `@types/react-dom`.

## Build output

`vite.config.ts` splits large, stable libraries (React, TanStack) into separate vendor
chunks so browsers keep them cached when only app code changes. Smaller packages stay in
the default chunk, where splitting would cost more in extra requests than it saves.
