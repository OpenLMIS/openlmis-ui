---
name: test-audit
description: Audit and trim the openlmis-ui test suite for meaningful regression protection, maintenance cost, and CI time. Use when the user asks for a test audit, fewer or more valuable tests, removal of redundant or heavily mocked tests, or faster testing feedback. Also use when deciding whether proposed tests earn their place. Research-backed React testing guidance, repository-specific boundaries, and an evidence-based cleanup workflow. A request to run tests or fix one failing test alone does not require a suite audit.
---

# Test Audit

Keep the smallest understandable suite that protects meaningful OpenLMIS regressions.
Every retained or proposed test should answer: **what plausible mistake in our code
would this catch, and why would that mistake matter to a user or developer?**

Test count and coverage percentage are not goals. A passing assertion, a production
import, or a plausible mutation is not enough to justify a test. Weigh the consequence,
unique protection, maintenance burden, and execution cost together.

Read [the testing guidance](references/testing-guidance.md) before making judgments or
writing tests. It records the research behind these rules and shows what a valuable
React test looks like. Existing tests are evidence to examine, never the quality standard.
Read the current `AGENTS.md`, test configuration, and CI workflow too.

## 1. Establish scope and authorization

- Audit or dry run: inspect and run checks, then report. Leave tests and production code
  unchanged. Do not turn a dry run into cleanup.
- Cleanup explicitly requested: apply verified improvements within that scope without
  another approval round. Separate unrelated product bugs from test maintenance.
- New tests proposed during development: use the value gate below before writing them.
- Honor the requested feature, diff, or whole-suite scope. State what was reviewed and
  what was sampled. Do not claim every file was reviewed from a search scan.

Do not require Jira or a running backend for an ordinary audit. Use local plans and
contracts when available. If an uncertain requirement needs external evidence, report
it as uncertain rather than inventing the expected behavior.

## 2. Apply the value gate

Before adding, replacing, or retaining a disputed test, identify:

1. **Risk:** a concrete user failure, data loss, access problem, broken workflow, or
   important contract violation. Distinguish it from a harmless implementation change.
2. **Mistake:** the plausible production edit that causes that failure. Identify the
   assertion that would detect it, and whether a mock prevents exercising that edit.
3. **Unique protection:** why another retained test, TypeScript, Biome, or design-system
   lint does not already catch it adequately. A larger test may miss a unit edge case.
4. **Cheapest adequate test:** pure function, public hook, component interaction, focused
   integration, or browser. Prefer the smallest boundary that covers the actual risk.

If these cannot be answered, omit a new test or recommend removing the existing one.
Do not invent contrived bugs to justify a test after it has been written. Known bug
regressions and destructive or access-sensitive behavior deserve a higher retention bar.

### Trust dependencies; test our decisions and wiring

Do not test stock shadcn or Base UI button clicks, checkbox semantics, dialog mechanics,
focus traps, or dropdown opening. Do not retest React state updates, TanStack sorting,
Query retries, Zod's required rule, Axios promises, or date-fns parsing in isolation.

Our code can still break the workflow using these packages. A test that verifies a
filtered-out row cannot be deleted, a user can submit a form, or a failed save preserves
their draft earns its place by exercising our configuration and integration. It need
not mock the primitives. Package behavior observed in that workflow is incidental.

App-specific edits in `src/components/ui/` may merit targeted tests if they carry a
material regression risk. Do not create a test file per primitive or per added prop.

### Favor these risks in OpenLMIS

- Access rules, session expiry and user switching; local data belongs to its user and
  deployment. UI checks do not prove backend authorization.
- Saves that preserve unknown fields and concurrent changes, fresh-record reads,
  multi-request failure handling, and partial bulk deletion results.
- URL-owned page/filter/dialog state, Back and Cancel return paths, stale rows that
  cannot act on a new filter, and selections across pages.
- Product versions, payload transformations, role assignments, decimal/date boundaries,
  and domain validation beyond generic library rules.
- Offline failures, reconnect recovery, cache invalidation and suspended content with
  a working retry path. Test our policy rather than TanStack's generic mechanisms.
- Language changes after validation, ICU value isolation, Arabic direction decisions,
  and `/v2/` asset/return paths. Do not multiply every test by every locale or theme.

These are priorities, not a mandatory test checklist for every feature. Add only cases
whose risk exists in the inspected code. A plain presentational wrapper may need no test.

## 3. Inventory and measure once

Inspect `package.json`, `vite.config.ts`, `src/tests/setup.ts`, `src/tests/render-page.tsx`,
and `.github/workflows/ci.yml`. Reconfirm installed tools instead of assuming this
document describes future configuration exactly.

Use `rg --files` to find colocated `.test.ts` and `.test.tsx` files. Count by feature and
layer, then find mocks, snapshots, timeout overrides, fake timers, skipped tests, and
repeated setup. Search findings are candidates, not verdicts. Tests may reach production
through aliases, dynamic imports, public entrypoints, or integration fixtures.

For a whole-suite audit, run the suite once in CI mode. A JSON report makes per-test
durations and results inspectable:

```bash
pnpm test:run --reporter=json --outputFile=/tmp/openlmis-test-audit.json
```

Record the command, commit, failures/skips, wall time, test counts, and slow files.
Distinguish environment/transform/setup overhead from execution. The sum of parallel
test durations is not elapsed CI time. A single local run is a baseline, not a benchmark
or proof of flakiness. For a small audit, run just the affected files.

Do not install a coverage provider, MSW, mutation tooling, another DOM environment, or
a database for an audit. Coverage is optional if already configured and useful for a
specific uncertainty. Do not lower gates or disable isolation to make a run look faster.
Flag environment/startup optimization separately from low-value test removal.

## 4. Review tests together with production code

Read each candidate test, the production code it actually exercises, relevant callers,
and any proposed companion. Map **risk -> real code path -> assertion -> retained test**.
Use this mapping to find both excess and missing protection in frequently used code.

Look for:

- **Copied logic:** a local implementation is tested instead of the production behavior.
  A harness that supplies props/providers to real code is fine; a fake component that
  implements the very policy under review is not.
- **Mock echoes:** the system under test is mocked, or the only assertion repeats a
  configured return. Exact URL/body assertions can protect a real frontend API contract,
  but mechanical CRUD wrappers are not automatically high value. Check consequence and
  unique coverage before keeping one file per endpoint.
- **Dependency tests:** generic primitive/library behavior without an app decision.
  Inspect custom configuration or overrides before declaring it upstream-owned.
- **Implementation locks:** class strings, DOM sibling placement, internal state shape,
  exact hook invocation counts, huge snapshots, or fixed configuration copied into
  expectations. Prefer behavior that survives a harmless refactor. Accessibility names,
  public callbacks, destructive request counts, and API payloads can be real contracts.
- **Duplicate protection:** parent and child tests, helper and caller tests, or the same
  form/table behavior copied across features. Show the retained assertions cover the
  same inputs, failure mode, and outcome before calling a test redundant.
- **Manufactured matrices:** many cases that repeat the same branch, generic Zod rules,
  every label/default option, or a Cartesian product of language/theme/viewport variants.
  Keep distinct domain boundaries; parameterize useful cases without adding new ones.
- **Wrong expectations:** names disagree with assertions, fixtures contradict upstream
  records, or assertions reproduce a bug. Use independent contract/requirement evidence,
  not just the current source or legacy behavior. Separate suspicion from a verified bug.
- **Unobservable claims:** a save-payload test never reaches successful submission, or
  a freshness test returns the same record before and after the alleged stale window.
  Arrange distinguishable values and assert the claimed outcome, not a nearby effect.
- **Weak failure coverage:** success-only mocks hide partial writes, stale cache, data
  loss, or rejected saves. Recommend one focused test where the consequence warrants it.
- **Oversized fixtures:** a trivial assertion mounts a whole page or every field kind.
  Reduce the harness or consolidate assertions into a meaningful existing scenario
  before deleting valuable behavior. Mock a decorative preview only when it is outside
  the risk under test; keep our form, save policy, and feedback wiring real.
  For example, move a field's help-text assertion into the retained validation or submit
  scenario instead of mounting the same form again. Combine only related outcomes from
  one coherent interaction, not unrelated workflows into a giant test.
- **Unreliable async:** unawaited interactions/assertions, sleeps, actions inside retrying
  `waitFor`, swallowed errors, conditional assertions, shared stores/cache/storage, and
  empty tests. Fix the mechanism instead of extending timeouts.
  Fix the clock for date-dependent expectations, and restore it afterwards; a calendar
  test should not pass only during the month when the agent wrote it.

Mocking Axios at the HTTP boundary is allowed for focused API adapter tests. It proves
our supplied arguments and transformations, not the server response, Axios serialization,
or the entire screen. UI tests that mock our API functions leave UI/API integration
untested; use that boundary deliberately, and do not mislabel the coverage.

For an uncertain high-impact finding, an isolated, reversible mutation can demonstrate
whether a named test detects a real bug. Do it only in a disposable checkout with a
usable test environment. Never mutate the user's dirty tree. Do not run broad mutation
testing by default or treat a surviving equivalent mutation as a defect.

## 5. Classify and report

Use actions rather than automatic deletion tiers:

| Action | Required evidence |
| --- | --- |
| Keep | Meaningful risk, detecting assertion, and useful unique protection |
| Remove | No meaningful app protection, or named retained coverage fully replaces it |
| Consolidate | Named overlapping cases, smaller retained scenario, preserved boundaries |
| Rewrite | Valuable risk, but brittle assertions or mocks block meaningful detection |
| Gap | Material unprotected risk and the smallest useful test to close it |
| Product bug | Independent expected behavior and a reproducible production failure |

Report only verified findings as findings; label unresolved candidates and runtime
estimates. Give `file:line`, test name, exercised source, concrete failure or needless
coupling, action, and retained/replacement protection. For deletion, state any protection
being deliberately surrendered. Count proposed removed cases/lines only when inspected.
Deliberately dropping a low-impact formatting/configuration lock does not require a
replacement. Count case consolidation separately from removed protection or runtime
savings. Check casts and untyped transformations before claiming TypeScript replaces a test.

Lead with the recommendation and measured baseline. Then give:

1. Verified product bugs, if any.
2. The highest-value reductions, largest avoidable costs first.
3. High-value tests to preserve and material gaps, with minimal replacements.
4. Commands/results and scope limits, plus the first cleanup batch.

Keep the report short enough to act on. Do not pad it with findings for every file, a
coverage target, arbitrary test-count quotas, or speculative speedup percentages. Save a
longer report only when needed or requested, outside human-facing `docs/` and Jira plans.

## 6. Cleanup when authorized

Start with verified no-value cases, then consolidate duplicates, then rewrite tests
whose risk merits protection. When replacing weak protection, get the smaller real
test passing before removing it; deletion-first is not a universal rule.

For a product bug, write a failing regression test first, verify it fails for the right
reason, then fix the source. Follow `AGENTS.md`: colocated kebab-case files, `@/` imports,
and test our logic. A test-only cleanup needs no extra tests proving tests were removed.

Use the installed Vitest + Testing Library tools, `userEvent.setup()`, semantic queries,
and awaited observable outcomes. Keep shared timeout settings; use Testing Library's
`waitFor`, never `vi.waitFor` or per-test/query timeouts. Isolate QueryClients and stores;
turn off query retries unless our retry policy is under test. A seeded Suspense fixture
uses `staleTime: Infinity` only when refetch behavior is outside the scenario.

Use real Dexie with the existing `fake-indexeddb` setup for local storage behavior. Use
browser checks for layout, focus across portals, real navigation, or service workers
when a DOM emulator cannot prove the risk. A mocked browser API tests our reaction only.

Run affected test files after each coherent batch, then `pnpm test:run`, `pnpm tsc
--noEmit`, and the applicable lint gates once at the end. Include `pnpm build` for build
or deployment changes. Repeat only after a new change, failure, or unresolved concern.
Compare before/after on the same environment if cleanup changed execution cost, and
report protection preserved or surrendered along with counts and timings.

Finish with the changes, evidence, and remaining risk. Never claim that fewer tests or
all-green CI alone makes the suite more valuable.
