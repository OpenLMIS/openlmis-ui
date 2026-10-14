import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { DeviceEventRecovery } from '@/features/stock-events/components/device-event-recovery';
import { newEventLine } from '@/features/stock-events/lib/event-form';
import {
  createStockEventContext,
  saveStockEventDraft,
} from '@/features/stock-events/lib/stock-event-local';
import { enqueueStockEvent } from '@/features/stock-events/lib/stock-event-queue';
import { recoverSending } from '@/features/stock-events/lib/stock-event-sync';
import { client } from '@/integrations/axios';
import { getLocalDb } from '@/integrations/local-db';
import { wakeStockEventSync } from '@/lib/device-event-status';

vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof import('@tanstack/react-router')>()),
  useNavigate: () => vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/lib/device-event-status', () => ({
  wakeStockEventSync: vi.fn(),
  announceQueuedEvents: vi.fn(),
}));
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
beforeEach(async () => {
  useLoginData
    .getState()
    .setLoginData({ referenceDataUserId: 'recovery', username: 'Ada', accessToken: 'token' });
  for (const table of [
    'stockEventDrafts',
    'stockEventQueue',
    'stockEventReceipts',
    'stockEventSyncErrors',
  ])
    await getLocalDb().table(table).clear();
});
async function open() {
  const context = createStockEventContext({
    kind: 'adjustment',
    facilityId: 'home',
    programId: 'one',
  });
  const draft = await saveStockEventDraft(context, undefined, [line]);
  if (!draft) throw new Error('Missing draft');
  const event = await enqueueStockEvent(
    context,
    draft,
    { facilityId: 'home', programId: 'one', lineItems: [] },
    {
      facility: { id: 'home', code: 'H', name: 'Home' },
      program: { id: 'one', code: 'one', name: 'One' },
    },
  );
  await getLocalDb()
    .table('stockEventQueue')
    .update(event.sequence, { status: 'sending', attemptId: 'a' });
  await recoverSending(getLocalDb(), event.userId, () => {});
  const uncertain = await getLocalDb().table('stockEventQueue').get(event.sequence);
  const onClose = vi.fn();
  vi.spyOn(client, 'get');
  vi.spyOn(client, 'post');
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DeviceEventRecovery event={uncertain} canView={false} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { uncertain, onClose };
}
it('no-view recovery calls no history, cancel keeps uncertainty, only confirmed Send Again releases it', async () => {
  const { uncertain, onClose } = await open();
  expect(screen.getByText('device-events.no-view')).toBeVisible();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'device-events.send-again' }));
  const warning = screen.getByRole('alertdialog');
  expect(warning).toHaveTextContent('device-events.duplicate-warning');
  await userEvent.click(within(warning).getByRole('button', { name: 'device-events.cancel' }));
  expect((await getLocalDb().table('stockEventQueue').get(uncertain.sequence)).status).toBe(
    'uncertain',
  );
  expect(wakeStockEventSync).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'device-events.send-again' }));
  await userEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'device-events.send-again',
    }),
  );
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect((await getLocalDb().table('stockEventQueue').get(uncertain.sequence)).status).toBe(
    'queued',
  );
  expect(client.get).not.toHaveBeenCalled();
  expect(client.post).not.toHaveBeenCalled();
});
it('no-view It Was Recorded records the exact user-confirmed receipt without network calls', async () => {
  const { uncertain, onClose } = await open();
  await userEvent.click(screen.getByRole('button', { name: 'device-events.recorded' }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(
    (await getLocalDb().table('stockEventReceipts').get([uncertain.draftId, uncertain.revision]))
      .source,
  ).toBe('user');
  expect(await getLocalDb().table('stockEventQueue').count()).toBe(0);
  expect(client.get).not.toHaveBeenCalled();
  expect(client.post).not.toHaveBeenCalled();
});

it('a stale recovery choice explains that the event changed without repeating it', async () => {
  const { uncertain, onClose } = await open();
  await getLocalDb()
    .table('stockEventQueue')
    .update(uncertain.sequence, { attemptId: 'new-attempt' });
  await userEvent.click(screen.getByRole('button', { name: 'device-events.recorded' }));
  await waitFor(() =>
    expect(toast.warning).toHaveBeenCalledWith('device-events.changed-title', {
      description: 'device-events.changed-description',
    }),
  );
  expect(onClose).toHaveBeenCalledOnce();
  expect(await getLocalDb().table('stockEventReceipts').count()).toBe(0);
  expect((await getLocalDb().table('stockEventQueue').get(uncertain.sequence)).attemptId).toBe(
    'new-attempt',
  );
});
