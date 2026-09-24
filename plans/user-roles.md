# User Roles: Edit a User's Roles

No ticket yet · Parent: Administration > Users

## Summary

A user can only do what their roles allow: approve requisitions for a program at a
supervisory node, fill orders at a facility, see reports, or administer the system. An
administrator gives out those roles from the Users list.

In the old UI this is the Edit User Roles page: four tabs (Supervision, Fulfillment,
Reports, Administration), each with a row of dropdowns to add a role and a table of the
roles held. Nothing is saved until Save User Roles, which also returns to the Users list.
It works, but it is slow to open (about 7 seconds), unusable on a phone, hides warnings
and rights behind hover popups, loses unsaved work without asking, and saving roles
quietly reactivates a user who was deactivated.

The new page keeps the same model, one draft across four tabs saved at once, and fixes
the rest:

- It opens as soon as the user is loaded, and the slow lists fill in afterwards.
- Adding a role happens in a short dialog with searchable lists, clear required fields,
  and a warning before adding a home facility role the user cannot use.
- Each tab can be searched and sorted. Removing a role can be undone.
- Leaving with unsaved changes asks first. Saving stays on the page and changes nothing
  but the roles.
- Import Roles copies another user's roles and says how many it will add before it does.
- It works on a phone and in Arabic.

## Acceptance Criteria

No ticket, so these are derived from legacy and its known problems.

| AC | How it is met | How it is checked |
| --- | --- | --- |
| Every legacy capability is kept: four role types, add, remove, import from another user, save all at once | Tabs per type, Add Role dialog, row Remove, Import Roles dialog, one Save | Browser walk of every tab |
| Saving changes only the roles | `updateUserRoles` reads the user fresh and sends one `PUT /users`; no auth or contact writes | `api.test.ts` |
| Unknown programs, nodes, facilities or roles never break the page | Rows keep the assignment and show "Unknown" | `role-assignments.test.ts` |
| Unsaved work is never lost silently | Router blocker and `beforeunload` while there are changes; Discard asks first | Browser |
| A home facility role for a user without a home facility is flagged before and after adding | Warning in the dialog, badge on the row | Browser, unit test for `isIgnored` |
| Duplicates are refused inline | Zod issue on the role field | `role-form.test.ts` |
| The page is usable on a phone and in RTL | Rows go two-line when the content is narrow, logical classes | Browser at 390 px, Arabic |
| Server errors are shown as the server wrote them | `serverMessage()` in the save alert | Browser with a stubbed 400 |

## Legacy Today

- Route `/#!/administration/users/{id}/roles/{supervision|fulfillment|reports|admin}`,
  guarded by `USERS_MANAGE`, reached from the Roles button on each Users row.
- Header "Edit User Roles", "User: {username}", an Import Roles button, then the tabs.
- Each tab: an inline add form, a table sorted by role name, client paging of 10.
  - Supervision: Program*, Supervisory Node (optional; empty means home facility), Role*.
  - Fulfillment: Supplying Facility* (every facility, on purpose since OLMIS-3805), Role*.
  - Reports and Administration: Role* only. A tab with one role preselects it.
- Hovering a role shows its rights; hovering the error icon shows "User has no home
  facility assigned so home facility role will be ignored!".
- Remove asks "You are about to remove the {role} role. After this change, {n} user(s)
  will have this role." The count is wrong for unsaved rows.
- Save sends `PUT /users`, `PUT /userContactDetails/{id}` and `POST /users/auth` with
  `enabled: true`, then returns to the list: "User roles updated successfully!". Failure
  shows "Failed to update user roles" and never the server's reason.
- Problems seen: 7 s to open (unpaged `/supervisoryNodes` takes 4 s), a crash when an
  assigned program, node or facility no longer exists, no unsaved-changes guard, a
  sticky header popover, sideways scrolling at 390 px, Import Roles loading 1,210 users
  plus 32 contact requests for one dropdown.

## Agent Brief

### API map

| Step | Method and path | Params | Fields used | Right | Legacy ref |
| --- | --- | --- | --- | --- | --- |
| Load the user (blocks) | `GET /users/{id}` (+ contact, auth via `fetchUserDetails`) | - | `username`, names, `homeFacilityId`, `roleAssignments` | `USERS_MANAGE` | referencedata-ui `user-repository-impl.js#L134` |
| Roles | `GET /roles` | - | `id`, `name`, `description`, `rights[].name/type` | any signed-in user | `referencedata-role.factory.js#L49` |
| Programs | `GET /programs` | - | `id`, `name` | any | `program.service.js#L109` |
| Supervisory nodes | `GET /supervisoryNodes` | none (all) | `id`, `name`, `facility.id` | any | `admin-user-roles-supervisory-node-resource.js#L41` |
| Facilities | `GET /facilities/minimal` | - | `id`, `code`, `name` | any | `facility.service.js#L229` |
| Import: users | `GET /users` | `sort=username,asc` | `id`, `username`, names | `USERS_MANAGE` | `select-users-modal.routes.js#L38` |
| Import: source user | `GET /users/{id}` (+ contact, auth) | - | `roleAssignments` | `USERS_MANAGE` | `select-users-modal.controller.js#L68` |
| Save | `GET /users/{id}` then `PUT /users` | - | full user, `roleAssignments: [{roleId, programId?, supervisoryNodeId?, warehouseId?}]` | `USERS_MANAGE` | `UserController.java#L167` |

`PUT /users` replaces every assignment; omitting `roleAssignments` deletes them all, so
the field is always sent.

### Data flow

- Route `/administration/users/$id/roles`
  (`_protected.administration.users_.$id.roles.tsx`, trailing `_` so it does not nest
  under the list). Route files are exempt from Biome's kebab-case rule, since `$id` and
  `users_` are router syntax. Search: `tab`, `q`, `page`, `size`, `sort`, `dir`, `dialog`
  (`add`/`import`), `rights` (role id).
- Loader blocks on `userDetailsOptions(userId)` (a missing user must show Not Found) and
  prefetches roles, programs, nodes and facilities without waiting.
- The draft lives in page state, seeded from the saved assignments; tabs, dialogs and
  paging only change the URL, so the draft survives them.
- Rows suspend on roles and programs (fast). Node and facility names use non-suspending
  queries, so rows show at once and those cells fill in.
- Save invalidates `users.all`; when editing yourself the route also invalidates rights.

### Files

- `src/features/reference-data/`: roles, programs, supervisory nodes lookups and types.
- `src/features/users/lib/role-assignments.ts`, `role-form.ts`, `roles-search.ts`,
  `use-role-draft.ts`, `use-role-lookups.ts` + tests.
- `src/features/users/api/api.ts`: `updateUserRoles`, `fetchAllUsers`.
- `src/features/users/components/`: `role-assignments-table.tsx`, `add-role-dialog.tsx`,
  `import-roles-dialog.tsx`, `role-rights-dialog.tsx`, `discard-changes-dialog.tsx`, and
  `role-dialogs.tsx`, which loads the dialogs as one chunk.
- `src/routes/(protected)/_protected.administration.users_.$id.roles.tsx`.
- `users-table.tsx`: wire the Roles action. `app-breadcrumbs.tsx` and `config.ts`: crumbs
  for pages below a nav entry.
- `src/components/ui/tabs.tsx`, `alert-dialog.tsx` from shadcn; `Badge warning` and
  `Alert warning` variants.

### Rules

- Supervision needs a program; the node is optional (home facility). Fulfillment needs a
  facility. Reports and Administration need only the role.
- A duplicate is the same role with the same program, node and facility, empty equal to
  empty (`user.decorator.js#L128`).
- A role's type is its first right's type (`Role.java#L127`).
- Import merges every type and skips duplicates (`user.decorator.js#L91`).

### Translations

`users.roles.*` keys in en, pt and ar.

### Tests

Unit: keys, merge, change count, rows, filter and sort, form schema, `updateUserRoles`.
Browser: every tab, add, duplicate, home facility warning, remove and undo, import,
discard and the leave guard, save with a stubbed `PUT`, 390 px, Arabic.

### Risks

- `/supervisoryNodes` is slow (4 to 6 s); it is cached for 10 minutes and never blocks rows.
- Two admins editing the same user: the last save wins, as in legacy.

## UI/UX

| Element | Call | Why |
| --- | --- | --- |
| Four tabs, one draft, one Save | Port | The model users know; counts on each tab |
| Inline add form | Improve: Add Role dialog | Room for searchable lists, inline errors and warnings; works on a phone |
| Node and facility dropdowns | Improve: searchable comboboxes, node shown with its facility | 511 nodes and 2,735 facilities |
| Home facility warning | Improve: shown in the dialog before adding and as a row badge | Hover-only icon today |
| Rights popover on hover | Improve: rights listed in the Add dialog and a View Rights row action | Hover fails on touch and keyboard |
| Remove confirm with user count | Improve: remove at once with Undo | The count is wrong and the change is not saved yet anyway |
| Table | Improve: search, sortable columns, pagination with page size | Long supervision lists |
| Save returns to the list | Improve: stay, toast, Save disabled until something changes | Keep working; breadcrumb goes back |
| Cancel | Improve: Discard Changes, confirmed; leaving asks too | No silent loss |
| Import Roles | Improve: searchable user picker and a preview of how many roles it adds | One blind dropdown today |
| Save rewriting active, contact, auth | Drop | Reactivated deactivated users |
| Single role preselected | Port | Saves a click on Reports and Fulfillment |

States: page skeleton while the user loads, Not Found, table skeleton, empty tab with Add
Role, no matches with Clear Filters, lookup error with Try Again, save error with the
server's message.

## Decisions

- Keep all supervisory nodes in the picker, not just the program's: 10 of the
  administrator's 38 node assignments are outside their program's filtered list.
- Keep every facility as a fulfillment facility, as legacy decided in OLMIS-3805.
- A home facility role for a user without one is allowed, with a warning, as legacy and
  the server allow it.
- No rights check added in the route: the Users page has none either, and the server
  refuses without `USERS_MANAGE`.

## Open Questions

- Should the Users routes check `USERS_MANAGE` up front, instead of relying on the
  server's refusal?
- Should fulfillment facilities be limited to warehouses after all?

## Steps

1. Reference-data lookups and key scopes.
2. Assignment logic and form schema, with tests.
3. `updateUserRoles` and `fetchAllUsers`, with tests.
4. Tabs, alert dialog, breadcrumbs for nested pages.
5. Route, draft, tabs and table.
6. Add Role, Import Roles, View Rights and Discard dialogs.
7. Wire the Users row action; translations in all locales.
8. Browser walk, gates, PR, `review-pr`.
