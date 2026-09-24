---
name: review-pr
description: Review an openlmis-ui pull request's diff with five reviewers in parallel - correctness, simplification, project conventions, React/shadcn best practices, and a side-by-side comparison with the legacy OpenLMIS UI so nothing regresses for users - then verify each finding, fix what is real, and get the PR ready to merge. Use whenever the user asks to review a PR or a branch, "run the review again", "code review and code simplify", "check our conventions", "check for regressions against the old UI", or "make sure the PR is ready to merge", even if they don't name the skill.
---

# Review PR

Every change to this app is reviewed against its PR diff, never against the whole
codebase. Five reviewers run in parallel because they look for different things, and none
of them is allowed to report a finding it has not checked.

The bar for the new UI is higher than "works": every screen in it must do at least
everything its legacy counterpart does, and feel clearly better doing it.

## 1. Pin down the diff

1. Find the PR: the number the user gave, or `gh pr view --json number,url,headRefName,baseRefName`
   for the current branch. With no PR, review the branch against `master`.
2. Get the diff with `gh pr diff <n>` (or `git diff origin/master...HEAD`) and the changed
   files with `gh pr diff <n> --name-only`.
   `gh pr view <n> --json title,body,commits` gives the description and commit messages
   the conventions reviewer checks. The ticket key in the description or branch
   (`feat/fm-14-...` is `FM-14`) names the plan, `plans/<KEY>.md`; every reviewer reads it.
3. `git status -s`: uncommitted changes are not in the PR. Commit or stash them first, or
   say they are out of scope. Do not edit files while reviewers run; they read the tree
   and would review a moving target.
4. Run the gates once here, so reviewers get the results instead of each re-running them:
   `pnpm tsc --noEmit`, `pnpm lint`, `pnpm lint:ds`, `pnpm test:run`, `pnpm build`. Avoid
   `pnpm check` at this stage, since it rewrites files.
5. List the screens the diff touches (routes under `src/routes/`, features, shared
   components) and, for each, its legacy counterpart. The legacy UI lives under
   `/#!/...` on the instance `VITE_API_PROXY_TARGET` points at, e.g.
   `/#!/administration/users`.
6. Start `pnpm dev` if a browser check is needed, and read the port from its output.

## 2. Launch the five reviewers in parallel

Send all five `Agent` calls in a single message, each running in the background. Give
every reviewer the same brief:

- PR number, URL, base and head branch, the diff command, and the changed-file list
- The gate results from step 1
- The screens touched and their legacy URLs
- The plan file, `plans/<KEY>.md`, when there is one, and the legacy screenshots taken
  while planning, in `.screenshots/<KEY>/`. The plan is the baseline: its API map,
  server-side work and browser checks say what was intended, and its drops are deliberate
- AGENTS.md is the rulebook; read it first
- The **browser rules** below, copied verbatim
- Return findings only, most severe first, each with: `file:line`, a one-sentence
  defect, a concrete failure scenario (inputs or steps, then the wrong result), and the
  evidence that confirmed it (code path read, test run, browser observation). Say
  "nothing found" rather than padding the list. Change no files and do not commit.

### Reviewer A: correctness

Hunts for real bugs introduced by the diff: wrong logic, off-by-one, broken edge cases
(empty, zero, one, many, missing fields), race conditions, stale cache, unhandled errors,
leaks, wrong query keys, loaders that block when they should defer (or the reverse),
suspended subtrees without a boundary, rights gating that shows or hides the wrong thing,
auth and session flows (sign in, sign out, 401, user switch, legacy session sync), URL
state that breaks Back or a shared link. It traces each suspicion through the code and
reproduces it in the browser or with a test before reporting. It runs the plan's
browser checks and confirms that earlier fixes on the branch still hold.

### Reviewer B: simplify

Looks for code that is harder than it needs to be: duplication, dead or unused exports,
helpers that already exist in `src/lib/` or `src/components/`, needless state or effects,
abstractions with one caller, props nobody passes, types that could be inferred. Each
suggestion names the smaller version.

### Reviewer C: conventions

Checks the diff against AGENTS.md, section by section, since that file is the
conventions. A lint pass catches only a few of them. The ones most often broken:

- **Structure**: features never import each other (only `reference-data` is shared);
  a feature keeps the `api/api.ts`, `api/queries.ts`, `components/`, `lib/types.ts`
  layout; query options use the key factory; shared code lives in `src/lib/` or
  `src/components/`
- **Data**: loaders defer with an unawaited `prefetchQuery` and block only for a
  permission check or a must-404 record; every `useSuspenseQuery` has a boundary above it
- **Pages**: `Workspace` parts rather than hand-rolled padding; list pages copy the
  Users page (URL owns the state, container queries not viewport breakpoints, the create
  action ends the toolbar); short forms are URL-owned dialogs built from `form-dialog/`
  and `useAppForm`, yes/no settings are `SwitchField`s
- **Code**: `@/` imports, kebab-case files, `type` over `interface`, tests colocated,
  logical CSS only, `BASE_URL` for assets, no `import.meta.env` for anything that varies
  per environment, auth state only through the store
- **Text**: English labels in Title Case, flat and sorted translation keys present in
  every locale, Zod messages as keys, comments of at most one line with no ticket
  references, no em dashes anywhere (code, copy, docs, commits, PR)
- **Docs**: AGENTS.md, README.md and `docs/` updated where the diff changes what they
  describe, each kept to its own audience
- **The PR itself**: the description follows the Pull Request Format (ticket link,
  `## Changes` as one-line bullets, screenshots for visible changes, empty sections left
  out), commits are conventional (`feat:`, `fix:`, `refactor:`...), no Co-Authored-By
  lines, and the diff contains nothing unrelated to the PR's purpose
- **The plan**: a ticket PR carries `plans/<KEY>.md`; every acceptance criterion in it
  is met, and the plan still matches what was built

It quotes the AGENTS.md rule each finding breaks. A rule the diff breaks for a good
reason is still reported, so the user can decide whether the rule or the code changes.

### Reviewer D: React and shadcn practice

Loads the `vercel-react-best-practices`, `vercel-composition-patterns` and `shadcn` skills
and applies them to the diff. Covers: re-renders and memoization that matter, waterfalls,
bundle weight and lazy loading, composition over boolean props, variant props instead of
`className` on shadcn components (the `no-restyle` rule), stock primitives in the
registry-bound folders (`data-table/`, `form-dialog/`, `form/`), RTL (logical classes
only, `rtl:rotate-180` on reading-axis icons, logical `side` props), accessibility (labels,
roles, focus, keyboard, colour never the only signal), and the four states of every list
(rows, skeleton, empty, error with retry). It checks the screen in Arabic as well as in
English, and at a phone width as well as a desktop one.

### Reviewer E: legacy UI parity

Opens each touched screen in both UIs, signed in as the same user, and compares them from
the user's side, not the code's:

- **Capability**: every field, column, filter, sort, action, validation rule, message and
  rights check the legacy screen has. Anything missing in the new UI is a regression
  unless the PR or the plan names it as a drop.
- **Data**: the same records, counts and values for the same user and filters. A number
  that differs is a bug in one of them; find out which.
- **Experience**: where the new screen is not clearly better, say so. Compare clicks to
  finish the task, loading and empty states, error recovery, wording, mobile and
  keyboard use.
- **Server-side work**: sorting, filtering, paging, searching or counting done in the
  browser, in either UI: a request with no paging, sort or filter params that returns
  everything and is then worked on locally. For each, check the endpoint's API definition
  (`src/main/resources/api-definition.yaml` in the service repo) for params that do it on
  the server. The new UI doing it client-side when the server can is a finding, unless
  the plan records why it stays client-side; legacy doing it is a chance to improve,
  reported with the params to use.

The legacy source is on GitHub under `OpenLMIS` (`openlmis-*-ui`,
`openlmis-ui-components`, `openlmis-ui-layout`); read it with
`gh api` or `gh search code` when the behaviour behind a screen is unclear. Findings
anchor to the new UI's file and line, and quote what legacy does.

### Browser rules (give these to every reviewer, and to every `plan-implementation` researcher)

- The API target is a shared server. **Never let a write reach it**: route every
  non-`GET` request under `/api/` to a stub (`route.fulfill`), except
  `POST /api/oauth/token` for signing in. A real write needs the user's explicit
  permission for that one request.
- Always `page.unrouteAll({ behavior: 'ignoreErrors' })` in a `finally`, or a stale route
  breaks the next check.
- Sign in with the account the user gave. If the session has expired, sign in again
  rather than reporting the redirect to `/login` as a bug.
- Legacy UI is read-only as well: look, filter and open things, never save.
- Recharts animates on mount and resize, so wait before judging a chart.
- Save screenshots, at desktop and phone width, to `.screenshots/<KEY>/` in the project,
  or `.screenshots/pr-<n>/` when there is no ticket. The folder is gitignored; never save
  them anywhere else.

## 3. Verify

When all five have reported, merge their findings and drop duplicates. For every
finding that remains, check it yourself or with a verification agent. Read the code path,
reproduce the scenario, and keep only what is **confirmed**. Mark anything that is likely
but not reproduced as **plausible**. Discard style preferences that AGENTS.md does not
back.

## 4. Report, then fix

Report confirmed findings first, including broken conventions, ranked by severity, each in one or two lines with
`file:line`. Then list plausible ones and what would confirm them. List parity gaps
separately, since they are product calls: the fix may belong in a later PR.

If the user asked for a review only, stop there. If they asked for the PR to be ready,
continue:

1. Fix each confirmed finding. Keep fixes small and in the style of the surrounding code.
   When a fix changes what the plan says, update `plans/<KEY>.md` in the same commit.
2. Re-run the gates from step 1, plus `pnpm check`.
3. Recheck any fixed behaviour in the browser, under the browser rules.
4. Commit with a conventional message (`fix:`, `refactor:`, `docs:`) and push to the PR
   branch. No Co-Authored-By lines.
5. Wait for CI (`gh pr checks <n>`) and confirm `gh pr view <n> --json mergeStateStatus`
   is `CLEAN`.

**Never merge.** Merging is the user's call, every time.
