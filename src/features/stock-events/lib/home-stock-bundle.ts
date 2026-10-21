import { AxiosError, type AxiosRequestConfig } from 'axios';
import { SessionEndedError } from '@/features/auth/lib/session';
import { useLoginData } from '@/features/auth/store/login-data';
import { fetchTradeItemsByIds, fetchValidReasons } from '@/features/reference-data/api/api';
import type {
  LotSummary,
  Orderable,
  TradeItem,
  ValidReasonAssignment,
} from '@/features/reference-data/lib/types';
import {
  type HomeStockSummary,
  readEventStockCards,
} from '@/features/stock-events/api/stock-card-reader';
import { retryDownloadRead } from '@/features/stock-events/lib/download-read';
import { LOCAL_TABLES } from '@/integrations/local-db';
import { LocalDataUnavailableError, onlineOrDevice } from '@/lib/local-data';
import { requireOwnedRecord } from '@/lib/local-records';
import { isOnline } from '@/lib/online';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export type HomeStockScope = {
  facilityId: string;
  programId: string;
  facilityTypeId: string;
  scanning: boolean;
};
type HomeStockCard = {
  id: string;
  stockOnHand: number | null;
  active: boolean;
  occurredDate: string | null;
  orderable: Orderable;
  lot: LotSummary | null;
};
export type HomeStockBundle = HomeStockScope & {
  userId: string;
  generation: string;
  fetchedAt: number;
  formatVersion: 4 | 5;
  stale?: boolean;
  cards: HomeStockCard[];
  summaries?: HomeStockSummary[];
  products?: Orderable[];
  reasons: ValidReasonAssignment[];
  tradeItems: TradeItem[];
  identities: { id: string; versionNumber: number }[];
};
export async function readHomeStockBundle(
  filter: Pick<HomeStockScope, 'facilityId' | 'programId' | 'facilityTypeId'>,
) {
  return requireOwnedRecord<HomeStockBundle>(
    LOCAL_TABLES.homeStockDownloads,
    [filter.facilityId, filter.programId],
    {
      formats: [4, 5],
      accept: (bundle) =>
        bundle.facilityId === filter.facilityId &&
        bundle.programId === filter.programId &&
        bundle.facilityTypeId === filter.facilityTypeId,
    },
  );
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
    children: product.children?.map(({ orderable, quantity }) => ({
      orderable: { id: orderable.id },
      quantity,
    })),
    programs: product.programs?.map(
      ({ programId, orderableDisplayCategoryId, orderableCategoryDisplayName }) => ({
        programId,
        orderableDisplayCategoryId,
        orderableCategoryDisplayName,
      }),
    ),
    meta: product.meta ? { versionNumber: product.meta.versionNumber } : undefined,
  };
}

async function fetchBundle(
  filter: HomeStockScope,
  config: AxiosRequestConfig & { signal?: AbortSignal },
): Promise<HomeStockBundle> {
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
  const [{ cards, identities, summaries, products }, reasons] = await Promise.all([
    readEventStockCards(filter, config, read),
    read(() =>
      fetchValidReasons({ program: filter.programId, facilityType: filter.facilityTypeId }, config),
    ),
  ]);
  check();
  const productIds = new Set(products.map((product) => product.id));
  if (summaries.some((summary) => !summary.orderable?.id || !productIds.has(summary.orderable.id)))
    throw new Error('Stock summary product not found');
  const hydrated: HomeStockCard[] = cards.map((card) => ({
    ...card,
    orderable: snapshotProduct(card.orderable),
    lot: card.lot
      ? {
          id: card.lot.id,
          lotCode: card.lot.lotCode,
          expirationDate: card.lot.expirationDate,
          tradeItemId: card.lot.tradeItemId,
        }
      : null,
  }));
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
    formatVersion: 5,
    cards: hydrated,
    summaries: summaries.map((summary) => ({
      orderable: { id: summary.orderable.id },
      stockOnHand: summary.stockOnHand,
      canFulfillForMe: summary.canFulfillForMe.map((card) => ({
        stockCard: { id: card.stockCard.id },
        orderable: { id: card.orderable.id },
        lot: card.lot ? { id: card.lot.id } : null,
        stockOnHand: card.stockOnHand,
        active: card.active,
        occurredDate: card.occurredDate,
      })),
    })),
    products: products.map(snapshotProduct),
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

const inFlight = new Map<string, Promise<HomeStockBundle>>();
const downloads = new Map<string, Promise<HomeStockBundle>>();
const requestKeyFor = (filter: HomeStockScope) =>
  JSON.stringify([
    getSessionScope(),
    useLoginData.getState().accessToken,
    filter.facilityId,
    filter.programId,
    filter.facilityTypeId,
    filter.scanning,
  ]);

export function fetchHomeStockBundle(filter: HomeStockScope, signal?: AbortSignal) {
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

function fetchForegroundBundle(filter: HomeStockScope) {
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

export function getHomeStockBundle(filter: HomeStockScope) {
  return onlineOrDevice(
    () => fetchForegroundBundle(filter),
    () => readHomeStockBundle(filter),
  );
}
