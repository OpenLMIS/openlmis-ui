import { QueryClient } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { deploymentTimeZoneOptions } from '@/features/reference-data/api/queries';
import { OfflineEventsPage } from '@/features/stock-events/components/offline-events';
import { newEventLine } from '@/features/stock-events/lib/event-form';
import {
  type OfflineEventsSearch,
  offlineEventsSearchSchema,
} from '@/features/stock-events/lib/offline-events-search';
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { parsePermissions } from '@/lib/permissions';
import { renderPage } from '@/tests/render-page';

vi.mock('@/components/nav-access', () => ({ useCanOpen: () => () => true }));
const local = vi.hoisted(() => ({ events: [] as DeviceEvent[], width: 1440 }));
vi.mock('@/features/stock-events/hooks/use-offline-events', () => ({
  useOfflineEvents: () => local,
  useHasDeviceEvents: () => false,
}));
vi.mock('@/features/stock-events/hooks/use-refused-event-retry', () => ({
  useRefusedEventRetry: (event: DeviceEvent, _canSend: boolean, onDone?: () => void) => ({
    available: event.status === 'refused' && !event.error?.resolvedAt,
    pending: false,
    retry: async () => {
      local.events = local.events.map((row) =>
        row.localEventId === event.localEventId
          ? { ...row, status: 'queued', error: undefined }
          : row,
      );
      onDone?.();
    },
  }),
}));
vi.mock('@/components/data-table/responsive-columns', async (original) => ({
  ...(await original<typeof import('@/components/data-table/responsive-columns')>()),
  useElementWidth: () => {
    const [element, measure] = useState<HTMLElement | null>(null);
    return [
      measure,
      element?.closest('[role=dialog]') ? Math.min(local.width - 32, 736) : local.width,
    ];
  },
}));
it.each([
  ['queued', 1440],
  ['accepted', 1440],
  ['sending', 1440],
  ['refused', 1440],
  ['refused', 390],
  ['uncertain', 390],
] as const)(
  'keeps %s event details and recovery at width %s while the live event disappears',
  async (status, width) => {
    local.width = width;
    const line = newEventLine(
      {
        orderable: { id: 'p', productCode: 'P', fullProductName: 'Product' },
        lot: null,
        stockOnHand: 20,
      },
      undefined,
      '2026-10-14',
      { kind: 'adjustment', productHasLots: false },
    );
    local.events = [
      {
        localEventId: 'e',
        draftId: 'd',
        revision: 1,
        kind: 'adjustment',
        userId: 'u',
        sequence: 1,
        facilityId: 'f',
        programId: 'p',
        facility: { id: 'f', code: 'F', name: 'Facility' },
        program: { id: 'p', code: 'P', name: 'Program' },
        queuedAt: Date.UTC(2026, 9, 15),
        status,
        lines: [line, { ...line, key: 'second-line' }],
        postBody: '',
        payload: {
          facilityId: 'f',
          programId: 'p',
          lineItems: [
            {
              orderableId: 'p',
              quantity: 12,
              occurredDate: '2026-10-13',
              reasonId: 'damaged',
              ...(status === 'queued'
                ? {
                    reasonFreeText: 'Broken packaging',
                    extraData: { vvmStatus: 'STAGE_1' as const },
                  }
                : {}),
            },
            { orderableId: 'p', quantity: 7, occurredDate: '2026-10-14', reasonId: 'lost' },
          ],
        },
        reasons: [
          { id: 'damaged', name: 'Damaged' },
          { id: 'lost', name: 'Lost' },
        ],
      },
    ];
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    client.setQueryData(deploymentTimeZoneOptions().queryKey, { zone: 'UTC', read: true });
    function Page() {
      const navigation = useSearchNavigation<OfflineEventsSearch>({ event: undefined });
      return (
        <OfflineEventsPage
          search={useSearch({ strict: false })}
          onSearchChange={navigation.updateSearch}
          onOpenEvent={(event) => void navigation.openDialog({ event })}
          onCloseEvent={navigation.closeDialog}
          permissions={parsePermissions([])}
          permissionsUpdatedAt={1}
        />
      );
    }
    const router = renderPage(<Page />, { queryClient: client, path: `/?status=${status}` });
    if (width === 1440) {
      const rows = within(await screen.findByRole('table')).getAllByRole('row');
      expect(rows).toHaveLength(2);
      expect(rows[1]).toHaveTextContent('Facility');
      expect(rows[1]).toHaveTextContent('Program');
      expect(rows[1]).not.toHaveTextContent('Damaged');
      await userEvent.click(
        within(rows[1]).getByRole('button', { name: 'offline-events.details-label' }),
      );
      const details = await screen.findByRole('dialog');
      expect(details).toHaveTextContent(
        /Product.*stock-events\.product-has-no-lots.*12.*Damaged.*Product.*7.*Lost/,
      );
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getByRole('columnheader', { name: 'offline-events.date' })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'offline-events.actions-label' }));
      if (['queued', 'accepted', 'refused'].includes(status)) {
        await userEvent.click(
          await screen.findByRole('menuitem', {
            name: status === 'refused' ? 'offline-events.dismiss' : 'offline-events.remove',
          }),
        );
        const confirmation = within(screen.getByRole('alertdialog'));
        expect(
          confirmation.getByText(
            status === 'accepted'
              ? 'offline-events.remove-synced-warning'
              : status === 'refused'
                ? 'offline-events.dismiss-warning'
                : 'offline-events.remove-warning',
          ),
        ).toBeVisible();
        await userEvent.click(confirmation.getByRole('button', { name: 'offline-events.cancel' }));
        await userEvent.click(screen.getByRole('button', { name: 'offline-events.actions-label' }));
      } else
        expect(
          screen.queryByRole('menuitem', { name: 'offline-events.remove' }),
        ).not.toBeInTheDocument();
      await userEvent.click(
        await screen.findByRole('menuitem', { name: 'offline-events.review-event' }),
      );
    } else {
      const card = (await screen.findByText('Facility')).closest('li') as HTMLElement;
      await userEvent.click(
        within(card).getByRole('button', { name: 'offline-events.details-label' }),
      );
      expect(await screen.findByRole('dialog')).toHaveTextContent(
        /Product.*12.*Damaged.*Product.*7.*Lost/,
      );
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      if (status === 'refused') {
        const remove = screen.getByRole('button', { name: 'offline-events.dismiss-event-label' });
        await userEvent.click(remove);
        expect(screen.getByRole('alertdialog')).toHaveTextContent('offline-events.dismiss-warning');
        await userEvent.click(
          within(screen.getByRole('alertdialog')).getByRole('button', {
            name: 'offline-events.cancel',
          }),
        );
      } else
        expect(
          screen.queryByRole('button', { name: 'offline-events.remove-event-label' }),
        ).not.toBeInTheDocument();
      await userEvent.click(
        screen.getByRole('button', { name: 'offline-events.review-event-label' }),
      );
    }
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText('Facility')).toBeVisible();
    expect(dialog.getByText('Program')).toBeVisible();
    expect(dialog.getByText(`offline-events.status-${status}`)).toBeVisible();
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
      `transaction-history.type-adjustment. offline-events.status-${status}`,
    );
    expect(dialog.queryByText('offline-events.attempted-at')).not.toBeInTheDocument();
    expect(dialog.queryByText('stock-event.document-number')).not.toBeInTheDocument();
    if (width === 1440) {
      const rows = within(dialog.getByRole('table')).getAllByRole('row');
      expect(rows).toHaveLength(3);
      expect(rows[1]).toHaveTextContent('Product');
      expect(rows[1]).toHaveTextContent('Damaged');
      expect(rows[2]).toHaveTextContent('Lost');
      for (const name of ['stock-events.vvm-status', 'stock-events.reason-comments']) {
        if (status === 'queued') expect(dialog.getByRole('columnheader', { name })).toBeVisible();
        else expect(dialog.queryByRole('columnheader', { name })).not.toBeInTheDocument();
      }
      if (status === 'queued') expect(rows[1]).toHaveTextContent('Broken packaging');
    } else {
      expect(dialog.queryByRole('table')).not.toBeInTheDocument();
      const lines = dialog.getAllByRole('listitem');
      expect(lines).toHaveLength(2);
      expect(lines[0]).toHaveTextContent('Product');
      expect(lines[0]).toHaveTextContent('Damaged');
      expect(lines[1]).toHaveTextContent('Lost');
    }
    if (status === 'uncertain') {
      const resend = screen.getByRole('button', { name: 'offline-events.send-again' });
      expect(resend).toHaveAttribute('aria-disabled', 'true');
      expect(resend).toHaveAccessibleDescription('offline-events.no-send');
      resend.focus();
      expect(resend).toHaveFocus();
      await userEvent.click(resend);
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    } else if (status === 'queued' || status === 'refused')
      expect(
        screen.getByRole('button', {
          name: status === 'refused' ? 'offline-events.dismiss' : 'offline-events.remove',
        }),
      ).toBeEnabled();
    expect(router.state.location.search).toMatchObject({ event: 'e' });
    const retained = local.events;
    await act(async () => {
      local.events = [];
      await router.invalidate();
    });
    expect(screen.getByRole('dialog')).not.toHaveTextContent('offline-events.not-found-title');
    expect(screen.getByRole('dialog')).toHaveTextContent('offline-events.details');
    await userEvent.click(screen.getByRole('button', { name: 'offline-events.close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect((router.state.location.search as OfflineEventsSearch).event).toBeUndefined();
    local.events = retained;
    await act(async () => router.history.forward());
    expect(await screen.findByRole('dialog')).toBeVisible();
  },
);

it('opens a directly linked event, replaces search on close, and explains a missing event', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(deploymentTimeZoneOptions().queryKey, { zone: 'UTC', read: true });
  local.events = [];
  function Page() {
    const navigation = useSearchNavigation<OfflineEventsSearch>({ event: undefined });
    return (
      <OfflineEventsPage
        search={useSearch({ strict: false })}
        onSearchChange={navigation.updateSearch}
        onOpenEvent={(event) => void navigation.openDialog({ event })}
        onCloseEvent={navigation.closeDialog}
        permissions={parsePermissions([])}
        permissionsUpdatedAt={1}
      />
    );
  }
  const router = renderPage(<Page />, { queryClient: client, path: '/?event=missing' });
  expect(await screen.findByRole('dialog')).toHaveTextContent('offline-events.not-found-title');
  await userEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
  await waitFor(() =>
    expect((router.state.location.search as OfflineEventsSearch).event).toBeUndefined(),
  );
  expect(router.history.canGoBack()).toBe(false);
});

beforeEach(() => {
  localStorage.clear();
});

function fixture(
  name: string,
  status: DeviceEvent['status'],
  sequence: number,
  timestamp: number,
): DeviceEvent {
  const line = newEventLine(
    {
      orderable: { id: 'product', productCode: 'P', fullProductName: 'Product' },
      lot: null,
      stockOnHand: 20,
    },
    undefined,
    '2026-10-12',
    { kind: 'adjustment', productHasLots: false },
  );
  const event: DeviceEvent = {
    localEventId: name,
    draftId: name,
    revision: 1,
    kind: 'adjustment',
    userId: 'u',
    facilityId: 'f',
    programId: 'p',
    facility: { id: 'f', code: 'F', name },
    program: { id: 'p', code: 'P', name: 'Program' },
    status,
    sequence,
    queuedAt: timestamp,
    lines: [line],
    postBody: '',
    payload: {
      facilityId: 'f',
      programId: 'p',
      lineItems: [{ orderableId: 'product', quantity: 1, occurredDate: '2026-10-12' }],
    },
  };
  if (status === 'refused' || status === 'uncertain')
    event.error = {
      localEventId: name,
      facilityId: 'f',
      programId: 'p',
      event: { ...event, status: 'uncertain' },
      category: status,
      message: '',
      failedAt: timestamp,
    };
  if (status === 'accepted')
    event.receipt = {
      localEventId: name,
      draftId: name,
      revision: 1,
      source: 'server',
      acceptedAt: timestamp,
    };
  return event;
}

function mount(path = '/', permissionStrings: string[] = []) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(deploymentTimeZoneOptions().queryKey, { zone: 'UTC', read: true });
  const permissions = parsePermissions(permissionStrings);
  let refresh = () => {};
  function Page() {
    const [, setVersion] = useState(0);
    refresh = () => setVersion((version) => version + 1);
    const navigation = useSearchNavigation<OfflineEventsSearch>({ event: undefined });
    return (
      <OfflineEventsPage
        search={useSearch({ strict: false })}
        onSearchChange={navigation.updateSearch}
        onOpenEvent={(event) => void navigation.openDialog({ event })}
        onCloseEvent={navigation.closeDialog}
        permissions={permissions}
        permissionsUpdatedAt={1}
      />
    );
  }
  const router = renderPage(<Page />, { queryClient: client, path });
  return { router, refresh: () => act(refresh) };
}

it.each([1440, 390])(
  'orders each tab by its own default and applies explicit date sorting at width %s',
  async (width) => {
    local.width = width;
    local.events = [
      fixture('Pending Later', 'queued', 3, 20),
      fixture('Pending First', 'queued', 1, 10),
      fixture('Error Later', 'refused', 2, 30),
      fixture('Error First', 'uncertain', 4, 15),
      fixture('Synced Older', 'accepted', 5, 5),
      fixture('Synced Newer', 'accepted', 6, 25),
    ];
    const { router } = mount();
    const order = () =>
      screen
        .getAllByText(
          /^(Pending Later|Pending First|Error Later|Error First|Synced Older|Synced Newer)$/,
        )
        .map((item) => item.textContent);
    await waitFor(() => expect(order()).toEqual(['Pending First', 'Pending Later']));
    await userEvent.click(screen.getByRole('tab', { name: /offline-events.tab-errors/ }));
    await waitFor(() => expect(order()).toEqual(['Error First', 'Error Later']));
    await userEvent.click(screen.getByRole('tab', { name: /offline-events.tab-synced/ }));
    await waitFor(() => expect(order()).toEqual(['Synced Newer', 'Synced Older']));
    if (width === 1440)
      await userEvent.click(screen.getByRole('button', { name: 'offline-events.synced-at' }));
    else await act(async () => router.history.push('/?tab=synced&sort=acceptedAt&dir=asc'));
    await waitFor(() => expect(order()).toEqual(['Synced Older', 'Synced Newer']));
    local.events = local.events.map((event) =>
      event.localEventId === 'Synced Older'
        ? {
            ...event,
            payload: {
              ...event.payload,
              lineItems: [{ ...event.payload.lineItems[0], occurredDate: '2026-10-14' }],
            },
          }
        : event,
    );
    await act(async () => router.history.push('/?tab=synced&sort=occurredDate&dir=desc'));
    await waitFor(() => expect(order()).toEqual(['Synced Older', 'Synced Newer']));
  },
);

it.each([
  ['queued', undefined],
  ['refused', 'errors'],
  ['accepted', 'synced'],
] as const)('replaces an old %s status link with its tab', async (status, expectedTab) => {
  local.width = 1440;
  local.events = [fixture('Event', status, 1, 10)];
  const { router } = mount(`/?status=${status}`);
  await screen.findByText('Event');
  await waitFor(() => expect(router.state.location.search).not.toHaveProperty('status'));
  expect((router.state.location.search as OfflineEventsSearch).tab).toBe(expectedTab);
  expect(router.history.canGoBack()).toBe(false);
});

it('keeps an explicit tab over a legacy status', async () => {
  local.events = [fixture('Synced', 'accepted', 1, 10)];
  const { router } = mount('/?tab=synced&status=refused');
  await screen.findByText('Synced');
  await waitFor(() => expect(router.state.location.search).toEqual({ tab: 'synced' }));
});

it('preserves filters and controls through tabs and Back, clamps live removals, keeps moving event details, and restores each tab’s columns', async () => {
  local.width = 1440;
  local.events = [
    ...Array.from({ length: 11 }, (_, index) =>
      fixture(`Pending ${index + 1}`, 'queued', index + 1, index),
    ),
    fixture('Error', 'refused', 12, 12),
  ];
  const { router, refresh } = mount(
    '/?eventType=adjustment&startDate=2026-10-12&endDate=2026-10-13&page=2',
  );
  await screen.findByText('Pending 11');
  const filters = screen.getByRole('button', { name: /Filters/ });
  const header = screen.getByRole('heading', { name: 'offline-events.title' });
  await userEvent.click(screen.getByRole('button', { name: 'View' }));
  await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'offline-events.status' }));
  await userEvent.keyboard('{Escape}');
  await userEvent.click(screen.getByRole('tab', { name: /offline-events.tab-errors/ }));
  await screen.findByText('Error');
  expect(router.state.location.search).toMatchObject({
    tab: 'errors',
    eventType: 'adjustment',
    startDate: '2026-10-12',
    endDate: '2026-10-13',
  });
  expect(router.state.location.search).not.toHaveProperty('page');
  expect(screen.getByRole('button', { name: /Filters/ })).toBe(filters);
  expect(screen.getByRole('heading', { name: 'offline-events.title' })).toBe(header);
  await userEvent.click(screen.getByRole('button', { name: 'View' }));
  await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'offline-events.failed-at' }));
  await userEvent.keyboard('{Escape}');
  await act(async () => router.history.back());
  await screen.findByText('Pending 11');
  expect(
    screen.queryByRole('columnheader', { name: 'offline-events.status' }),
  ).not.toBeInTheDocument();
  local.events = local.events.filter((event) => event.localEventId !== 'Pending 11');
  refresh();
  await waitFor(() =>
    expect((router.state.location.search as OfflineEventsSearch).page).toBeUndefined(),
  );
  await screen.findByText('Pending 1');
  await userEvent.click(screen.getAllByRole('button', { name: 'offline-events.actions-label' })[0]);
  await userEvent.click(
    await screen.findByRole('menuitem', { name: 'offline-events.review-event' }),
  );
  await screen.findByRole('dialog');
  local.events = local.events.map((event) =>
    event.localEventId === 'Pending 1'
      ? {
          ...event,
          status: 'accepted',
          receipt: {
            localEventId: event.localEventId,
            draftId: event.draftId,
            revision: event.revision,
            source: 'server',
            acceptedAt: 99,
          },
        }
      : event,
  );
  refresh();
  await waitFor(() =>
    expect(screen.getByRole('dialog')).toHaveTextContent('offline-events.status-accepted'),
  );
  expect((router.state.location.search as OfflineEventsSearch).event).toBe('Pending 1');
  await userEvent.click(screen.getByRole('button', { name: 'offline-events.close' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await userEvent.click(screen.getByRole('tab', { name: /offline-events.tab-errors/ }));
  await screen.findByText('Error');
  expect(
    screen.queryByRole('columnheader', { name: 'offline-events.failed-at' }),
  ).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'View' }));
  await userEvent.click(screen.getByRole('menuitem', { name: 'Reset Columns' }));
  await userEvent.keyboard('{Escape}');
  expect(screen.getByRole('columnheader', { name: 'offline-events.failed-at' })).toBeVisible();
  await userEvent.click(screen.getByRole('tab', { name: /offline-events.tab-pending/ }));
  await screen.findByText('Pending 2');
  expect(
    screen.queryByRole('columnheader', { name: 'offline-events.status' }),
  ).not.toBeInTheDocument();
});

it('validates event type and calendar dates from links', () => {
  expect(
    offlineEventsSearchSchema.parse({
      eventType: 'adjustment',
      startDate: '2026-10-12',
      endDate: '2026-10-13',
    }),
  ).toMatchObject({ eventType: 'adjustment', startDate: '2026-10-12', endDate: '2026-10-13' });
  expect(
    offlineEventsSearchSchema.parse({
      eventType: 'unpack',
      startDate: '2026-02-30',
      endDate: 'invalid',
    }),
  ).toEqual({ eventType: undefined, startDate: undefined, endDate: undefined });
});

it('keeps focus in the list after Retry moves a row to Pending', async () => {
  local.width = 1440;
  local.events = [fixture('Refused', 'refused', 1, 10)];
  const { refresh } = mount('/?tab=errors', ['STOCK_ADJUST|f|p']);
  await userEvent.click(
    await screen.findByRole('button', { name: 'offline-events.actions-label' }),
  );
  await userEvent.click(
    await screen.findByRole('menuitem', { name: 'offline-events.retry-refused' }),
  );
  refresh();
  await waitFor(() => expect(screen.queryByText('Refused')).not.toBeInTheDocument());
  expect(document.activeElement).toContainElement(
    screen.getByText('offline-events.no-errors-title'),
  );
  expect(document.activeElement).not.toBe(document.body);
});

it('keeps an open Dismiss confirmation through unrelated live changes', async () => {
  local.width = 1440;
  local.events = [fixture('Refused', 'refused', 1, 10)];
  const { refresh } = mount('/?tab=errors');
  await userEvent.click(
    await screen.findByRole('button', { name: 'offline-events.actions-label' }),
  );
  await userEvent.click(await screen.findByRole('menuitem', { name: 'offline-events.dismiss' }));
  const confirmation = await screen.findByRole('alertdialog');
  local.events = [...local.events, fixture('Unrelated', 'queued', 2, 20)];
  refresh();
  expect(screen.getByRole('alertdialog')).toBe(confirmation);
});

it('labels the active panel and keeps it and its toolbar mounted through tabs', async () => {
  local.width = 1440;
  local.events = [];
  mount();
  const panel = await screen.findByRole('tabpanel');
  const pending = screen.getByRole('tab', { name: /offline-events.tab-pending/ });
  expect(pending).toHaveAttribute('aria-controls', panel.id);
  expect(panel).toHaveAttribute('aria-labelledby', pending.id);
  const filters = screen.getByRole('button', { name: /Filters/ });
  await userEvent.click(screen.getByRole('tab', { name: /offline-events.tab-errors/ }));
  expect(screen.getByRole('tabpanel')).toBe(panel);
  expect(screen.getByRole('button', { name: /Filters/ })).toBe(filters);
  expect(panel).toHaveAttribute(
    'aria-labelledby',
    screen.getByRole('tab', { name: /offline-events.tab-errors/ }).id,
  );
});

it('hides events outside the date range and restores them with Clear Filters', async () => {
  local.width = 1440;
  local.events = [fixture('Outside Range', 'queued', 1, 10)];
  mount('/?startDate=2026-10-13');
  await screen.findByText('offline-events.no-matches-title');
  expect(screen.queryByText('Outside Range')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'data-table.clear-filters' }));
  expect(await screen.findByText('Outside Range')).toBeVisible();
});
