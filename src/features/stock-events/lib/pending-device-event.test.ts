import { expect, it } from 'vitest';
import { isPendingDeviceEvent } from '@/features/stock-events/lib/pending-device-event';

it('counts queued, sending, uncertain and unresolved refused events as pending', () => {
  const events: Parameters<typeof isPendingDeviceEvent>[0][] = [
    { status: 'queued' },
    { status: 'sending' },
    { status: 'uncertain' },
    { status: 'accepted' },
    { status: 'refused' },
    { status: 'refused', error: { resolvedAt: 1 } },
  ];
  expect(events.map(isPendingDeviceEvent)).toEqual([true, true, true, false, true, false]);
});
