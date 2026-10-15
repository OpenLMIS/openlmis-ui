import { QueryClient } from '@tanstack/react-query';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { deploymentTimeZoneOptions } from '@/features/reference-data/api/queries';
import { DeviceEventsPage } from '@/features/stock-events/components/device-events';
import { newEventLine } from '@/features/stock-events/lib/event-form';
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';
import { parsePermissions } from '@/lib/permissions';
import { renderPage } from '@/tests/render-page';

vi.mock('@/components/nav-access', () => ({ useCanOpen: () => () => true }));
const local = vi.hoisted(() => ({ events: [] as DeviceEvent[] }));
vi.mock('@/features/stock-events/hooks/use-device-events', () => ({
  useDeviceEvents: () => local,
  useHasDeviceEvents: () => false,
}));
vi.mock('@/components/data-table/responsive-columns', async (original) => ({
  ...(await original<typeof import('@/components/data-table/responsive-columns')>()),
  useElementWidth: () => [() => {}, 1440],
}));
it('keeps each frozen line quantity, reason and date aligned and identifies its review action', async () => {
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
      status: 'uncertain',
      lines: [line, line],
      postBody: '',
      payload: {
        facilityId: 'f',
        programId: 'p',
        lineItems: [
          { orderableId: 'p', quantity: 12, occurredDate: '2026-10-13', reasonId: 'damaged' },
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
  renderPage(
    <DeviceEventsPage
      search={{}}
      onSearchChange={vi.fn()}
      permissions={parsePermissions([])}
      permissionsUpdatedAt={1}
    />,
    { queryClient: client },
  );
  const rows = within(await screen.findByRole('table')).getAllByRole('row');
  expect(rows[1]).toHaveTextContent('12');
  expect(rows[1]).toHaveTextContent('Damaged');
  expect(rows[2]).toHaveTextContent('7');
  expect(rows[2]).toHaveTextContent('Lost');
  expect(
    screen.getByRole('columnheader', { name: 'device-events.occurred-date' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'device-events.review-event-label' }),
  ).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'device-events.review-event-label' }));
  await userEvent.click(
    await screen.findByRole('menuitem', { name: 'device-events.review-event' }),
  );
  expect(screen.getByRole('button', { name: 'device-events.send-again' })).toBeDisabled();
});
