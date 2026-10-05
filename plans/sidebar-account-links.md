# Sidebar Account Links

Included in FM-28's expanded scope, approved on 2026-10-05. See [FM-28](FM-28.md).

## Summary

Add Account and Settings immediately below Home in the sidebar. Account opens Profile;
Settings keeps its existing permission requirement. Reuse the links already offered by the
avatar menu and command palette.

## Scope And Decisions

- Reuse `useAccountLinks()` and the existing sidebar link rendering, including icons,
  active state, collapsed tooltips and closing the mobile sidebar after navigation.
- Keep the existing breadcrumb labels and command palette grouping.
- Reuse translated labels; no new catalog entries or API calls.
- Update AGENTS.md to describe the additional sidebar access.

## Checks

Write sidebar tests before the change for link order, permission filtering, active state
on profile/settings tabs and collapsed access. Run the related navigation tests, lint,
design-system lint and TypeScript checks. Check the expanded/collapsed sidebar and mobile
sheet in English and Arabic.

Validation: 48 related navigation tests, Biome, design-system lint, TypeScript and the
production build pass. Browser checks confirm both destinations, active highlighting,
collapsed access and Arabic layout. A 390 px mobile browser check confirms opening
Account closes the sidebar; a component test covers the same behavior.
