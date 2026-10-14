import { AxiosError, type AxiosRequestConfig, isAxiosError } from 'axios';
import { SessionEndedError } from '@/features/auth/lib/session';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  fetchAllOrderableVersions,
  fetchLotsByIds,
  fetchOrderablesByIds,
  fetchTradeItemsByIds,
  fetchValidReasons,
} from '@/features/reference-data/api/api';
import type {
  LotSummary,
  Orderable,
  TradeItem,
  ValidReasonAssignment,
} from '@/features/reference-data/lib/types';
import { client } from '@/integrations/axios';
import { getLocalDb } from '@/integrations/local-db';
import { isAccessFallbackError } from '@/lib/http';
import { LocalDataUnavailableError } from '@/lib/local-data';
import { isOnline } from '@/lib/online';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import type { Page } from '@/lib/types';

export const DOWNLOAD_STALE_MS = 30 * 60 * 1000;
export const downloadIsStale = (
  value: { fetchedAt: number; stale?: boolean } | undefined,
  now = Date.now(),
) => !value || value.stale || now - value.fetchedAt >= DOWNLOAD_STALE_MS;
export type AdjustmentScope = {
  facilityId: string;
  programId: string;
  facilityTypeId: string;
  scanning: boolean;
};
export type AdjustmentCard = {
  id: string;
  stockOnHand: number | null;
  orderable: Orderable;
  lot: LotSummary | null;
};
export type AdjustmentBundle = AdjustmentScope & {
  userId: string;
  generation: string;
  fetchedAt: number;
  formatVersion: 1;
  stale?: boolean;
  cards: AdjustmentCard[];
  reasons: ValidReasonAssignment[];
  tradeItems: TradeItem[];
  identities: { id: string; versionNumber: number }[];
};
type Identity = { id: string; versionNumber?: number; meta?: { versionNumber?: number } };
type Summary = {
  orderable?: Identity;
  canFulfillForMe: {
    stockCard: { id: string };
    orderable: Identity;
    lot: { id: string } | null;
    stockOnHand: number | null;
  }[];
};
const version = (identity: Identity) => identity.versionNumber ?? identity.meta?.versionNumber;
const key = (id: string, number: number) => `${id}|${number}`;

export async function readAdjustmentBundle(
  filter: Pick<AdjustmentScope, 'facilityId' | 'programId'>,
) {
  const scope = getSessionScope();
  const userId = useLoginData.getState().referenceDataUserId;
  const bundle = await getLocalDb()
    .table<AdjustmentBundle>('adjustmentDownloads')
    .get([filter.facilityId, filter.programId]);
  assertSessionScope(scope);
  if (
    !bundle ||
    bundle.userId !== userId ||
    bundle.formatVersion !== 1 ||
    bundle.facilityId !== filter.facilityId ||
    bundle.programId !== filter.programId
  )
    throw new LocalDataUnavailableError();
  return bundle;
}

export async function retryDownloadRead<T>(read: () => Promise<T>, check: () => void): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    check();
    try {
      const result = await read();
      check();
      return result;
    } catch (error) {
      check();
      if (attempt >= 1 || !isAxiosError(error) || error.code !== AxiosError.ECONNABORTED)
        throw error;
    }
  }
}

function snapshotProduct(product: Orderable): Orderable {
  return {
    id: product.id,
    productCode: product.productCode,
    fullProductName: product.fullProductName,
    description: null,
    netContent: product.netContent,
    dispensable: product.dispensable ? { displayUnit: product.dispensable.displayUnit } : undefined,
    identifiers: product.identifiers?.tradeItem
      ? { tradeItem: product.identifiers.tradeItem }
      : undefined,
    extraData: product.extraData ? { useVVM: product.extraData.useVVM } : undefined,
    meta: product.meta ? { versionNumber: product.meta.versionNumber } : undefined,
  };
}

async function fetchBundle(
  filter: AdjustmentScope,
  config: AxiosRequestConfig & { signal?: AbortSignal },
): Promise<AdjustmentBundle> {
  const sessionScope = config.sessionScope ?? getSessionScope();
  const userId = useLoginData.getState().referenceDataUserId;
  if (!userId) throw new LocalDataUnavailableError();
  const check = () => {
    assertSessionScope(sessionScope);
    config.signal?.throwIfAborted();
    if (config.backgroundRead && (!isOnline() || useLoginData.getState().expired))
      throw new AxiosError('Download stopped.', AxiosError.ERR_CANCELED);
  };
  const read = <T>(task: () => Promise<T>) => retryDownloadRead(task, check);
  const summaries: Summary[] = [];
  for (let page = 0; ; page += 1) {
    const { data } = await read(() =>
      client.get<Page<Summary>>('/v2/stockCardSummaries', {
        ...config,
        params: {
          facilityId: filter.facilityId,
          programId: filter.programId,
          nonEmptyOnly: true,
          page,
          size: 100,
        },
      }),
    );
    summaries.push(...data.content);
    if (page + 1 >= data.totalPages) break;
    if (!Number.isInteger(data.totalPages)) throw new Error('Incomplete stock pages');
  }
  const cards = new Map<string, Summary['canFulfillForMe'][number] & { versionNumber?: number }>();
  for (const summary of summaries)
    for (const card of summary.canFulfillForMe) {
      const number =
        version(card.orderable) ??
        (summary.orderable?.id === card.orderable.id ? version(summary.orderable) : undefined);
      const previous = cards.get(card.stockCard.id);
      if (previous && previous.versionNumber !== number)
        throw new Error('Conflicting stock card product versions');
      cards.set(card.stockCard.id, { ...card, versionNumber: number });
    }
  const entries = [...cards.values()];
  const requested = [
    ...entries.map((card) => ({ id: card.orderable.id, versionNumber: card.versionNumber })),
    ...summaries.flatMap((summary) =>
      summary.orderable
        ? [{ id: summary.orderable.id, versionNumber: version(summary.orderable) }]
        : [],
    ),
  ];
  const identities = [
    ...new Map(
      requested.flatMap((card) =>
        card.versionNumber === undefined
          ? []
          : [
              [
                key(card.id, card.versionNumber),
                { id: card.id, versionNumber: card.versionNumber },
              ] as const,
            ],
      ),
    ).values(),
  ];
  const [versioned, unversioned, lots, reasons] = await Promise.all([
    read(() => fetchAllOrderableVersions(identities, config)),
    read(() =>
      fetchOrderablesByIds(
        entries.filter((card) => card.versionNumber === undefined).map((card) => card.orderable.id),
        config,
      ),
    ),
    read(() =>
      fetchLotsByIds(
        entries.flatMap((card) => (card.lot ? [card.lot.id] : [])),
        config,
      ),
    ),
    read(() =>
      fetchValidReasons({ program: filter.programId, facilityType: filter.facilityTypeId }, config),
    ),
  ]);
  check();
  const byVersion = new Map(
    versioned.map((product) => [key(product.id, product.meta?.versionNumber ?? -1), product]),
  );
  for (const identity of identities)
    if (!byVersion.has(key(identity.id, identity.versionNumber)))
      throw new Error('Stock card product version not found');
  const byId = new Map(unversioned.map((product) => [product.id, product]));
  const byLot = new Map(lots.map((lot) => [lot.id, lot]));
  const hydrated = entries.map((card): AdjustmentCard => {
    const product =
      card.versionNumber === undefined
        ? byId.get(card.orderable.id)
        : byVersion.get(key(card.orderable.id, card.versionNumber));
    const lot = card.lot ? byLot.get(card.lot.id) : null;
    if (!product || (card.lot && !lot)) throw new Error('Stock card product or lot not found');
    return {
      id: card.stockCard.id,
      stockOnHand: card.stockOnHand,
      orderable: snapshotProduct(product),
      lot: lot
        ? {
            id: lot.id,
            lotCode: lot.lotCode,
            expirationDate: lot.expirationDate,
            tradeItemId: lot.tradeItemId,
          }
        : null,
    };
  });
  const tradeIds = [
    ...new Set(
      hydrated.flatMap((card) =>
        card.orderable.identifiers?.tradeItem ? [card.orderable.identifiers.tradeItem] : [],
      ),
    ),
  ];
  const tradeItems = filter.scanning
    ? await read(() => fetchTradeItemsByIds(tradeIds, config))
    : [];
  check();
  return {
    ...filter,
    userId,
    generation: crypto.randomUUID(),
    fetchedAt: Date.now(),
    formatVersion: 1,
    cards: hydrated,
    identities,
    reasons: reasons.map(({ id, program, facilityType, hidden, reason }) => ({
      id,
      program: program ? { id: program.id } : undefined,
      facilityType: facilityType ? { id: facilityType.id } : undefined,
      hidden,
      reason: {
        id: reason.id,
        name: reason.name,
        reasonType: reason.reasonType,
        reasonCategory: reason.reasonCategory,
        isFreeTextAllowed: reason.isFreeTextAllowed,
        tags: [...reason.tags],
      },
    })),
    tradeItems: tradeItems
      .filter((item) => tradeIds.includes(item.id))
      .map(({ id, gtin }) => ({ id, gtin })),
  };
}

const inFlight = new Map<string, Promise<AdjustmentBundle>>();
const downloads = new Map<string, Promise<AdjustmentBundle>>();
const requestKeyFor = (filter: AdjustmentScope) =>
  JSON.stringify([
    getSessionScope(),
    useLoginData.getState().accessToken,
    filter.facilityId,
    filter.programId,
    filter.facilityTypeId,
    filter.scanning,
  ]);

export function fetchAdjustmentBundle(filter: AdjustmentScope, signal?: AbortSignal) {
  const requestKey = requestKeyFor(filter);
  const pending = fetchBundle(filter, {
    session: false,
    backgroundRead: true,
    signal,
    sessionScope: getSessionScope(),
  }).finally(() => {
    if (downloads.get(requestKey) === pending) downloads.delete(requestKey);
  });
  downloads.set(requestKey, pending);
  return pending;
}

function fetchForegroundBundle(filter: AdjustmentScope) {
  const requestKey = requestKeyFor(filter);
  const existing = inFlight.get(requestKey);
  if (existing) return existing;
  const scope = getSessionScope();
  const fetch = () => fetchBundle({ ...filter, scanning: false }, { sessionScope: scope });
  const download = downloads.get(requestKey);
  const pending = (
    download
      ? download.catch((error: unknown) => {
          assertSessionScope(scope);
          if (error instanceof SessionEndedError) throw error;
          return fetch();
        })
      : fetch()
  ).finally(() => {
    if (inFlight.get(requestKey) === pending) inFlight.delete(requestKey);
  });
  inFlight.set(requestKey, pending);
  return pending;
}

export async function getAdjustmentBundle(filter: AdjustmentScope) {
  if (!isOnline()) return readAdjustmentBundle(filter);
  const scope = getSessionScope();
  try {
    return await fetchForegroundBundle(filter);
  } catch (error) {
    assertSessionScope(scope);
    if (!isAccessFallbackError(error)) throw error;
    return readAdjustmentBundle(filter);
  }
}
