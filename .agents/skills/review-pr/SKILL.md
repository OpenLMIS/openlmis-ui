---
name: review-pr
description: Review an openlmis-ui pull request's diff with four reviewers in parallel - correctness, simplification, React/shadcn best practices, and a side-by-side comparison with the legacy OpenLMIS UI so nothing regresses for users - then verify each finding, fix what is real, and get the PR ready to merge. Use whenever the user asks to review a PR or a branch, "run the review again", "code review and code simplify", "check for regressions against the old UI", or "make sure the PR is ready to merge", even if they don't name the skill.
---

# Review PR

Every change to this app is reviewed against its PR diff, never against the whole
codebase. Four reviewers run in parallel because they look for different things, and none
of them is allowed to report a finding it has not checked.

The bar for the new UI is higher than "works": every screen in it must do at least
everything its legacy counterpart does, and feel clearly better doing it.

## 1. Pin down the diff

1. Find the PR: the number the user gave, or `gh pr view --json number,url,headRefName,baseRefName`
   for the current branch. With no PR, review the branch against `master`.
2. Get the diff with `gh pr diff <n>` (or `git diff origin/master...HEAD`) and the changed
   files with `gh pr diff <n> --name-only`.
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

## 2. Launch the four reviewers in parallel

Send all four `Agent` calls in a single message, each running in the background. Give
every reviewer the same brief:

- PR number, URL, base and head branch, the diff command, and the changed-file list
- The gate results from step 1
- The screens touched and their legacy URLs
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
reproduces it in the browser or with a test before reporting. It also confirms that
earlier fixes on the branch still hold.

### Reviewer B: simplify

Looks for code that is harder than it needs to be: duplication, dead or unused exports,
helpers that already exist in `src/lib/` or `src/components/`, needless state or effects,
abstractions with one caller, props nobody passes, types that could be inferred. It also
checks the house rules: feature isolation (only `reference-data` is shared between
features), `@/` imports, kebab-case files, `type` over `interface`, comments of at most
one line with no ticket references, no em dashes anywhere, flat and sorted translation
keys, and `docs/` or AGENTS.md drift the diff caused. Each suggestion names the smaller
version.

### Reviewer C: React and shadcn practice

Loads the `vercel-react-best-practices`, `vercel-composition-patterns` and `shadcn` skills
and applies them to the diff. Covers: re-renders and memoization that matter, waterfalls,
bundle weight and lazy loading, composition over boolean props, variant props instead of
`className` on shadcn components (the `no-restyle` rule), stock primitives in the
registry-bound folders (`data-table/`, `form-dialog/`, `form/`), RTL (logical classes
only, `rtl:rotate-180` on reading-axis icons, logical `side` props), accessibility (labels,
roles, focus, keyboard, colour never the only signal), and the four states of every list
(rows, skeleton, empty, error with retry). It checks the screen in Arabic as well as in
English, and at a phone width as well as a desktop one.

### Reviewer D: legacy UI parity

Opens each touched screen in both UIs, signed in as the same user, and compares them from
the user's side, not the code's:

- **Capability**: every field, column, filter, sort, action, validation rule, message and
  rights check the legacy screen has. Anything missing in the new UI is a regression
  unless the PR says it is deliberately dropped.
- **Data**: the same records, counts and values for the same user and filters. A number
  that differs is a bug in one of them; find out which.
- **Experience**: where the new screen is not clearly better, say so. Compare clicks to
  finish the task, loading and empty states, error recovery, wording, mobile and
  keyboard use.

The legacy source is on GitHub under `OpenLMIS` (for example `openlmis-referencedata-ui`,
`openlmis-requisition-ui`, `openlmis-auth-ui`, `openlmis-ui-components`); read it with
`gh api` or `gh search code` when the behaviour behind a screen is unclear. Findings
anchor to the new UI's file and line, and quote what legacy does.

### Browser rules (give these to every reviewer)

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

## 3. Verify

When all four have reported, merge their findings and drop duplicates. For every
finding that remains, check it yourself or with a verification agent. Read the code path,
reproduce the scenario, and keep only what is **confirmed**. Mark anything that is likely
but not reproduced as **plausible**. Discard style preferences that AGENTS.md does not
back.

## 4. Report, then fix

Report confirmed findings first, ranked by severity, each in one or two lines with
`file:line`. Then list plausible ones and what would confirm them. List parity gaps
separately, since they are product calls: the fix may belong in a later PR.

If the user asked for a review only, stop there. If they asked for the PR to be ready,
continue:

1. Fix each confirmed finding. Keep fixes small and in the style of the surrounding code.
2. Re-run the gates from step 1, plus `pnpm check`.
3. Recheck any fixed behaviour in the browser, under the browser rules.
4. Commit with a conventional message (`fix:`, `refactor:`, `docs:`) and push to the PR
   branch. No Co-Authored-By lines.
5. Wait for CI (`gh pr checks <n>`) and confirm `gh pr view <n> --json mergeStateStatus`
   is `CLEAN`.

**Never merge.** Merging is the user's call, every time.
