# Testing guidance and research

Researched on 2026-10-09 from primary sources. These principles are independent of the
existing OpenLMIS test suite. The recommendations below apply those principles to this
project; they are judgments, not official mandates about test counts.

## What a good React test protects

Test a behavior through the interface its consumer uses. For UI this normally means
props, accessible DOM, user interactions, and visible results; for a reusable hook or
pure function it can mean its public API. Private state and component decomposition
should be free to change without repairing tests.

[Testing Library's principles](https://testing-library.com/docs/guiding-principles/) and
[React Testing Library's FAQ](https://testing-library.com/docs/react-testing-library/faq/)
favor realistic interactions and choosing a boundary by confidence gained versus cost.
They do not prescribe a test per component. A focused parent interaction often covers
child wiring more effectively than separate tests with mocked children.

[Kent C. Dodds on implementation details](https://kentcdodds.com/blog/testing-implementation-details)
explains both failure modes: a test can break on a safe refactor and still pass when
actual behavior breaks. His [integration-testing argument](https://kentcdodds.com/blog/write-tests)
supports spending effort on connected behavior while keeping useful small unit tests.
For this repo, prefer pure tests for domain transformations and focused component
integration for workflows. Do not replace every cheap unit test with a full page render.

## Boundaries and dependency trust

Our ownership is the deciding factor. Test OpenLMIS access policy, payload preservation,
filter/selection coordination, and failure handling. Trust packages to implement their
documented primitives. A test of our configuration using real packages is different
from a test of a package in isolation.

[Vitest's mocking guidance](https://vitest.dev/guide/mocking.html) explains mock lifecycle
and module replacement behavior. A mock changes what the test can prove. Treat external
I/O as a boundary, keep the behavior under test real, and reset shared state. Do not
deduce quality from a mock count alone.

An Axios adapter test asserting a destructive request's target and preserved payload
can be valuable. A generic read wrapper returning a supplied mock object may have little
value. Neither exercises the backend. Consider network interception for a material
screen-to-request gap, but do not introduce MSW just to rewrite existing fast tests.

## Reliable interactions and assertions

[Testing Library's query guide](https://testing-library.com/docs/queries/about/) favors
roles and accessible names, then labels/text; use test IDs as an escape hatch. A role
query supports accessible markup but does not prove full accessibility compliance.
[user-event](https://testing-library.com/docs/user-event/intro/) models multi-event user
actions and interactability. Use a per-test `userEvent.setup()` and await each action;
use `fireEvent` for low-level events user-event does not model.

[Async utilities](https://testing-library.com/docs/dom-testing-library/api-async/) retry
assertions until an outcome appears. Use `findBy*` for appearance, `queryBy*` for absence,
and `waitFor` for conditions. Keep clicks, writes, and other side effects outside a
retrying callback. Await rejection assertions. Do not substitute sleeps for completion.

[React's act guidance](https://react.dev/reference/react/act) explains flushing pending
updates. Testing Library wraps its helpers, so manual `act` is for updates outside those
helpers, such as direct store changes and timer advances. Investigate warnings rather
than silencing them. Test the completed outcome, not just an intermediate spinner.

## Query, timers, storage, and browsers

[TanStack Query's testing guide](https://tanstack.com/query/latest/docs/framework/react/guides/testing)
recommends isolated clients and disabling retries for error tests. Our mutation and
invalidation policy is worth testing; Query's generic cache machinery is already its
maintainers' responsibility. Seeded caches intentionally skip fetching, so do not use
them as evidence that a query function or request integration works.

[Testing Library's timer guidance](https://testing-library.com/docs/using-fake-timers/)
requires restoring timers and handling pending work. Use fake timers for our debounce
or timed policy when useful, and configure user-event's `advanceTimers`. Do not set its
delay to null as a workaround. A successful fake-timer test proves a simulated policy,
not browser scheduling performance.

[Vitest environments](https://vitest.dev/guide/environment.html) describe happy-dom as a
browser emulator with incomplete APIs. Our existing fake IndexedDB permits real Dexie
operations without a service. Layout, real focus behavior, browser history and service
workers may require a browser. [Playwright's practices](https://playwright.dev/docs/best-practices)
favor isolated tests, user-visible behavior, resilient locators, and avoiding third-party
systems. Reserve browser tests for risks the cheaper layer cannot cover.

## Cost and coverage

[Vitest's performance guide](https://vitest.dev/guide/improving-performance.html) says to
profile first and distinguishes environment, imports, setup and execution. More cases
are not necessarily the runtime bottleneck. Our DOM-free domain tests may be candidates
for a node environment only after checking their import graph and setup; do not disable
isolation across a stateful suite as a shortcut.

[Vitest coverage](https://vitest.dev/guide/coverage.html) measures execution using an
optional provider. It can locate unexecuted code; it does not measure assertion strength
or user impact. Do not add a provider or chase a percentage to justify a cleanup.

## Example of a test that earns its place

For an editor that must preserve a draft when save fails, use its real component and
form logic, fake only the save I/O, and test the retained input plus reported failure:

```tsx
it('keeps the edited name when saving fails so the user can retry', async () => {
  const user = userEvent.setup();
  const save = vi.fn().mockRejectedValue(new Error('offline'));
  render(<Editor saved={{ name: 'Original' }} onSave={save} />);

  await user.clear(screen.getByRole('textbox', { name: 'Name' }));
  await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Updated');
  await user.click(screen.getByRole('button', { name: 'Save' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Could Not Save');
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Updated');
});
```

This is an illustrative public contract, not an existing component to copy into the
repo. It catches our editor clearing a user's work after rejection. It incidentally
uses input/button primitives without testing their internals. Add a payload assertion
only if the editor owns an important transformation; do not assert internal hook calls,
button classes, or every field label. Keep separate tests for materially different
failures rather than making this one scenario exercise the whole application.
