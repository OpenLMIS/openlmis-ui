import { onlineManager, QueryClient } from '@tanstack/react-query';
import { act, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { toast } from 'sonner';
import { beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { deploymentTimeZoneOptions } from '@/features/reference-data/api/queries';
import { DeviceEventRecovery } from '@/features/stock-events/components/device-event-recovery';
import { OfflineEventsPage } from '@/features/stock-events/components/offline-events';
import { useOfflineEvents } from '@/features/stock-events/hooks/use-offline-events';
import { wakeStockEventSync } from '@/features/stock-events/lib/device-event-status';
import { announceDeviceSave } from '@/features/stock-events/lib/device-save-announcement';
import { newEventLine } from '@/features/stock-events/lib/event-form';
import type { ConfiguredEventKind } from '@/features/stock-events/lib/event-kinds';
import {
  createStockEventContext,
  saveStockEventDraft,
} from '@/features/stock-events/lib/stock-event-local';
import { enqueueStockEvent } from '@/features/stock-events/lib/stock-event-queue';
import {
  type DeviceEvent,
  recoverSending,
  syncStockEvents,
} from '@/features/stock-events/lib/stock-event-sync';
import { countUnsyncedDeviceWork } from '@/features/stock-events/lib/unsynced-device-work';
import { client } from '@/integrations/axios';
import { getLocalDb } from '@/integrations/local-db';
import { parsePermissions } from '@/lib/permissions';
import { renderPage } from '@/tests/render-page';

vi.mock('@/features/stock-events/lib/device-save-announcement', async (original) => ({
  ...(await original<typeof import('@/features/stock-events/lib/device-save-announcement')>()),
  announceDeviceSave: vi.fn(),
}));
const navigation = vi.hoisted(() => vi.fn());
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof import('@tanstack/react-router')>()),
  useNavigate: () => navigation,
}));
vi.mock('@/components/nav-access', () => ({ useCanOpen: () => () => true }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/features/stock-events/lib/device-event-status', () => ({
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
async function open(
  canSend = true,
  status: 'queued' | 'uncertain' | 'refused' | 'accepted' = 'uncertain',
  kind: ConfiguredEventKind = 'adjustment',
  renderDialog = true,
) {
  const context = createStockEventContext({
    kind,
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
  let uncertain: DeviceEvent;
  if (status === 'queued') uncertain = event;
  else if (status === 'uncertain') {
    await getLocalDb()
      .table('stockEventQueue')
      .update(event.sequence, { status: 'sending', attemptId: 'a' });
    await recoverSending(getLocalDb(), event.userId, () => {});
    uncertain = await getLocalDb().table('stockEventQueue').get(event.sequence);
  } else {
    await syncStockEvents(getLocalDb(), event.userId, {
      check: () => {},
      canSend: () => true,
      permitted: () => true,
      send: async () =>
        status === 'refused'
          ? {
              status: 400,
              data: { messageKey: 'bad', message: 'Human refusal', internal: 'secret-debug-value' },
            }
          : {
              status: 201,
              data: { id: '11111111-1111-4111-8111-111111111111', documentNumber: 'DOC-42' },
            },
      retryReceipt: async () => {},
      accepted: () => {},
    });
    const error = await getLocalDb().table('stockEventSyncErrors').get(event.localEventId);
    const receipt = await getLocalDb()
      .table('stockEventReceipts')
      .get([event.draftId, event.revision]);
    uncertain = { ...event, status, error, receipt };
  }
  const onClose = vi.fn();
  if (!renderDialog) return { uncertain, onClose };
  vi.spyOn(client, 'get');
  vi.spyOn(client, 'post');
  renderPage(
    <DeviceEventRecovery
      event={uncertain}
      canView={status === 'accepted'}
      canSend={canSend}
      onClose={onClose}
    />,
    { queryClient: new QueryClient() },
  );
  await screen.findByRole('dialog');
  return { uncertain, onClose };
}
it('no-view recovery calls no history, cancel keeps uncertainty, only confirmed Send Again releases it', async () => {
  const { uncertain, onClose } = await open();
  expect(screen.getByText('offline-events.no-view')).toBeVisible();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'offline-events.send-again' }));
  const warning = screen.getByRole('alertdialog');
  expect(warning).toHaveTextContent('offline-events.duplicate-warning');
  await userEvent.click(within(warning).getByRole('button', { name: 'offline-events.cancel' }));
  expect((await getLocalDb().table('stockEventQueue').get(uncertain.sequence)).status).toBe(
    'uncertain',
  );
  expect(wakeStockEventSync).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'offline-events.send-again' }));
  await userEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'offline-events.send-again',
    }),
  );
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect((await getLocalDb().table('stockEventQueue').get(uncertain.sequence)).status).toBe(
    'queued',
  );
  expect(client.get).not.toHaveBeenCalled();
  expect(client.post).not.toHaveBeenCalled();
});
it('It Was Recorded preserves uncertainty on cancel and records only after confirmation', async () => {
  const { uncertain, onClose } = await open();
  await userEvent.click(screen.getByRole('button', { name: 'offline-events.recorded' }));
  const warning = await screen.findByRole('alertdialog');
  expect(warning).toHaveTextContent('offline-events.recorded-warning');
  expect(await getLocalDb().table('stockEventReceipts').count()).toBe(0);
  await userEvent.click(within(warning).getByRole('button', { name: 'offline-events.cancel' }));
  expect((await getLocalDb().table('stockEventQueue').get(uncertain.sequence)).status).toBe(
    'uncertain',
  );
  expect(onClose).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'offline-events.recorded' }));
  await userEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: 'offline-events.recorded',
    }),
  );
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
  await userEvent.click(screen.getByRole('button', { name: 'offline-events.recorded' }));
  await userEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: 'offline-events.recorded',
    }),
  );
  await waitFor(() =>
    expect(toast.warning).toHaveBeenCalledWith('offline-events.changed-title', {
      description: 'offline-events.changed-description',
    }),
  );
  expect(onClose).toHaveBeenCalledOnce();
  expect(await getLocalDb().table('stockEventReceipts').count()).toBe(0);
  expect((await getLocalDb().table('stockEventQueue').get(uncertain.sequence)).attemptId).toBe(
    'new-attempt',
  );
});

it('keeps recorded recovery available after losing adjustment grants but blocks Send Again', async () => {
  const { onClose } = await open(false);
  expect(screen.getByRole('button', { name: 'offline-events.send-again' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  expect(
    screen.getByRole('button', { name: 'offline-events.send-again' }),
  ).toHaveAccessibleDescription('offline-events.no-send');
  await userEvent.click(screen.getByRole('button', { name: 'offline-events.recorded' }));
  await userEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: 'offline-events.recorded',
    }),
  );
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(client.post).not.toHaveBeenCalled();
});

it('dismisses a refusal after confirmation and shows only a human message in details', async () => {
  const { uncertain, onClose } = await open(false, 'refused');
  expect(screen.getByRole('dialog')).toHaveTextContent('Human refusal');
  expect(screen.queryByText(/secret-debug-value/)).not.toBeInTheDocument();
  expect(screen.queryByText('offline-events.revision')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'offline-events.remove' }));
  const warning = screen.getByRole('alertdialog');
  expect(warning).toHaveTextContent('offline-events.remove-refused-warning');
  await userEvent.click(within(warning).getByRole('button', { name: 'offline-events.remove' }));
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(
    (await getLocalDb().table('stockEventSyncErrors').get(uncertain.localEventId)).dismissedAt,
  ).toBeDefined();
  expect(client.post).not.toHaveBeenCalled();
  expect(announceDeviceSave).toHaveBeenCalledWith('offline-events.refused-removed');
  const local = renderHook(() => useOfflineEvents());
  await waitFor(() => expect(local.result.current.events).toEqual([]));
  expect(await countUnsyncedDeviceWork()).toBe(0);
});
it('shows a synced server reference and links straight to its transaction history event', async () => {
  await open(true, 'accepted');
  expect(screen.getByRole('dialog')).toHaveTextContent('11111111-1111-4111-8111-111111111111');
  expect(screen.getByRole('dialog')).toHaveTextContent('DOC-42');
  expect(screen.getByText('offline-events.status-accepted')).toHaveAttribute(
    'data-variant',
    'success',
  );
  expect(screen.getByRole('link', { name: 'offline-events.history' })).toHaveAttribute(
    'href',
    '/stock-management/transaction-history/11111111-1111-4111-8111-111111111111',
  );
  const history = screen.getByRole('link', { name: 'offline-events.history' });
  const close = screen.getByRole('button', { name: 'offline-events.close' });
  const footer = history.closest('[data-slot=dialog-footer]');
  expect(footer?.lastElementChild).toBe(close);
  await waitFor(() => expect(close).toHaveFocus());
  try {
    act(() => onlineManager.setOnline(false));
    await userEvent.click(history);
    const connection = await screen.findByRole('alertdialog');
    expect(connection).toHaveTextContent('offline.navigation-unavailable');
    await userEvent.click(within(connection).getByRole('button', { name: 'dialog.close' }));
    await waitFor(() => expect(history).toHaveFocus());
    expect(navigation).not.toHaveBeenCalled();
    expect(client.get).not.toHaveBeenCalled();
  } finally {
    act(() => onlineManager.setOnline(true));
  }
});

it('opens the correction in the refused event kind editor', async () => {
  const { onClose } = await open(true, 'refused', 'issue');
  await userEvent.click(screen.getByRole('button', { name: 'offline-events.copy' }));
  await userEvent.click(
    within(screen.getByRole('alertdialog')).getByRole('button', { name: 'offline-events.copy' }),
  );
  await waitFor(() =>
    expect(navigation).toHaveBeenCalledWith({
      to: '/stock-management/issue/$programId',
      params: { programId: 'one' },
      replace: true,
    }),
  );
  expect(onClose).not.toHaveBeenCalled();
});

it.each([
  ['queued', 'card'],
  ['accepted', 'card'],
  ['accepted', 'details'],
] as const)(
  'removes %s work from %s after confirmation and focuses the empty list',
  async (status, source) => {
    await open(true, status, 'adjustment', false);
    const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    queryClient.setQueryData(deploymentTimeZoneOptions().queryKey, { zone: 'UTC', read: true });
    function Page() {
      const [event, setEvent] = useState<string>();
      return (
        <OfflineEventsPage
          search={{ event }}
          onSearchChange={() => {}}
          onOpenEvent={setEvent}
          onCloseEvent={() => setEvent(undefined)}
          permissions={parsePermissions([])}
          permissionsUpdatedAt={1}
        />
      );
    }
    renderPage(<Page />, { queryClient });
    if (source === 'details') {
      await userEvent.click(
        await screen.findByRole('button', { name: 'offline-events.review-event-label' }),
      );
      await userEvent.click(
        within(await screen.findByRole('dialog')).getByRole('button', {
          name: 'offline-events.remove',
        }),
      );
    } else
      await userEvent.click(
        await screen.findByRole('button', { name: 'offline-events.remove-event-label' }),
      );
    const confirm = await screen.findByRole('alertdialog');
    await userEvent.click(within(confirm).getByRole('button', { name: 'offline-events.remove' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(() =>
      expect(document.activeElement).toHaveTextContent('offline-events.no-events-title'),
    );
    expect(await getLocalDb().table('stockEventQueue').count()).toBe(0);
    expect(announceDeviceSave).toHaveBeenCalledWith(
      status === 'accepted' ? 'offline-events.synced-removed' : 'offline-events.removed',
    );
    if (status === 'accepted') {
      const receipt = await getLocalDb().table('stockEventReceipts').toCollection().first();
      expect(receipt.hiddenAt).toBeDefined();
      expect(receipt.event).toBeUndefined();
    }
  },
);

it('explains why a refusal already copied for correction cannot be copied again', async () => {
  const { uncertain } = await open(false, 'refused', 'adjustment', false);
  if (!uncertain.error) throw new Error('Missing refusal');
  renderPage(
    <DeviceEventRecovery
      event={{ ...uncertain, error: { ...uncertain.error, resolvedAt: Date.now() } }}
      canView={false}
      canSend={false}
      onClose={vi.fn()}
    />,
    { queryClient: new QueryClient() },
  );
  const copy = await screen.findByRole('button', { name: 'offline-events.copy' });
  expect(copy).toHaveAttribute('aria-disabled', 'true');
  expect(copy).toHaveAccessibleDescription('offline-events.copy-resolved');
  await userEvent.click(copy);
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});
