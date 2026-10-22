import Dexie from 'dexie';
import { QueueNotSentError } from '@/features/stock-events/lib/queue-transport';
import {
  archiveStockEventCopy,
  readStockEventDraft,
  type StockEventContext,
  type StockEventDraft,
} from '@/features/stock-events/lib/stock-event-local';
import type { QueuedStockEvent } from '@/features/stock-events/lib/stock-event-queue';
import { LOCAL_TABLES } from '@/integrations/local-db';
import { assertSessionScope } from '@/lib/session-scope';

type UploadResponse = { status: number; data: unknown };
export type StockEventSyncError = {
  localEventId: string;
  facilityId: string;
  programId: string;
  event: QueuedStockEvent;
  category: 'refused' | 'stock-changed' | 'uncertain';
  httpStatus?: number;
  messageKey?: string;
  message: string;
  response?: unknown;
  failedAt: number;
  resolvedAt?: number;
  dismissedAt?: number;
  history?: (Pick<
    StockEventSyncError,
    'category' | 'httpStatus' | 'messageKey' | 'message' | 'failedAt' | 'resolvedAt'
  > &
    Pick<QueuedStockEvent, 'attemptId' | 'attemptStartedAt'>)[];
};
export type StockEventReceipt = {
  draftId: string;
  revision: number;
  localEventId: string;
  acceptedAt: number;
  source: 'server' | 'user';
  serverEventId?: string;
  documentNumber?: string;
  confirmedBy?: string;
  event?: QueuedStockEvent;
  userId?: string;
  hiddenAt?: number;
};
export type DeviceEvent = Omit<QueuedStockEvent, 'status'> & {
  status: QueuedStockEvent['status'] | 'refused' | 'accepted';
  error?: StockEventSyncError;
  receipt?: StockEventReceipt;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function serviceError(data: unknown) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined;
  const body = data as Record<string, unknown>;
  return typeof body.messageKey === 'string' || typeof body.error === 'string' ? body : undefined;
}
export function classifyUpload(
  response: UploadResponse,
):
  | { kind: 'accepted'; serverEventId: string; documentNumber?: string }
  | { kind: 'session' }
  | { kind: 'refused'; category: 'refused' | 'stock-changed'; message: string; messageKey?: string }
  | { kind: 'uncertain' } {
  const { status, data } = response;
  if (status === 201) {
    const id =
      typeof data === 'string'
        ? data
        : data && typeof data === 'object'
          ? (data as { id?: unknown }).id
          : undefined;
    if (typeof id === 'string' && uuid.test(id)) {
      const documentNumber =
        data &&
        typeof data === 'object' &&
        'documentNumber' in data &&
        typeof data.documentNumber === 'string'
          ? data.documentNumber
          : undefined;
      return { kind: 'accepted', serverEventId: id, documentNumber };
    }
  }
  const error = serviceError(data);
  if (status === 401 && error) return { kind: 'session' };
  if ([400, 403, 404].includes(status) && error && typeof error.messageKey === 'string') {
    const messageKey = error.messageKey;
    const message = typeof error.message === 'string' ? error.message : messageKey;
    return {
      kind: 'refused',
      category:
        status === 400 &&
        /debit.?quantity.*(exceed|soh)|ERROR_EVENT_DEBIT_QUANTITY_EXCEED_SOH/i.test(messageKey)
          ? 'stock-changed'
          : 'refused',
      message,
      messageKey,
    };
  }
  return { kind: 'uncertain' };
}
function tables(db: Dexie) {
  return [
    db.table(LOCAL_TABLES.stockEventDrafts),
    db.table(LOCAL_TABLES.stockEventQueue),
    db.table(LOCAL_TABLES.stockEventSyncErrors),
    db.table(LOCAL_TABLES.stockEventReceipts),
  ];
}
async function matching(
  db: Dexie,
  expected: QueuedStockEvent,
  status: QueuedStockEvent['status'],
  check: () => void,
) {
  check();
  const row = await db.table<QueuedStockEvent>(LOCAL_TABLES.stockEventQueue).get(expected.sequence);
  check();
  const draft = await db
    .table<StockEventDraft>(LOCAL_TABLES.stockEventDrafts)
    .get(expected.draftId);
  check();
  if (
    !row ||
    !draft ||
    row.status !== status ||
    draft.state !== (status === 'sending' ? 'queued' : status) ||
    row.localEventId !== expected.localEventId ||
    row.userId !== expected.userId ||
    draft.userId !== expected.userId ||
    row.revision !== expected.revision ||
    draft.revision !== expected.revision ||
    row.draftId !== expected.draftId ||
    draft.localEventId !== expected.localEventId ||
    row.facilityId !== expected.facilityId ||
    row.programId !== expected.programId ||
    draft.facilityId !== expected.facilityId ||
    draft.programId !== expected.programId ||
    row.attemptId !== expected.attemptId
  )
    return undefined;
  return { row, draft };
}
function history(
  draft: StockEventDraft,
  event: QueuedStockEvent,
  outcome: string,
  choice?: 'recorded' | 'resend' | 'retry',
) {
  return [
    ...(draft.history ?? []),
    {
      attemptId: event.attemptId,
      attemptStartedAt: event.attemptStartedAt,
      outcome,
      choice,
      userId: event.userId,
      at: Date.now(),
    },
  ];
}
export async function acceptStockEvent(
  db: Dexie,
  event: QueuedStockEvent,
  receipt: Pick<StockEventReceipt, 'source' | 'serverEventId' | 'documentNumber'>,
  check: () => void,
) {
  return db.transaction('rw', tables(db), async () => {
    const matched = await matching(
      db,
      event,
      receipt.source === 'user' ? 'uncertain' : 'sending',
      check,
    );
    if (!matched) return false;
    const acceptedAt = Date.now();
    await db.table<StockEventReceipt>(LOCAL_TABLES.stockEventReceipts).put({
      draftId: event.draftId,
      revision: event.revision,
      localEventId: event.localEventId,
      acceptedAt,
      ...receipt,
      confirmedBy: receipt.source === 'user' ? event.userId : undefined,
      event,
    });
    check();
    await db.table<StockEventDraft>(LOCAL_TABLES.stockEventDrafts).put({
      ...matched.draft,
      state: 'accepted',
      acceptedRevision: event.revision,
      updatedAt: acceptedAt,
      history: history(
        matched.draft,
        event,
        'accepted',
        receipt.source === 'user' ? 'recorded' : undefined,
      ),
    });
    check();
    await db
      .table(LOCAL_TABLES.stockEventSyncErrors)
      .update(event.localEventId, { resolvedAt: acceptedAt });
    check();
    await db.table(LOCAL_TABLES.stockEventQueue).delete(event.sequence);
    check();
    return true;
  });
}
async function failEvent(
  db: Dexie,
  event: QueuedStockEvent,
  failure: Omit<
    StockEventSyncError,
    'event' | 'localEventId' | 'facilityId' | 'programId' | 'failedAt'
  >,
  check: () => void,
) {
  return db.transaction('rw', tables(db), async () => {
    const matched = await matching(db, event, 'sending', check);
    if (!matched) return false;
    const previous = await db
      .table<StockEventSyncError>(LOCAL_TABLES.stockEventSyncErrors)
      .get(event.localEventId);
    check();
    let errorHistory = previous?.history ?? [];
    if (previous) {
      errorHistory = [
        ...errorHistory,
        {
          attemptId: previous.event.attemptId,
          attemptStartedAt: previous.event.attemptStartedAt,
          category: previous.category,
          httpStatus: previous.httpStatus,
          messageKey: previous.messageKey,
          message: previous.message,
          failedAt: previous.failedAt,
          resolvedAt: previous.resolvedAt,
        },
      ];
    }
    await db.table<StockEventSyncError>(LOCAL_TABLES.stockEventSyncErrors).put({
      ...failure,
      history: errorHistory,
      event,
      localEventId: event.localEventId,
      facilityId: event.facilityId,
      programId: event.programId,
      failedAt: Date.now(),
    });
    check();
    const uncertain = failure.category === 'uncertain';
    await db.table<StockEventDraft>(LOCAL_TABLES.stockEventDrafts).put({
      ...matched.draft,
      state: uncertain ? 'uncertain' : 'refused',
      updatedAt: Date.now(),
      history: history(matched.draft, event, failure.category),
    });
    check();
    if (uncertain)
      await db
        .table(LOCAL_TABLES.stockEventQueue)
        .put({ ...matched.row, status: 'uncertain', lastFailure: failure.message });
    else await db.table(LOCAL_TABLES.stockEventQueue).delete(event.sequence);
    check();
    return true;
  });
}
export async function recoverSending(db: Dexie, userId: string, check: () => void) {
  const rows = await db
    .table<QueuedStockEvent>(LOCAL_TABLES.stockEventQueue)
    .where('status')
    .equals('sending')
    .toArray();
  check();
  for (const event of rows)
    if (event.userId === userId)
      await failEvent(
        db,
        event,
        {
          category: 'uncertain',
          message: 'The upload was interrupted before its result was saved.',
        },
        check,
      );
}
async function beginAttempt(db: Dexie, event: QueuedStockEvent, check: () => void) {
  return db.transaction('rw', tables(db), async () => {
    const matched = await matching(db, event, 'queued', check);
    if (!matched) return undefined;
    const sending: QueuedStockEvent = {
      ...matched.row,
      status: 'sending',
      attemptId: crypto.randomUUID(),
      attemptStartedAt: Date.now(),
    };
    await db.table(LOCAL_TABLES.stockEventQueue).put(sending);
    check();
    await db.table(LOCAL_TABLES.stockEventDrafts).put({ ...matched.draft, state: 'queued' });
    check();
    return sending;
  });
}
async function returnQueued(
  db: Dexie,
  event: QueuedStockEvent,
  check: () => void,
  notSent = false,
) {
  await db.transaction('rw', tables(db), async () => {
    const matched = await matching(db, event, 'sending', check);
    if (!matched) return;
    await db.table(LOCAL_TABLES.stockEventQueue).put({
      ...matched.row,
      status: 'queued',
      attemptId: undefined,
      attemptStartedAt: undefined,
    });
    check();
    await db.table(LOCAL_TABLES.stockEventDrafts).put({
      ...matched.draft,
      state: 'queued',
      history: history(matched.draft, event, notSent ? 'not-sent' : 'not-committed'),
    });
    check();
  });
}
export type SyncDependencies = {
  check: () => void;
  canSend: () => boolean;
  permitted: (event: QueuedStockEvent) => boolean;
  send: (event: QueuedStockEvent) => Promise<UploadResponse>;
  retryReceipt: () => Promise<void>;
  accepted: (event: QueuedStockEvent) => void;
};
async function writeForOwner<T>(
  db: Dexie,
  userId: string,
  event: QueuedStockEvent,
  write: (owned: Dexie, check: () => void) => Promise<T>,
) {
  const check = () => {
    if (event.userId !== userId || !db.name.endsWith(`:${userId}`))
      throw new Error('Wrong device event owner');
  };
  check();
  const owned = db.isOpen() ? db : new Dexie(db.name);
  try {
    if (owned !== db) await owned.open();
    return await write(owned, check);
  } finally {
    if (owned !== db) owned.close();
  }
}
export function blockedScopes(rows: readonly QueuedStockEvent[]): Set<string> {
  return new Set(
    rows
      .filter((row) => row.status !== 'queued' || row.pauseReason)
      .map((row) => `${row.facilityId}:${row.programId}`),
  );
}
export async function syncStockEvents(db: Dexie, userId: string, deps: SyncDependencies) {
  while (deps.canSend()) {
    deps.check();
    const rows = await db
      .table<QueuedStockEvent>(LOCAL_TABLES.stockEventQueue)
      .orderBy('sequence')
      .toArray();
    deps.check();
    const scopeKey = (row: QueuedStockEvent) => `${row.facilityId}:${row.programId}`;
    for (const row of rows) {
      if (row.userId !== userId || row.status !== 'queued') continue;
      if (row.pauseReason === 'draft-changed') {
        const matched = await db.transaction('r', tables(db), () =>
          matching(db, row, 'queued', deps.check),
        );
        if (!matched) continue;
      }
      const pauseReason = deps.permitted(row) ? undefined : 'access-changed';
      if (row.pauseReason !== pauseReason) {
        await db.table(LOCAL_TABLES.stockEventQueue).update(row.sequence, { pauseReason });
        deps.check();
        row.pauseReason = pauseReason;
      }
    }
    const blocked = blockedScopes(rows);
    const next = rows.find(
      (row) => row.userId === userId && row.status === 'queued' && !blocked.has(scopeKey(row)),
    );
    if (!next) return;
    const event = await beginAttempt(db, next, deps.check);
    if (!event) {
      await db
        .table(LOCAL_TABLES.stockEventQueue)
        .update(next.sequence, { pauseReason: 'draft-changed' });
      deps.check();
      continue;
    }
    let response: UploadResponse | undefined;
    let error: unknown;
    let dispatched = false;
    try {
      deps.check();
      if (!deps.canSend()) throw new QueueNotSentError();
      dispatched = true;
      response = await deps.send(event);
    } catch (caught) {
      error = caught;
    }
    if (!dispatched || error instanceof QueueNotSentError) {
      await writeForOwner(db, userId, event, (owned, check) =>
        returnQueued(owned, event, check, true),
      );
      return;
    }
    const outcome = response ? classifyUpload(response) : { kind: 'uncertain' as const };
    if (outcome.kind === 'accepted') {
      let immediateRetry = true;
      for (;;) {
        let accepted: boolean;
        try {
          accepted = await writeForOwner(db, userId, event, (owned, check) =>
            acceptStockEvent(
              owned,
              event,
              {
                source: 'server',
                serverEventId: outcome.serverEventId,
                documentNumber: outcome.documentNumber,
              },
              check,
            ),
          );
        } catch {
          if (immediateRetry) {
            immediateRetry = false;
            continue;
          }
          deps.check();
          await deps.retryReceipt();
          deps.check();
          continue;
        }
        deps.check();
        if (accepted) deps.accepted(event);
        break;
      }
    } else {
      if (outcome.kind === 'session') {
        await writeForOwner(db, userId, event, (owned, check) => returnQueued(owned, event, check));
        return;
      }
      deps.check();
      await failEvent(
        db,
        event,
        {
          category: outcome.kind === 'refused' ? outcome.category : 'uncertain',
          message:
            outcome.kind === 'refused'
              ? outcome.message
              : error instanceof Error
                ? error.message
                : 'The server result could not be confirmed.',
          messageKey: outcome.kind === 'refused' ? outcome.messageKey : undefined,
          httpStatus: response?.status,
          response: response?.data,
        },
        deps.check,
      );
    }
  }
}
function ownerCheck(context: StockEventContext, userId: string) {
  return () => {
    assertSessionScope(context.sessionScope);
    if (userId !== context.userId) throw new Error('Wrong device event owner');
  };
}

export async function resolveUncertain(
  context: StockEventContext,
  event: QueuedStockEvent,
  choice: 'recorded' | 'resend',
) {
  const check = ownerCheck(context, event.userId);
  check();
  if (choice === 'recorded') return acceptStockEvent(context.db, event, { source: 'user' }, check);
  return context.db.transaction('rw', tables(context.db), async () => {
    const matched = await matching(context.db, event, 'uncertain', check);
    if (!matched) return false;
    await context.db.table(LOCAL_TABLES.stockEventDrafts).put({
      ...matched.draft,
      state: 'queued',
      history: history(matched.draft, event, 'uncertain', 'resend'),
    });
    check();
    await context.db.table(LOCAL_TABLES.stockEventQueue).put({ ...matched.row, status: 'queued' });
    check();
    await context.db
      .table(LOCAL_TABLES.stockEventSyncErrors)
      .update(event.localEventId, { resolvedAt: Date.now() });
    check();
    return true;
  });
}
export async function removeQueuedEvent(context: StockEventContext, event: QueuedStockEvent) {
  const check = ownerCheck(context, event.userId);
  return context.db.transaction('rw', tables(context.db), async () => {
    check();
    const row = await context.db
      .table<QueuedStockEvent>(LOCAL_TABLES.stockEventQueue)
      .get(event.sequence);
    check();
    if (
      row?.status !== 'queued' ||
      row.attemptId ||
      row.userId !== context.userId ||
      row.localEventId !== event.localEventId ||
      row.draftId !== event.draftId ||
      row.revision !== event.revision ||
      row.facilityId !== event.facilityId ||
      row.programId !== event.programId
    )
      return false;
    const draft = await context.db
      .table<StockEventDraft>(LOCAL_TABLES.stockEventDrafts)
      .get(row.draftId);
    check();
    await context.db.table(LOCAL_TABLES.stockEventQueue).delete(row.sequence);
    check();
    if (
      draft?.userId === context.userId &&
      draft.localEventId === row.localEventId &&
      draft.revision === row.revision &&
      draft.state === 'queued' &&
      draft.facilityId === row.facilityId &&
      draft.programId === row.programId
    ) {
      await context.db.table(LOCAL_TABLES.stockEventDrafts).delete(row.draftId);
      check();
    }
    return true;
  });
}
export async function retryRefusedEvent(context: StockEventContext, error: StockEventSyncError) {
  const check = ownerCheck(context, error.event.userId);
  check();
  if (error.category === 'uncertain') return false;
  return context.db.transaction('rw', tables(context.db), async () => {
    check();
    const stored = await context.db
      .table<StockEventSyncError>(LOCAL_TABLES.stockEventSyncErrors)
      .get(error.localEventId);
    check();
    if (
      !stored ||
      stored.category === 'uncertain' ||
      stored.resolvedAt ||
      stored.dismissedAt ||
      stored.localEventId !== error.event.localEventId ||
      stored.event.localEventId !== error.event.localEventId ||
      stored.event.userId !== context.userId ||
      stored.event.kind !== context.kind ||
      stored.event.facilityId !== context.facilityId ||
      stored.event.programId !== context.programId ||
      stored.event.draftId !== error.event.draftId ||
      stored.event.revision !== error.event.revision ||
      stored.event.attemptId !== error.event.attemptId
    )
      return false;
    const event = stored.event;
    const draft = await context.db
      .table<StockEventDraft>(LOCAL_TABLES.stockEventDrafts)
      .get(event.draftId);
    check();
    if (
      draft?.state !== 'refused' ||
      draft.userId !== context.userId ||
      draft.kind !== event.kind ||
      draft.localEventId !== event.localEventId ||
      draft.revision !== event.revision ||
      draft.facilityId !== event.facilityId ||
      draft.programId !== event.programId
    )
      return false;
    const existing = await context.db
      .table<QueuedStockEvent>(LOCAL_TABLES.stockEventQueue)
      .where('localEventId')
      .equals(event.localEventId)
      .first();
    check();
    if (existing) return false;
    await context.db.table(LOCAL_TABLES.stockEventQueue).add({
      ...event,
      status: 'queued',
      pauseReason: undefined,
      lastFailure: undefined,
    });
    check();
    const now = Date.now();
    await context.db.table(LOCAL_TABLES.stockEventDrafts).put({
      ...draft,
      state: 'queued',
      updatedAt: now,
      history: history(draft, event, stored.category, 'retry'),
    });
    check();
    await context.db.table(LOCAL_TABLES.stockEventSyncErrors).update(error.localEventId, {
      resolvedAt: now,
      dismissedAt: now,
    });
    check();
    return true;
  });
}
export async function copyRefusedEvent(context: StockEventContext, error: StockEventSyncError) {
  const check = ownerCheck(context, error.event.userId);
  return context.db.transaction('rw', tables(context.db), async () => {
    check();
    const stored = await context.db
      .table<StockEventSyncError>(LOCAL_TABLES.stockEventSyncErrors)
      .get(error.localEventId);
    check();
    const original = await context.db
      .table<StockEventDraft>(LOCAL_TABLES.stockEventDrafts)
      .get(error.event.draftId);
    check();
    if (
      !stored ||
      stored.resolvedAt ||
      stored.event.attemptId !== error.event.attemptId ||
      stored.event.revision !== error.event.revision ||
      !original ||
      original.state !== 'refused' ||
      original.revision !== error.event.revision ||
      original.userId !== context.userId
    )
      return undefined;
    const active = await readStockEventDraft(context);
    if (active) {
      await context.db
        .table(LOCAL_TABLES.stockEventDrafts)
        .put({ ...active, state: 'archived', updatedAt: Date.now() });
      check();
    }
    const copy = await archiveStockEventCopy(context, original.lines, original.downloadGeneration);
    check();
    const editing: StockEventDraft = { ...copy, state: 'editing' };
    await context.db.table(LOCAL_TABLES.stockEventDrafts).put(editing);
    check();
    await context.db
      .table(LOCAL_TABLES.stockEventSyncErrors)
      .update(error.localEventId, { resolvedAt: Date.now() });
    check();
    return editing;
  });
}
export async function dismissRefusedEvent(context: StockEventContext, error: StockEventSyncError) {
  const check = ownerCheck(context, error.event.userId);
  return context.db.transaction('rw', tables(context.db), async () => {
    check();
    const stored = await context.db
      .table<StockEventSyncError>(LOCAL_TABLES.stockEventSyncErrors)
      .get(error.localEventId);
    check();
    if (
      !stored ||
      stored.category === 'uncertain' ||
      stored.dismissedAt ||
      stored.event.userId !== context.userId ||
      stored.event.draftId !== error.event.draftId ||
      stored.event.revision !== error.event.revision ||
      stored.event.attemptId !== error.event.attemptId
    )
      return false;
    await context.db.table(LOCAL_TABLES.stockEventSyncErrors).update(error.localEventId, {
      dismissedAt: Date.now(),
      resolvedAt: stored.resolvedAt ?? Date.now(),
    });
    check();
    return true;
  });
}
export async function hideAcceptedEvent(context: StockEventContext, event: DeviceEvent) {
  const check = ownerCheck(context, event.userId);
  return context.db.transaction('rw', tables(context.db), async () => {
    check();
    const table = context.db.table<StockEventReceipt>(LOCAL_TABLES.stockEventReceipts);
    const receipt = await table.get([event.draftId, event.revision]);
    check();
    if (
      !receipt ||
      receipt.hiddenAt ||
      receipt.localEventId !== event.localEventId ||
      receipt.event?.userId !== context.userId ||
      receipt.event.facilityId !== context.facilityId ||
      receipt.event.programId !== context.programId
    )
      return false;
    await table.put({
      draftId: receipt.draftId,
      revision: receipt.revision,
      localEventId: receipt.localEventId,
      acceptedAt: receipt.acceptedAt,
      source: receipt.source,
      serverEventId: receipt.serverEventId,
      documentNumber: receipt.documentNumber,
      confirmedBy: receipt.confirmedBy,
      userId: context.userId,
      hiddenAt: Date.now(),
    });
    check();
    const draft = await context.db
      .table<StockEventDraft>(LOCAL_TABLES.stockEventDrafts)
      .get(event.draftId);
    check();
    if (
      draft?.state === 'accepted' &&
      draft.userId === context.userId &&
      draft.localEventId === event.localEventId &&
      draft.revision === event.revision
    )
      await context.db.table(LOCAL_TABLES.stockEventDrafts).delete(event.draftId);
    check();
    return true;
  });
}

export async function pruneStockEvents(db: Dexie, check: () => void) {
  const cutoff = Date.now() - 30 * 86400000;
  await db.transaction('rw', tables(db), async () => {
    check();
    await db
      .table<StockEventReceipt>(LOCAL_TABLES.stockEventReceipts)
      .filter((row) => row.acceptedAt < cutoff)
      .delete();
    check();
    await db
      .table<StockEventDraft>(LOCAL_TABLES.stockEventDrafts)
      .filter((row) => row.state === 'accepted' && row.updatedAt < cutoff)
      .delete();
    check();
  });
}
