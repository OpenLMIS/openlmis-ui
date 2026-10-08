# Reset drafts when the signed-in user changes

## Scope

Protect every routed draft from being reused by another signed-in user. No backend changes.

## Summary for humans

Signing in as someone else drops unsaved work and reloads the current page with that user's
rights and scope. Signing the same user back in keeps their work. An old save cannot continue
under another user's session.

## Agent Brief

- Add protected-layout tests for draft reset, loader rights rechecks and same-user renewal.
- Add HTTP and mutation regression tests for queued writes and delayed record reads.
- Check Edit User Roles, product General and Facility editor through the shared boundary.
- Update `_protected.tsx`, `session-scope.ts`, `use-session-mutation.ts` and HTTP interceptors.
- Use scoped mutations for routed writes; check identity before User and Service Account rollbacks.
- Keep features free of auth imports. Document the behaviour in AGENTS.md.

## Decisions

- Key the protected subtree by identity, hiding it until invalidated loaders finish.
- Identity changes include sign-out; token refresh and session expiry keep the identity.
- Check ownership before writes and reject stale responses before chained work continues.
- Legacy writes its token and user id separately. A token-only change expires and retains the
  previous token; an id-only change advances scope but waits for the new token. Remember the
  original token owner so both write orders discard the old draft and block queued writes.
- A legacy token change for the same id requires confirmation through the sign-in dialog,
  since it cannot be distinguished safely from the first write of a user switch. Drafts remain.
- Legacy username changes follow the borrowed session in all six token, id and username
  write orders, including username-only changes after the identity is adopted. The expired
  session dialog displays and submits the latest username.
- Batches capture their scope, check it before and after each task, and discard queued items
  on a session error or scope change. Reason saves also check between removal and addition.
  Ordinary item failures still allow the rest to finish. Axios refuses stale request owners
  before sending, as well as checking request scope.
- Async mutation completions check scope after every await, including refetch failures, before
  cache fallback writes, form resets or callbacks. The hook also checks after completion settles.
- External identity changes discard without asking; deliberate navigation retains the discard guard.

## Steps

1. Commit this plan and write failing regression tests.
2. Implement the shared identity boundary and ownership checks.
3. Run type, formatting, design-system and full unit checks.
4. Run a headless two-tab browser check with all application writes stubbed.
5. Commit the fix locally and report validation results.

## Review regressions

- Exercise legacy token-first and id-first switches through the protected draft boundary and
  HTTP adapter, asserting expiry during partial writes and no request from the previous scope.
- Keep the reviewer's Profile and Notification Settings pending-refetch reproductions as route
  tests, checking that cache clearing cannot resume fallback writes or Basic Information's `onSaved`.
- Check that a scope change during an awaited completion suppresses per-call callbacks.
- Port the held bulk-delete and Reason removal reproductions into shared mutation tests.
- Test that session errors and scope changes stop the batch even with an ordinary item error.
- Exercise all six legacy write orders in store and dialog tests, checking the submitted username.
- Re-run the headless legacy username check for all six orders on the existing server at port
  9068; stub every non-GET application request except OAuth login and close Chrome afterward.

## Validation

The review regressions failed before their fixes. TypeScript, Biome and design-system lint
passed afterward, along with all 1,638 tests across 203 files. The adapted reviewer browser race
passed both write orders, with zero stale draft writes and cross-tab sign-out reaching login.
Every non-GET API request except OAuth login was stubbed; the dev server was stopped by PID.


The batch and trailing-username re-review regressions also failed before their fixes.
TypeScript, Biome and design-system lint passed, along with all 1,655 tests across 204 files.
The headless Chrome username check passed all six legacy write orders on the existing server
at port 9068: each adopted the new identity, token and username, and the expired-session dialog
showed and submitted that username. Every non-GET API request except OAuth login was stubbed.
The script used a blank same-origin page for legacy storage writes and the live Vite module
URL for state inspection, avoiding duplicate auth stores under HMR. Browser evidence is under
`.screenshots/user-switch/fix-3/`. Chrome was closed and the existing dev server was left running.
