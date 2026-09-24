---
name: plan-implementation
description: Research and plan an OpenLMIS Jira ticket (FM-*) before any code is written - read the ticket and its acceptance criteria, study how the legacy OpenLMIS UI does it today (screens, behaviour, rights, API calls), map every backend call, propose the UI/UX for the new app (port as is, or improve), and write it all to plans/<KEY>.md, then stop for approval. Use whenever the user shares a Jira ticket or key and wants to start on it, says "plan FM-14", "let's pick up this ticket", "research this feature", "how does legacy do this", or asks to implement a ticket that has no plan yet, even if they don't name the skill.
---

# Plan implementation

No ticket goes straight from its acceptance criteria to code. Every ticket first gets a
plan at `plans/<KEY>.md`: what the feature is and how legacy does it today, a brief an
agent can build from (every API call mapped), and a UI/UX proposal. The plan is
committed with the implementation PR, and `review-pr` checks the PR against it.

A one-line fix gets a short plan. It still gets one.

## 1. Read the ticket

With the Atlassian tools (cloud `openlmis.atlassian.net`), read the ticket with
`comment`, `parent`, `subtasks`, `issuelinks` and `attachment`. Then read its parent
story or epic, its siblings and anything linked, since the acceptance criteria often lean
on them ("see the coexistence spike"). Note the AC word for word.

Read-only: never comment on, edit or transition a Jira issue without the user's explicit
go-ahead for that change.

Check `plans/` for an existing plan for this ticket or its siblings, and read AGENTS.md
and the code the ticket touches, so the research starts from what already exists.

## 2. Research in parallel

Launch three background `Agent`s in a single message. Give each the ticket key, the AC,
the parent story, and the **browser rules** from the `review-pr` skill
(`.agents/skills/review-pr/SKILL.md`), copied verbatim: nothing may write to the shared
server, and legacy is look-only. Each returns findings with evidence, not opinions, and
changes no files.

### Researcher A: legacy in the browser

Signs into the legacy UI on the instance `VITE_API_PROXY_TARGET` points at, as the
account the user gave, and walks every screen the ticket covers:

- The route (`/#!/...`), how a user gets there, and which rights show or hide it
- Every field, column, filter, sort, action, validation, message and empty or error state
- The API calls each step makes, captured from the network: method, path, query, the
  response fields the screen actually uses, and the status codes seen
- What is slow, confusing, broken or missing, with timings
- Work the screen does in the browser: a request with no paging, sort or filter params
  that returns everything, then pages, sorts, filters or counts locally
- Screenshots at desktop and phone width, saved to `.screenshots/<KEY>/` as the browser
  rules say, where `review-pr` later compares the new screens against them

For plumbing tickets with no screen (auth, caching, errors), it observes the behaviour
instead: what legacy stores, when it redirects, what the user sees.

### Researcher B: legacy source and the API

Reads how legacy does it in code: the OpenLMIS UI repos on GitHub (`openlmis-*-ui`,
`openlmis-ui-components`, `openlmis-ui-layout`), found with `gh search code` or
`gh api`. It then reads the backend contract for every endpoint involved, in the
service's API definition (`src/main/resources/api-definition.yaml`, RAML despite the
extension, in repos such as
`openlmis-referencedata`, `openlmis-requisition`, `openlmis-fulfillment`,
`openlmis-auth`), and returns:

- Each endpoint: method, path, parameters, paging and sorting, request and response
  shape, the right it requires, and its error responses
- Business rules the legacy UI enforces client-side that the new UI must enforce too
- Work legacy does client-side that belongs on the server (sorting, filtering, paging,
  searching, counting): for each, whether the endpoint already supports it and with
  which params, or why it cannot and what that costs on large data
- Caching, offline or batching tricks legacy relies on
- File and line references for everything it claims

### Researcher C: this codebase

Finds what the new UI already has to build on: features, `reference-data` lookups,
query options and keys, shared components (`data-table/`, `form-dialog/`, `form/`,
`workspace.tsx`), rights in `RIGHTS`, translation keys, nav entries in `NAV_GROUPS`, and
the closest existing screen to copy (the Users page for lists, the user dialog for short
forms). It lists what is missing and which AGENTS.md rules apply.

## 3. Think about the UI/UX

With the research in hand, and the `frontend-design` and `shadcn` skills loaded, decide
screen by screen, element by element:

- **Port**: legacy gets it right; keep the behaviour and restyle it in this app's system
- **Improve**: same capability, less friction (fewer clicks, better defaults, inline
  validation, clearer wording, useful empty and error states, works on a phone)
- **Drop**: legacy baggage no user needs; say why, since it is a product call

Nothing a legacy user relies on may go missing without being named as a drop. The new
screen must feel clearly better, never merely different. Follow the app's own patterns
first (list page, dialog versus page, `Workspace`, rights-gated parts), cover every
state (loading, empty, no matches, error with retry), and check RTL and phone width.
Where a choice is genuinely open, give a recommendation and the alternative.

## 4. Write the plan

Write `plans/<KEY>.md` with these sections, leaving out any that do not apply:

```markdown
# <KEY>: <ticket summary>

<ticket URL> · Parent: <parent key and summary>

## Summary
Plain language for anyone on the team: what the feature is for, how it works in legacy
today, what the new UI will do and what changes for users. No code.

## Acceptance Criteria
| AC | How it is met | How it is checked |

## Legacy Today
Screens and routes, rights, behaviour step by step, known problems, with screenshots
referenced by legacy URL.

## Agent Brief
- API map: | Step | Method and path | Params | Fields used | Right | Legacy ref |
- Data flow: which loader blocks and which defers, query keys, what lives in the URL
- Server-side work: what legacy does in the browser that moves to the server, and what
  stays client-side because the API cannot do it
- Files: to add and to change, following the feature layout
- Reuse: existing components, hooks and lookups
- Rules: the business rules to enforce, with their legacy source
- Translations: new keys
- Tests: what to unit test (our logic, not shadcn primitives), written before the code
  they cover, and what to check in the browser, which `review-pr` runs
- Risks and edge cases

## UI/UX
What legacy looks like, and what to port, improve or drop and why. States, phone
width, RTL, accessibility.

## Decisions
Choices made, with the reason. Include anything the AC asks to "decide and record".

## Open Questions
What the user or product owner must answer before or during the build.

## Steps
Ordered, small, each ending in something verifiable.
```

The Summary is for humans: short, plain, and with no endpoint names. Everything an agent
needs goes in the Agent Brief, and nothing in the plan duplicates AGENTS.md; link to it
instead. Follow the house rules: Title Case headings and labels, no em dashes.

## 5. Stop for approval

Show the user the Summary, the UX calls (port, improve, drop), the Decisions and the
Open Questions, and link the plan file. Then wait. Do not write code, create the
feature branch's commits, or touch Jira until the user approves or amends the plan.

Once approved:

1. Create the branch (`feat/<key>-<slug>`, lowercase), and commit the plan first as
   `docs: plan <KEY>`.
2. Build it step by step, test first: never write a unit test after the code. Each step
   starts with a failing test for the logic it adds, then the code that makes it pass.
   Keep the plan true: when the build departs from the plan, update the plan in the
   same PR rather than leaving it stale.
3. Link the ticket at the top of the PR description, and run `review-pr` before asking to
   merge.
