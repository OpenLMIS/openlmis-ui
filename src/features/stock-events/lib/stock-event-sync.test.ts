import { AxiosError } from 'axios';
import { beforeEach, expect, it, vi } from 'vitest';
import { useLoginData } from '@/features/auth/store/login-data';
import { newEventLine } from '@/features/stock-events/lib/event-form';
import { QueueNotSentError } from '@/features/stock-events/lib/queue-transport';
import {
  createStockEventContext,
  readStockEventDraft,
  saveStockEventDraft,
} from '@/features/stock-events/lib/stock-event-local';
import {
  enqueueStockEvent,
  type QueuedStockEvent,
} from '@/features/stock-events/lib/stock-event-queue';
import {
  acceptStockEvent,
  classifyUpload,
  copyRefusedEvent,
  dismissRefusedEvent,
  hideAcceptedEvent,
  pruneStockEvents,
  recoverSending,
  removeQueuedEvent,
  resolveUncertain,
  retryRefusedEvent,
  syncStockEvents,
} from '@/features/stock-events/lib/stock-event-sync';
import { getLocalDb, LOCAL_TABLES } from '@/integrations/local-db';

const owner = { referenceDataUserId: 'sync-user', username: 'Ada', accessToken: 'token' };
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
async function enqueue(programId = 'one', occurredDate = '2026-10-14') {
  const context = createStockEventContext({ kind: 'adjustment', facilityId: 'home', programId });
  const draft = await saveStockEventDraft(context, undefined, [{ ...line, occurredDate }]);
  if (!draft) throw new Error('Missing draft');
  return enqueueStockEvent(
    context,
    draft,
    {
      facilityId: 'home',
      programId,
      signature: 'Ada',
      lineItems: [{ orderableId: 'p', quantity: 12, occurredDate, reasonId: 'r' }],
    },
    {
      facility: { id: 'home', code: 'H', name: 'Home' },
      program: { id: programId, code: programId, name: programId },
    },
  );
}
const id = '11111111-1111-4111-8111-111111111111';
const response = (status: number, data: unknown) => ({ status, data });
beforeEach(async () => {
  useLoginData.getState().setLoginData(owner);
  for (const table of [
    LOCAL_TABLES.stockEventDrafts,
    LOCAL_TABLES.stockEventQueue,
    LOCAL_TABLES.stockEventReceipts,
    LOCAL_TABLES.stockEventSyncErrors,
  ])
    await getLocalDb().table(table).clear();
});
function dependencies(send = vi.fn(async (_event: QueuedStockEvent) => response(201, id))) {
  return {
    check: vi.fn(),
    canSend: () => true,
    permitted: () => true,
    send,
    retryReceipt: async () => {},
    accepted: vi.fn(),
  };
}
it('retains the legacy lost payload after interruption and never automatically resends it', async () => {
  const event = await enqueue();
  const db = getLocalDb();
  await db.table(LOCAL_TABLES.stockEventQueue).update(event.sequence, {
    status: 'sending',
    attemptId: 'interrupted',
    attemptStartedAt: Date.now(),
  });
  await recoverSending(db, event.userId, () => {});
  const retained = await db.table(LOCAL_TABLES.stockEventQueue).get(event.sequence);
  expect(retained.status).toBe('uncertain');
  expect(retained.postBody).toBe(event.postBody);
  const deps = dependencies();
  await syncStockEvents(db, event.userId, deps);
  expect(deps.send).not.toHaveBeenCalled();
  expect((await db.table(LOCAL_TABLES.stockEventDrafts).get(event.draftId)).state).toBe(
    'uncertain',
  );
});
it('orders all scopes and blocks only the uncertain facility/program', async () => {
  const first = await enqueue();
  const blocked = await enqueue();
  const other = await enqueue('two');
  const send = vi
    .fn()
    .mockResolvedValueOnce(response(504, '<html>gateway</html>'))
    .mockResolvedValueOnce(response(201, id));
  await syncStockEvents(getLocalDb(), first.userId, dependencies(send));
  expect(send.mock.calls.map(([event]) => event.sequence)).toEqual([
    first.sequence,
    other.sequence,
  ]);
  expect(
    (await getLocalDb().table(LOCAL_TABLES.stockEventQueue).get(blocked.sequence)).status,
  ).toBe('queued');
  expect(await getLocalDb().table(LOCAL_TABLES.stockEventReceipts).count()).toBe(1);
});

it('retains a post-dispatch network failure as uncertain and never resends on a second sync', async () => {
  const event = await enqueue();
  const db = getLocalDb();
  const send = vi.fn(async () => {
    throw new AxiosError('Connection lost after dispatch', AxiosError.ERR_NETWORK, undefined, {});
  });
  const deps = dependencies(send);
  await syncStockEvents(db, event.userId, deps);
  expect(await db.table(LOCAL_TABLES.stockEventQueue).get(event.sequence)).toMatchObject({
    status: 'uncertain',
    postBody: event.postBody,
    attemptId: expect.any(String),
    attemptStartedAt: expect.any(Number),
  });
  expect(await db.table(LOCAL_TABLES.stockEventDrafts).get(event.draftId)).toMatchObject({
    state: 'uncertain',
  });
  expect(await db.table(LOCAL_TABLES.stockEventSyncErrors).get(event.localEventId)).toMatchObject({
    category: 'uncertain',
  });
  await syncStockEvents(db, event.userId, deps);
  expect(send).toHaveBeenCalledOnce();
  expect(await db.table(LOCAL_TABLES.stockEventReceipts).count()).toBe(0);
});
it('after 201 retries only the receipt transaction, never POST, before reporting acceptance', async () => {
  const event = await enqueue();
  const db = getLocalDb();
  vi.spyOn(db.table(LOCAL_TABLES.stockEventReceipts), 'put')
    .mockRejectedValueOnce(new Error('quota'))
    .mockRejectedValueOnce(new Error('quota'));
  const deps = dependencies();
  const retry = vi.fn(async () => {
    expect(deps.send).toHaveBeenCalledTimes(1);
    expect(deps.accepted).not.toHaveBeenCalled();
    expect((await db.table(LOCAL_TABLES.stockEventQueue).get(event.sequence)).status).toBe(
      'sending',
    );
  });
  await syncStockEvents(db, event.userId, { ...deps, retryReceipt: retry });
  expect(retry).toHaveBeenCalledTimes(1);
  expect(deps.send).toHaveBeenCalledTimes(1);
  expect(deps.accepted).toHaveBeenCalledTimes(1);
  expect(await db.table(LOCAL_TABLES.stockEventQueue).count()).toBe(0);
});
it('retains a whole backdated stock-changed refusal and continues', async () => {
  const occurredDate = '2026-09-01';
  const event = await enqueue('one', occurredDate);
  await enqueue();
  const send = vi
    .fn()
    .mockResolvedValueOnce(
      response(400, {
        messageKey: 'stockmanagement.error.event.debitQuantityExceedSoh',
        message: 'Negative stock',
        details: { occurredDate },
      }),
    )
    .mockResolvedValueOnce(response(201, id));
  await syncStockEvents(getLocalDb(), event.userId, dependencies(send));
  const error = await getLocalDb().table(LOCAL_TABLES.stockEventSyncErrors).get(event.localEventId);
  expect(error.category).toBe('stock-changed');
  expect(error.response.details).toEqual({ occurredDate });
  expect(error.event.payload.lineItems[0].occurredDate).toBe(occurredDate);
  expect((await getLocalDb().table(LOCAL_TABLES.stockEventDrafts).get(event.draftId)).state).toBe(
    'refused',
  );
  expect(send).toHaveBeenCalledTimes(2);
});
it('marks recorded without a POST, releases the barrier, and ignores repeated/stale choices', async () => {
  const event = await enqueue();
  const later = await enqueue();
  await getLocalDb()
    .table(LOCAL_TABLES.stockEventQueue)
    .update(event.sequence, { status: 'sending', attemptId: 'a' });
  await recoverSending(getLocalDb(), event.userId, () => {});
  const uncertain = await getLocalDb().table(LOCAL_TABLES.stockEventQueue).get(event.sequence);
  const context = createStockEventContext(event);
  expect(await resolveUncertain(context, { ...uncertain, revision: 999 }, 'recorded')).toBe(false);
  expect(await resolveUncertain(context, uncertain, 'recorded')).toBe(true);
  expect(await resolveUncertain(context, uncertain, 'resend')).toBe(false);
  const receipt = await getLocalDb()
    .table(LOCAL_TABLES.stockEventReceipts)
    .get([event.draftId, event.revision]);
  expect(receipt.source).toBe('user');
  expect(receipt.serverEventId).toBeUndefined();
  expect(receipt.confirmedBy).toBe(event.userId);
  const deps = dependencies();
  await syncStockEvents(getLocalDb(), event.userId, deps);
  expect(deps.send.mock.calls.map(([sent]) => sent.localEventId)).toEqual([later.localEventId]);
  expect(await getLocalDb().table(LOCAL_TABLES.stockEventQueue).count()).toBe(0);
  expect(await getLocalDb().table(LOCAL_TABLES.stockEventReceipts).count()).toBe(2);
});
it('an explicit resend preserves body, sequence and attempted history and permits one attempt', async () => {
  const event = await enqueue();
  await getLocalDb()
    .table(LOCAL_TABLES.stockEventQueue)
    .update(event.sequence, { status: 'sending', attemptId: 'a', attemptStartedAt: 10 });
  await recoverSending(getLocalDb(), event.userId, () => {});
  const uncertain = await getLocalDb().table(LOCAL_TABLES.stockEventQueue).get(event.sequence);
  const context = createStockEventContext(event);
  expect(await resolveUncertain(context, uncertain, 'resend')).toBe(true);
  expect(await resolveUncertain(context, uncertain, 'resend')).toBe(false);
  const queued = await getLocalDb().table(LOCAL_TABLES.stockEventQueue).get(event.sequence);
  expect(queued.postBody).toBe(event.postBody);
  expect(queued.sequence).toBe(event.sequence);
  const draft = await getLocalDb().table(LOCAL_TABLES.stockEventDrafts).get(event.draftId);
  expect(draft.history).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ choice: 'resend', attemptId: 'a', userId: event.userId }),
    ]),
  );
  expect(
    (await getLocalDb().table(LOCAL_TABLES.stockEventSyncErrors).get(event.localEventId))
      .resolvedAt,
  ).toBeDefined();
  const deps = dependencies();
  await syncStockEvents(getLocalDb(), event.userId, deps);
  expect(deps.send).toHaveBeenCalledTimes(1);
});
it('only eligible unsent queued events can be removed', async () => {
  const event = await enqueue();
  const context = createStockEventContext(event);
  await getLocalDb()
    .table(LOCAL_TABLES.stockEventQueue)
    .update(event.sequence, { status: 'sending' });
  expect(await removeQueuedEvent(context, event)).toBe(false);
  await getLocalDb()
    .table(LOCAL_TABLES.stockEventQueue)
    .update(event.sequence, { status: 'queued', attemptId: 'previous-attempt' });
  expect(await removeQueuedEvent(context, event)).toBe(false);
  await getLocalDb()
    .table(LOCAL_TABLES.stockEventQueue)
    .update(event.sequence, { attemptId: undefined });
  expect(await removeQueuedEvent(context, event)).toBe(true);
  expect(await removeQueuedEvent(context, event)).toBe(false);
});
it('refused correction preserves the original and archives existing edits transactionally', async () => {
  const event = await enqueue();
  await syncStockEvents(
    getLocalDb(),
    event.userId,
    dependencies(
      vi.fn(async () => response(404, { messageKey: 'missing', message: 'Missing product' })),
    ),
  );
  const error = await getLocalDb().table(LOCAL_TABLES.stockEventSyncErrors).get(event.localEventId);
  const context = createStockEventContext(event);
  const existing = await saveStockEventDraft(context, undefined, [line]);
  const copied = await copyRefusedEvent(context, error);
  expect(copied?.draftId).not.toBe(event.draftId);
  expect(copied?.localEventId).not.toBe(event.localEventId);
  expect(
    (
      await getLocalDb()
        .table(LOCAL_TABLES.stockEventDrafts)
        .get(existing?.draftId ?? '')
    ).state,
  ).toBe('archived');
  expect((await getLocalDb().table(LOCAL_TABLES.stockEventDrafts).get(event.draftId)).state).toBe(
    'refused',
  );
  expect(
    await getLocalDb().table(LOCAL_TABLES.stockEventSyncErrors).get(event.localEventId),
  ).toBeDefined();
});
it('prunes receipts and accepted drafts after 30 days while keeping refused, archived and errors', async () => {
  const event = await enqueue();
  await getLocalDb()
    .table(LOCAL_TABLES.stockEventQueue)
    .update(event.sequence, { status: 'sending', attemptId: 'a' });
  const sending = await getLocalDb().table(LOCAL_TABLES.stockEventQueue).get(event.sequence);
  await acceptStockEvent(getLocalDb(), sending, { source: 'server', serverEventId: id }, () => {});
  const old = Date.now() - 31 * 86400000;
  await getLocalDb()
    .table(LOCAL_TABLES.stockEventReceipts)
    .update([event.draftId, event.revision], { acceptedAt: old });
  await getLocalDb().table(LOCAL_TABLES.stockEventDrafts).update(event.draftId, { updatedAt: old });
  for (const state of ['refused', 'archived'])
    await getLocalDb()
      .table(LOCAL_TABLES.stockEventDrafts)
      .put({
        ...(await getLocalDb().table(LOCAL_TABLES.stockEventDrafts).get(event.draftId)),
        draftId: state,
        state,
      });
  await getLocalDb()
    .table(LOCAL_TABLES.stockEventSyncErrors)
    .put({ localEventId: 'error', failedAt: old });
  await pruneStockEvents(getLocalDb(), () => {});
  expect(await getLocalDb().table(LOCAL_TABLES.stockEventReceipts).count()).toBe(0);
  expect(
    (await getLocalDb().table(LOCAL_TABLES.stockEventDrafts).toArray())
      .map((row) => row.state)
      .sort(),
  ).toEqual(['archived', 'refused']);
  expect(await getLocalDb().table(LOCAL_TABLES.stockEventSyncErrors).count()).toBe(1);
});
it('typed not-sent and service 401 return to queued without a worker retry loop', async () => {
  const event = await enqueue();
  const send = vi
    .fn()
    .mockRejectedValueOnce(new QueueNotSentError())
    .mockResolvedValueOnce(response(401, { error: 'invalid_token' }))
    .mockResolvedValueOnce(response(201, id));
  const deps = dependencies(send);
  await syncStockEvents(getLocalDb(), event.userId, deps);
  expect(
    (await getLocalDb().table(LOCAL_TABLES.stockEventQueue).get(event.sequence)).attemptId,
  ).toBeUndefined();
  expect((await getLocalDb().table(LOCAL_TABLES.stockEventQueue).get(event.sequence)).status).toBe(
    'queued',
  );
  await syncStockEvents(getLocalDb(), event.userId, deps);
  expect(send).toHaveBeenCalledTimes(2);
  expect(
    (await getLocalDb().table(LOCAL_TABLES.stockEventQueue).get(event.sequence)).postBody,
  ).toBe(event.postBody);
  await syncStockEvents(getLocalDb(), event.userId, deps);
  expect(send).toHaveBeenCalledTimes(3);
});
it('records a verified 201 in the original owner database after a scope change', async () => {
  const event = await enqueue();
  const db = getLocalDb();
  const { getSessionScope, assertSessionScope } = await import('@/lib/session-scope');
  const scope = getSessionScope();
  const deps = dependencies();
  const check = () => assertSessionScope(scope);
  deps.send.mockImplementationOnce(async () => {
    useLoginData
      .getState()
      .setLoginData({ referenceDataUserId: 'other', username: 'Other', accessToken: 'other' });
    return response(201, id);
  });
  await expect(syncStockEvents(db, event.userId, { ...deps, check })).rejects.toThrow();
  useLoginData.getState().setLoginData(owner);
  const reopened = getLocalDb();
  await recoverSending(reopened, event.userId, () => {});
  expect(await reopened.table(LOCAL_TABLES.stockEventQueue).get(event.sequence)).toBeUndefined();
  expect(await reopened.table(LOCAL_TABLES.stockEventReceipts).count()).toBe(1);
  expect(deps.accepted).not.toHaveBeenCalled();
  const next = dependencies();
  await syncStockEvents(reopened, 'other', next);
  expect(next.send).not.toHaveBeenCalled();
});
for (const [status, data, kind] of [
  [201, id, 'accepted'],
  [201, {}, 'uncertain'],
  [201, '<html>ok</html>', 'uncertain'],
  [404, { messageKey: 'missing' }, 'refused'],
  [403, { messageKey: 'forbidden', message: 'Access denied' }, 'refused'],
  [401, { messageKey: 'expired' }, 'session'],
  [401, { error: 'invalid_token' }, 'session'],
  [401, '<html>proxy</html>', 'uncertain'],
  [400, {}, 'uncertain'],
  [502, { messageKey: 'gateway' }, 'uncertain'],
  [504, '<html>timeout</html>', 'uncertain'],
] as const)
  it(`classifies ${status} ${JSON.stringify(data)} as ${kind}`, () => {
    expect(classifyUpload(response(status, data)).kind).toBe(kind);
  });
it('retains attempt details without duplicating the frozen event after resend', async () => {
  const event = await enqueue();
  const db = getLocalDb();
  await syncStockEvents(
    db,
    event.userId,
    dependencies(vi.fn(async () => response(504, 'first response'))),
  );
  const firstError = await db.table(LOCAL_TABLES.stockEventSyncErrors).get(event.localEventId);
  const uncertain = await db.table(LOCAL_TABLES.stockEventQueue).get(event.sequence);
  await resolveUncertain(createStockEventContext(event), uncertain, 'resend');
  await syncStockEvents(
    db,
    event.userId,
    dependencies(
      vi.fn(async () => response(400, { messageKey: 'changed', message: 'Second refusal' })),
    ),
  );
  const current = await db.table(LOCAL_TABLES.stockEventSyncErrors).get(event.localEventId);
  expect(current.message).toBe('Second refusal');
  expect(current.history[0]).not.toHaveProperty('event');
  expect(current.history[0]).not.toHaveProperty('response');
  expect(current.history).toEqual([
    expect.objectContaining({
      category: 'uncertain',
      message: firstError.message,
      attemptId: uncertain.attemptId,
      failedAt: expect.any(Number),
      httpStatus: 504,
      resolvedAt: expect.any(Number),
    }),
  ]);
});
it('keeps not-sent queued even if the session scope changes before transport rejects', async () => {
  const event = await enqueue();
  const db = getLocalDb();
  let current = true;
  const deps = dependencies(
    vi.fn(async () => {
      current = false;
      throw new QueueNotSentError();
    }),
  );
  await syncStockEvents(db, event.userId, {
    ...deps,
    check: () => {
      if (!current) throw new Error('Scope changed');
    },
  });
  expect(await db.table(LOCAL_TABLES.stockEventQueue).get(event.sequence)).toMatchObject({
    status: 'queued',
    attemptId: undefined,
  });
  expect(await db.table(LOCAL_TABLES.stockEventSyncErrors).count()).toBe(0);
});
it('pauses missing access without creating a server refusal and resumes when rights return', async () => {
  const event = await enqueue();
  const db = getLocalDb();
  const deps = dependencies();
  await syncStockEvents(db, event.userId, { ...deps, permitted: () => false });
  expect(deps.send).not.toHaveBeenCalled();
  expect(await db.table(LOCAL_TABLES.stockEventQueue).get(event.sequence)).toMatchObject({
    status: 'queued',
    pauseReason: 'access-changed',
  });
  expect(await db.table(LOCAL_TABLES.stockEventSyncErrors).count()).toBe(0);
  await syncStockEvents(db, event.userId, deps);
  expect(await db.table(LOCAL_TABLES.stockEventReceipts).count()).toBe(1);
  expect(deps.send).toHaveBeenCalledOnce();
});
it('blocks a mismatched draft scope without spinning and still sends other programs', async () => {
  const event = await enqueue();
  const later = await enqueue();
  const other = await enqueue('two');
  const db = getLocalDb();
  await db.table(LOCAL_TABLES.stockEventDrafts).update(event.draftId, { revision: 999 });
  const deps = dependencies();
  await syncStockEvents(db, event.userId, deps);
  expect(await db.table(LOCAL_TABLES.stockEventQueue).get(event.sequence)).toMatchObject({
    status: 'queued',
    pauseReason: 'draft-changed',
  });
  expect(await db.table(LOCAL_TABLES.stockEventQueue).get(later.sequence)).toMatchObject({
    status: 'queued',
  });
  expect(deps.send.mock.calls.map(([row]) => row.sequence)).toEqual([other.sequence]);
});

it('rechecks a draft pause and sends the scope once the frozen revision matches again', async () => {
  const event = await enqueue();
  const db = getLocalDb();
  await db.table(LOCAL_TABLES.stockEventDrafts).update(event.draftId, { revision: 999 });
  const deps = dependencies();
  await syncStockEvents(db, event.userId, deps);
  expect(deps.send).not.toHaveBeenCalled();
  await db.table(LOCAL_TABLES.stockEventDrafts).update(event.draftId, { revision: event.revision });
  await syncStockEvents(db, event.userId, deps);
  expect(deps.send).toHaveBeenCalledOnce();
  expect(deps.send.mock.calls[0][0].pauseReason).toBeUndefined();
  expect(await db.table(LOCAL_TABLES.stockEventQueue).count()).toBe(0);
});
it('removes a paused unsent queue row while preserving the changed draft and releasing its scope', async () => {
  const event = await enqueue();
  const later = await enqueue();
  const db = getLocalDb();
  await db.table(LOCAL_TABLES.stockEventDrafts).update(event.draftId, { revision: 999 });
  const deps = dependencies();
  await syncStockEvents(db, event.userId, deps);
  expect(await removeQueuedEvent(createStockEventContext(event), event)).toBe(true);
  expect((await db.table(LOCAL_TABLES.stockEventDrafts).get(event.draftId)).revision).toBe(999);
  await syncStockEvents(db, event.userId, deps);
  expect(deps.send.mock.calls.map(([row]) => row.sequence)).toEqual([later.sequence]);
});
it('clears restored access on a row still held behind an earlier uncertain event', async () => {
  const first = await enqueue();
  const later = await enqueue();
  const db = getLocalDb();
  await syncStockEvents(db, first.userId, {
    ...dependencies(),
    permitted: () => false,
  });
  await db
    .table(LOCAL_TABLES.stockEventQueue)
    .update(later.sequence, { pauseReason: 'access-changed' });
  await db
    .table(LOCAL_TABLES.stockEventQueue)
    .update(first.sequence, { status: 'sending', attemptId: 'a' });
  await recoverSending(db, first.userId, () => {});
  const deps = dependencies();
  await syncStockEvents(db, first.userId, deps);
  expect(
    (await db.table(LOCAL_TABLES.stockEventQueue).get(later.sequence)).pauseReason,
  ).toBeUndefined();
  expect(deps.send).not.toHaveBeenCalled();
});

it('returns a committed sending row to its owner queue when the pre-dispatch check throws', async () => {
  const event = await enqueue();
  const db = getLocalDb();
  const transaction = db.transaction.bind(db);
  let ended = false;
  vi.spyOn(db, 'transaction').mockImplementation(
    (...args: Parameters<typeof transaction>) =>
      transaction(...args).then((result: unknown) => {
        if ((result as QueuedStockEvent | undefined)?.status === 'sending') ended = true;
        return result;
      }) as ReturnType<typeof transaction>,
  );
  const deps = dependencies();
  await syncStockEvents(db, event.userId, {
    ...deps,
    check: () => {
      if (ended) throw new Error('Session ended before dispatch');
    },
  });
  expect(deps.send).not.toHaveBeenCalled();
  expect(await db.table(LOCAL_TABLES.stockEventQueue).get(event.sequence)).toMatchObject({
    status: 'queued',
    attemptId: undefined,
    attemptStartedAt: undefined,
  });
  expect(await db.table(LOCAL_TABLES.stockEventSyncErrors).count()).toBe(0);
});
it('allows removal after a service 401 proves the event was not committed', async () => {
  const event = await enqueue();
  const db = getLocalDb();
  await syncStockEvents(
    db,
    event.userId,
    dependencies(vi.fn(async () => response(401, { error: 'invalid_token' }))),
  );
  const queued = await db.table(LOCAL_TABLES.stockEventQueue).get(event.sequence);
  expect(queued.attemptId).toBeUndefined();
  expect(await removeQueuedEvent(createStockEventContext(event), queued)).toBe(true);
});

it.each([false, true])(
  'dismisses a refusal without deleting its original (copied: %s)',
  async (copied) => {
    const event = await enqueue();
    const db = getLocalDb();
    await syncStockEvents(
      db,
      event.userId,
      dependencies(
        vi.fn(async () => response(400, { messageKey: 'bad', message: 'Invalid event' })),
      ),
    );
    const error = await db.table(LOCAL_TABLES.stockEventSyncErrors).get(event.localEventId);
    const context = createStockEventContext(event);
    const correction = copied ? await copyRefusedEvent(context, error) : undefined;
    expect(
      await dismissRefusedEvent(context, { ...error, event: { ...error.event, revision: 999 } }),
    ).toBe(false);
    expect(await dismissRefusedEvent(context, error)).toBe(true);
    expect(await dismissRefusedEvent(context, error)).toBe(false);
    expect(await db.table(LOCAL_TABLES.stockEventSyncErrors).get(event.localEventId)).toMatchObject(
      {
        dismissedAt: expect.any(Number),
        resolvedAt: expect.any(Number),
      },
    );
    expect((await db.table(LOCAL_TABLES.stockEventDrafts).get(event.draftId)).state).toBe(
      'refused',
    );
    if (copied) {
      expect(correction).toBeDefined();
      expect(await readStockEventDraft(context)).toEqual(correction);
    }
  },
);

it('hides accepted work without its payload, retains the receipt and removes its accepted draft only once', async () => {
  const event = await enqueue();
  const db = getLocalDb();
  await syncStockEvents(db, event.userId, dependencies());
  const receipt = await db
    .table(LOCAL_TABLES.stockEventReceipts)
    .get([event.draftId, event.revision]);
  const draft = await db.table(LOCAL_TABLES.stockEventDrafts).get(event.draftId);
  const accepted = { ...event, status: 'accepted' as const, receipt };
  const context = createStockEventContext(event);
  expect(await hideAcceptedEvent(context, accepted)).toBe(true);
  const retained = await db
    .table(LOCAL_TABLES.stockEventReceipts)
    .get([event.draftId, event.revision]);
  expect(retained).toMatchObject({
    localEventId: event.localEventId,
    serverEventId: id,
    source: 'server',
    userId: event.userId,
    hiddenAt: expect.any(Number),
  });
  expect(retained).not.toHaveProperty('event');
  expect(await db.table(LOCAL_TABLES.stockEventDrafts).get(event.draftId)).toBeUndefined();
  expect(await hideAcceptedEvent(context, accepted)).toBe(false);
  await expect(
    enqueueStockEvent(context, draft, event.payload, {
      facility: event.facility,
      program: event.program,
    }),
  ).rejects.toThrow();
  expect(await db.table(LOCAL_TABLES.stockEventQueue).count()).toBe(0);
});

async function refuse() {
  const event = await enqueue();
  await syncStockEvents(
    getLocalDb(),
    event.userId,
    dependencies(vi.fn(async () => response(400, { messageKey: 'bad', message: 'First refusal' }))),
  );
  return getLocalDb().table(LOCAL_TABLES.stockEventSyncErrors).get(event.localEventId);
}
it.each(['accepted', 'refused'] as const)(
  'explicit refused Retry sends the frozen body once and finishes %s',
  async (outcome) => {
    const error = await refuse();
    const event = error.event;
    const context = createStockEventContext(event);
    expect(await retryRefusedEvent(context, error)).toBe(true);
    expect(await retryRefusedEvent(context, error)).toBe(false);
    const queued = await getLocalDb().table(LOCAL_TABLES.stockEventQueue).get(event.sequence);
    expect(queued).toMatchObject({
      status: 'queued',
      postBody: event.postBody,
      payload: event.payload,
      localEventId: event.localEventId,
      revision: event.revision,
      attemptId: event.attemptId,
    });
    expect(
      (await getLocalDb().table(LOCAL_TABLES.stockEventDrafts).get(event.draftId)).history,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ choice: 'retry', attemptId: event.attemptId }),
      ]),
    );
    const deps = dependencies(
      vi.fn(async () =>
        outcome === 'accepted'
          ? response(201, id)
          : response(400, { messageKey: 'changed', message: 'Second refusal' }),
      ),
    );
    await syncStockEvents(getLocalDb(), event.userId, deps);
    await syncStockEvents(getLocalDb(), event.userId, deps);
    expect(deps.send).toHaveBeenCalledOnce();
    expect(deps.send.mock.calls[0][0]).toMatchObject({
      postBody: event.postBody,
      payload: event.payload,
    });
    expect(await getLocalDb().table(LOCAL_TABLES.stockEventQueue).count()).toBe(0);
    expect((await getLocalDb().table(LOCAL_TABLES.stockEventDrafts).get(event.draftId)).state).toBe(
      outcome,
    );
    if (outcome === 'accepted') {
      expect(
        await getLocalDb()
          .table(LOCAL_TABLES.stockEventReceipts)
          .get([event.draftId, event.revision]),
      ).toMatchObject({
        source: 'server',
        serverEventId: id,
      });
    } else {
      const next = await getLocalDb()
        .table(LOCAL_TABLES.stockEventSyncErrors)
        .get(event.localEventId);
      expect(next).toMatchObject({ message: 'Second refusal', messageKey: 'changed' });
      expect(next.resolvedAt).toBeUndefined();
      expect(next.dismissedAt).toBeUndefined();
      expect(next.history).toEqual([
        expect.objectContaining({ message: 'First refusal', attemptId: event.attemptId }),
      ]);
      expect(next.event.attemptId).not.toBe(event.attemptId);
      expect(await retryRefusedEvent(context, error)).toBe(false);
    }
  },
);
it('refused Retry rejects stale, foreign, dismissed and uncertain decisions', async () => {
  const error = await refuse();
  const context = createStockEventContext(error.event);
  for (const changed of [
    { event: { ...error.event, attemptId: 'stale' } },
    { event: { ...error.event, revision: 999 } },
    { event: { ...error.event, localEventId: 'other' } },
    { category: 'uncertain' },
  ])
    expect(await retryRefusedEvent(context, { ...error, ...changed })).toBe(false);
  await expect(retryRefusedEvent({ ...context, userId: 'other' }, error)).rejects.toThrow();
  expect(await getLocalDb().table(LOCAL_TABLES.stockEventQueue).count()).toBe(0);
  await dismissRefusedEvent(context, error);
  expect(await retryRefusedEvent(context, error)).toBe(false);
});
it('refused Retry rolls back when the session changes during its transaction', async () => {
  const error = await refuse();
  const context = createStockEventContext(error.event);
  const { getSessionScope } = await import('@/lib/session-scope');
  const table = context.db.table(LOCAL_TABLES.stockEventSyncErrors);
  const get = table.get.bind(table);
  vi.spyOn(table, 'get').mockImplementationOnce(() =>
    get(error.localEventId).then((value) => {
      useLoginData.getState().clearLoginData();
      useLoginData.getState().setLoginData(owner);
      expect(getSessionScope()).not.toBe(context.sessionScope);
      return value;
    }),
  );
  await expect(retryRefusedEvent(context, error)).rejects.toThrow();
  expect(await getLocalDb().table(LOCAL_TABLES.stockEventQueue).count()).toBe(0);
  expect(
    (await getLocalDb().table(LOCAL_TABLES.stockEventDrafts).get(error.event.draftId)).state,
  ).toBe('refused');
});
it('retried refusals obey access, session and facility/program barriers in the existing uploader', async () => {
  const error = await refuse();
  const blocked = await enqueue();
  const other = await enqueue('two');
  await getLocalDb()
    .table(LOCAL_TABLES.stockEventQueue)
    .update(blocked.sequence, { status: 'sending', attemptId: 'unknown' });
  await recoverSending(getLocalDb(), blocked.userId, () => {});
  await retryRefusedEvent(createStockEventContext(error.event), error);
  const deps = dependencies();
  await syncStockEvents(getLocalDb(), error.event.userId, deps);
  expect(deps.send.mock.calls.map(([sent]) => sent.localEventId)).toEqual([other.localEventId]);
  await resolveUncertain(
    createStockEventContext(blocked),
    await getLocalDb().table(LOCAL_TABLES.stockEventQueue).get(blocked.sequence),
    'recorded',
  );
  const paused = { ...dependencies(), permitted: () => false };
  await syncStockEvents(getLocalDb(), error.event.userId, paused);
  expect(paused.send).not.toHaveBeenCalled();
  expect(
    (await getLocalDb().table(LOCAL_TABLES.stockEventQueue).get(error.event.sequence)).pauseReason,
  ).toBe('access-changed');
  const session = { ...dependencies(), canSend: () => false };
  await syncStockEvents(getLocalDb(), error.event.userId, session);
  expect(session.send).not.toHaveBeenCalled();
  await syncStockEvents(getLocalDb(), error.event.userId, deps);
  expect(deps.send).toHaveBeenCalledTimes(2);
});
