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
- External identity changes discard without asking; deliberate navigation retains the discard guard.

## Steps

1. Commit this plan and write failing regression tests.
2. Implement the shared identity boundary and ownership checks.
3. Run type, formatting, design-system and full unit checks.
4. Run a headless two-tab browser check with all application writes stubbed.
5. Commit the fix locally and report validation results.
