import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { DeviceEventLines } from '@/features/stock-events/components/device-event-lines';
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';

vi.mock('@/hooks/use-card-view', () => ({
  useCardLayout: () => ({ measure: () => {}, cards: false }),
}));

it.each([
  ['issue', 'stock-events.issue-to', 'Destination', 'Delivered to clinic'],
  ['receive', 'stock-events.received-from', 'Source', 'Received from warehouse'],
] as const)(
  'shows the %s counterparty snapshot and comments for its kind',
  (kind, header, name, comments) => {
    const event: DeviceEvent = {
      kind,
      userId: 'u',
      localEventId: 'e',
      draftId: 'd',
      revision: 1,
      facilityId: 'f',
      programId: 'p',
      sequence: 1,
      queuedAt: 1,
      status: 'queued',
      facility: { id: 'f', code: 'F', name: 'Facility' },
      program: { id: 'p', code: 'P', name: 'Program' },
      destinations: [{ id: 'node', name: 'Destination' }],
      sources: [{ id: 'node', name: 'Source' }],
      lines: [],
      postBody: '',
      payload: {
        facilityId: 'f',
        programId: 'p',
        lineItems: [
          {
            orderableId: 'product',
            quantity: 3,
            extraData: { vvmStatus: 'STAGE_1' },
            occurredDate: '2026-10-20',
            destinationId: 'node',
            destinationFreeText: 'Delivered to clinic',
            sourceId: 'node',
            sourceFreeText: 'Received from warehouse',
          },
        ],
      },
    };
    render(<DeviceEventLines event={event} />);
    expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: comments })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'stock-events.stage-1' })).toBeInTheDocument();
    expect(screen.queryByText('STAGE_1')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('cell', { name: kind === 'issue' ? 'Source' : 'Destination' }),
    ).not.toBeInTheDocument();
  },
);
