import { expect, it } from 'vitest';
import { deviceEventDetails } from '@/features/stock-events/lib/device-event-details';
import { newEventLine } from '@/features/stock-events/lib/event-form';
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';

it('lists only saved kit lines when the payload also contains unpacked children', () => {
  const line = newEventLine(
    {
      orderable: { id: 'kit', productCode: 'KIT', fullProductName: 'Medical kit' },
      lot: null,
      stockOnHand: 10,
    },
    undefined,
    '2026-10-23',
    { kind: 'unpack', productHasLots: false },
  );
  const event: DeviceEvent = {
    localEventId: 'event',
    draftId: 'draft',
    revision: 1,
    kind: 'unpack',
    userId: 'user',
    sequence: 1,
    facilityId: 'facility',
    programId: 'program',
    facility: { id: 'facility', code: 'F', name: 'Facility' },
    program: { id: 'program', code: 'P', name: 'Program' },
    queuedAt: 1,
    status: 'queued',
    lines: [line],
    postBody: '',
    payload: {
      facilityId: 'facility',
      programId: 'program',
      lineItems: [
        { orderableId: 'kit', quantity: 2, occurredDate: '2026-10-23' },
        { orderableId: 'child-id', quantity: 20, occurredDate: '2026-10-23' },
      ],
    },
  };

  expect(deviceEventDetails(event)).toEqual([
    expect.objectContaining({
      key: line.key,
      product: 'Medical kit',
      item: event.payload.lineItems[0],
    }),
  ]);
});
