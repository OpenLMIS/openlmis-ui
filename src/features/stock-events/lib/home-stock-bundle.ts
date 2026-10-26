import type { AxiosRequestConfig } from 'axios';
import type { ValidAssignment } from '@/components/valid-assignments/types';
import { SessionEndedError } from '@/features/auth/lib/session';
import { useLoginData } from '@/features/auth/store/login-data';
import {
  fetchTradeItemsByIds,
  fetchValidAssignments,
  fetchValidReasons,
} from '@/features/reference-data/api/api';
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
import { downloadReader } from '@/features/stock-events/lib/download-read';
import { LOCAL_TABLES } from '@/integrations/local-db';
import { LocalDataUnavailableError, onlineOrDevice } from '@/lib/local-data';
import { requireOwnedRecord } from '@/lib/local-records';
import { randomId } from '@/lib/random-id';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export const HOME_STOCK_FORMATS = [4, 5, 6] as const;
export type HomeStockFormat = (typeof HOME_STOCK_FORMATS)[number];

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
  formatVersion: HomeStockFormat;
  destinations?: ValidAssignment[];
  sources?: ValidAssignment[];
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
      formats: HOME_STOCK_FORMATS,
      accept: (bundle) =>
        bundle.facilityId === filter.facilityId &&
        bundle.programId === filter.programId &&
        bundle.facilityTypeId === filter.facilityTypeId,
    },
  );
}

export async function readHomeStockCounterparties(
  filter: Pick<HomeStockScope, 'facilityId' | 'programId' | 'facilityTypeId'>,
  resource: 'validDestinations' | 'validSources',
): Promise<ValidAssignment[]> {
  const bundle = await readHomeStockBundle(filter);
  const assignments = resource === 'validDestinations' ? bundle.destinations : bundle.sources;
  if (!assignments) throw new LocalDataUnavailableError();
  return assignments;
}

function snapshotAssignments(assignments: ValidAssignment[]): ValidAssignment[] {
  return [...new Map(assignments.map((item) => [item.id, item])).values()].map(
    ({ id, programId, facilityTypeId, name, isFreeTextAllowed, geoLevelAffinityId, node }) => ({
      id,
      programId,
      facilityTypeId,
      name,
      isFreeTextAllowed,
      geoLevelAffinityId,
      node: { id: node.id, referenceId: node.referenceId, refDataFacility: node.refDataFacility },
    }),
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
  counterparties: boolean,
): Promise<HomeStockBundle> {
  const userId = useLoginData.getState().referenceDataUserId;
  if (!userId) throw new LocalDataUnavailableError();
  const { check, read } = downloadReader(config);
  const assignments = (resource: 'validDestinations' | 'validSources') =>
    counterparties
      ? read(() =>
          fetchValidAssignments(
            resource,
            { programId: filter.programId, facilityId: filter.facilityId },
            config,
          ),
        )
      : [];
  const [{ cards, identities, summaries, products }, reasons, destinations, sources] =
    await Promise.all([
      readEventStockCards(filter, config, read),
      read(() =>
        fetchValidReasons(
          { program: filter.programId, facilityType: filter.facilityTypeId },
          config,
        ),
      ),
      assignments('validDestinations'),
      assignments('validSources'),
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
    generation: randomId(),
    fetchedAt: Date.now(),
    formatVersion: 6,
    ...(counterparties
      ? { destinations: snapshotAssignments(destinations), sources: snapshotAssignments(sources) }
      : {}),
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
  const pending = fetchBundle(
    filter,
    {
      session: false,
      backgroundRead: true,
      signal,
      sessionScope: getSessionScope(),
    },
    true,
  ).finally(() => {
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
  const fetch = () => fetchBundle({ ...filter, scanning: false }, { sessionScope: scope }, false);
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
