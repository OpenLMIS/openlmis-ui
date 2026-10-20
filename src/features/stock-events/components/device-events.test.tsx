import { QueryClient } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import { deploymentTimeZoneOptions } from '@/features/reference-data/api/queries';
import { DeviceEventsPage } from '@/features/stock-events/components/device-events';
import type { DeviceEventsSearch } from '@/features/stock-events/lib/device-events-search';
import { newEventLine } from '@/features/stock-events/lib/event-form';
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { parsePermissions } from '@/lib/permissions';
import { renderPage } from '@/tests/render-page';

vi.mock('@/components/nav-access', () => ({ useCanOpen: () => () => true }));
const local = vi.hoisted(() => ({ events: [] as DeviceEvent[], width: 1440 }));
vi.mock('@/features/stock-events/hooks/use-device-events', () => ({
  useDeviceEvents: () => local,
  useHasDeviceEvents: () => false,
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
  ['uncertain', 1440],
  ['refused', 390],
  ['sending', 390],
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
      const navigation = useSearchNavigation<DeviceEventsSearch>({ event: undefined });
      return (
        <DeviceEventsPage
          search={useSearch({ strict: false })}
          onSearchChange={navigation.updateSearch}
          onOpenEvent={(event) => void navigation.openDialog({ event })}
          onCloseEvent={navigation.closeDialog}
          permissions={parsePermissions([])}
          permissionsUpdatedAt={1}
        />
      );
    }
    const router = renderPage(<Page />, { queryClient: client });
    if (width === 1440) {
      const rows = within(await screen.findByRole('table')).getAllByRole('row');
      expect(rows).toHaveLength(2);
      expect(rows[1]).toHaveTextContent('Facility');
      expect(rows[1]).toHaveTextContent('Program');
      expect(screen.queryByText('Product')).not.toBeInTheDocument();
      expect(screen.queryByText('Damaged')).not.toBeInTheDocument();
      expect(
        screen.getByRole('columnheader', { name: 'device-events.occurred-date' }),
      ).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'device-events.actions-label' }));
      const viewItem = await screen.findByRole('menuitem', { name: 'device-events.review-event' });
      expect(viewItem.querySelector('svg.lucide-eye')).not.toBeNull();
      if (['queued', 'accepted', 'refused'].includes(status)) {
        const removeItem = screen.getByRole('menuitem', { name: 'device-events.remove' });
        expect(removeItem).toHaveAttribute('data-variant', 'destructive');
        expect(removeItem.querySelector('svg.lucide-trash-2')).not.toBeNull();
        await userEvent.click(
          await screen.findByRole('menuitem', { name: 'device-events.remove' }),
        );
        const confirmation = within(screen.getByRole('alertdialog'));
        expect(
          confirmation.getByText(
            status === 'accepted'
              ? 'device-events.remove-synced-warning'
              : status === 'refused'
                ? 'device-events.remove-refused-warning'
                : 'device-events.remove-warning',
          ),
        ).toBeVisible();
        await userEvent.click(confirmation.getByRole('button', { name: 'device-events.cancel' }));
        await userEvent.click(screen.getByRole('button', { name: 'device-events.actions-label' }));
      } else
        expect(
          screen.queryByRole('menuitem', { name: 'device-events.remove' }),
        ).not.toBeInTheDocument();
      await userEvent.click(
        await screen.findByRole('menuitem', { name: 'device-events.review-event' }),
      );
    } else {
      await screen.findByText('Facility');
      expect(screen.queryByText('Product')).not.toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      if (status === 'refused') {
        const remove = screen.getByRole('button', { name: 'device-events.remove-event-label' });
        expect(remove.querySelector('svg.lucide-trash-2')).not.toBeNull();
        await userEvent.click(remove);
        expect(screen.getByRole('alertdialog')).toHaveTextContent(
          'device-events.remove-refused-warning',
        );
        await userEvent.click(
          within(screen.getByRole('alertdialog')).getByRole('button', {
            name: 'device-events.cancel',
          }),
        );
      } else
        expect(
          screen.queryByRole('button', { name: 'device-events.remove-event-label' }),
        ).not.toBeInTheDocument();
      expect(
        screen
          .getByRole('button', { name: 'device-events.review-event-label' })
          .querySelector('svg.lucide-eye'),
      ).not.toBeNull();
      await userEvent.click(
        screen.getByRole('button', { name: 'device-events.review-event-label' }),
      );
    }
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText('Facility')).toBeVisible();
    expect(dialog.getByText('Program')).toBeVisible();
    expect(dialog.getByText(`device-events.status-${status}`)).toHaveAttribute(
      'data-slot',
      'badge',
    );
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
      `nav.stock-management.adjustments. device-events.status-${status}`,
    );
    const pending =
      dialog.getByText('device-events.type').parentElement?.parentElement?.parentElement;
    expect(pending).toHaveTextContent(`device-events.status-${status}`);
    expect(dialog.queryByText('device-events.attempted-at')).not.toBeInTheDocument();
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
    if (status === 'uncertain')
      expect(screen.getByRole('button', { name: 'device-events.send-again' })).toBeDisabled();
    else if (status === 'queued' || status === 'refused')
      expect(
        screen.getByRole('button', {
          name: 'device-events.remove',
        }),
      ).toBeEnabled();
    expect(router.state.location.search).toMatchObject({ event: 'e' });
    const retained = local.events;
    await act(async () => {
      local.events = [];
      await router.invalidate();
    });
    expect(screen.getByRole('dialog')).not.toHaveTextContent('device-events.not-found-title');
    expect(screen.getByRole('dialog')).toHaveTextContent('device-events.details');
    await userEvent.click(screen.getByRole('button', { name: 'device-events.close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect((router.state.location.search as DeviceEventsSearch).event).toBeUndefined();
    local.events = retained;
    router.history.forward();
    expect(await screen.findByRole('dialog')).toBeVisible();
  },
);

it('opens a directly linked event, replaces search on close, and explains a missing event', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(deploymentTimeZoneOptions().queryKey, { zone: 'UTC', read: true });
  local.events = [];
  function Page() {
    const navigation = useSearchNavigation<DeviceEventsSearch>({ event: undefined });
    return (
      <DeviceEventsPage
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
  expect(await screen.findByRole('dialog')).toHaveTextContent('device-events.not-found-title');
  await userEvent.click(screen.getByRole('button', { name: 'dialog.close' }));
  await waitFor(() =>
    expect((router.state.location.search as DeviceEventsSearch).event).toBeUndefined(),
  );
  expect(router.history.canGoBack()).toBe(false);
});

it.each([1440, 390])(
  'orders events newest first and respects URL sorting at width %s',
  async (width) => {
    const user = userEvent.setup();
    local.width = width;
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
    const event = (
      name: string,
      status: DeviceEvent['status'],
      date: string,
      queuedAt: number,
      sequence: number,
    ): DeviceEvent => ({
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
      queuedAt,
      sequence,
      lines: [{ ...line, orderable: { ...line.orderable, fullProductName: name } }],
      postBody: '',
      payload: {
        facilityId: 'f',
        programId: 'p',
        lineItems: [{ orderableId: 'product', quantity: 1, occurredDate: date }],
      },
    });
    local.events = [
      event('First', 'queued', '2026-10-13', 0, 3),
      event('Second', 'refused', '2026-10-12', 20, 1),
      event('Third', 'uncertain', '2026-10-12', 10, 2),
    ];
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    client.setQueryData(deploymentTimeZoneOptions().queryKey, { zone: 'UTC', read: true });
    let refresh = () => {};
    function Page() {
      const [, setVersion] = useState(0);
      refresh = () => setVersion((version) => version + 1);
      const navigation = useSearchNavigation<DeviceEventsSearch>({ event: undefined });
      return (
        <DeviceEventsPage
          search={useSearch({ strict: false })}
          onSearchChange={navigation.updateSearch}
          onOpenEvent={(event) => void navigation.openDialog({ event })}
          onCloseEvent={navigation.closeDialog}
          permissions={parsePermissions([])}
          permissionsUpdatedAt={1}
        />
      );
    }
    const router = renderPage(<Page />, { queryClient: client });
    await screen.findByText('First');
    const order = () =>
      screen.getAllByText(/^(First|Second|Third)$/).map((item) => item.textContent);
    expect(order()).toEqual(['First', 'Second', 'Third']);
    await act(async () => {
      local.events = local.events.map((event) =>
        event.localEventId === 'Third' ? { ...event, queuedAt: 20 } : event,
      );
      refresh();
    });
    expect(order()).toEqual(['First', 'Third', 'Second']);
    await act(async () => {
      router.history.push('/?sort=occurredDate&dir=asc');
    });
    await waitFor(() => expect(order()).toEqual(['Second', 'Third', 'First']));
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await user.click(screen.getByRole('combobox', { name: 'device-events.status' }));
    await user.click(await screen.findByRole('option', { name: 'device-events.status-refused' }));
    await waitFor(() => expect(order()).toEqual(['Second']));
    expect(router.state.location.search).toMatchObject({ status: 'refused' });
    await user.click(screen.getByRole('button', { name: 'Clear Filters' }));
    await waitFor(() => expect(order()).toEqual(['Second', 'Third', 'First']));
    expect((router.state.location.search as DeviceEventsSearch).status).toBeUndefined();
  },
);
