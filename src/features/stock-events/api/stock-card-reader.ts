import type { AxiosRequestConfig } from 'axios';
import {
  fetchAllOrderableVersions,
  fetchLotsByIds,
  fetchOrderablesByIds,
} from '@/features/reference-data/api/api';
import type { EventStockCardsFilter } from '@/features/stock-events/lib/types';
import { client } from '@/integrations/axios';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import type { Page } from '@/lib/types';

type Identity = { id: string; versionNumber?: number; meta?: { versionNumber?: number } };
export type HomeStockSummary = {
  orderable: Identity;
  stockOnHand: number | null;
  canFulfillForMe: {
    stockCard: { id: string };
    orderable: Identity;
    lot: { id: string } | null;
    stockOnHand: number | null;
    active: boolean;
    occurredDate: string | null;
  }[];
};
const version = (identity: Identity) => identity.versionNumber ?? identity.meta?.versionNumber;
const key = (id: string, number: number) => `${id}|${number}`;

export async function readEventStockCards(
  filter: EventStockCardsFilter,
  config: AxiosRequestConfig & { signal?: AbortSignal } = {},
  read: <T>(task: () => Promise<T>) => Promise<T> = (task) => task(),
) {
  const scope = config.sessionScope ?? getSessionScope();
  const check = () => {
    assertSessionScope(scope);
    config.signal?.throwIfAborted();
  };
  const summaries: HomeStockSummary[] = [];
  for (let page = 0; ; page += 1) {
    check();
    const { data } = await read(() =>
      client.get<Page<HomeStockSummary>>('/v2/stockCardSummaries', {
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
    check();
    summaries.push(...data.content);
    if (page + 1 >= data.totalPages) break;
    if (!Number.isInteger(data.totalPages)) throw new Error('Incomplete stock pages');
  }
  const cards = new Map<
    string,
    HomeStockSummary['canFulfillForMe'][number] & { versionNumber?: number }
  >();
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
  const [versioned, unversioned, lots] = await Promise.all([
    read(() => fetchAllOrderableVersions(identities, config)),
    read(() =>
      fetchOrderablesByIds(
        requested
          .filter((product) => product.versionNumber === undefined)
          .map((product) => product.id),
        config,
      ),
    ),
    read(() =>
      fetchLotsByIds(
        entries.flatMap((card) => (card.lot ? [card.lot.id] : [])),
        config,
      ),
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
  const hydrated = entries.map((card) => {
    const product =
      card.versionNumber === undefined
        ? byId.get(card.orderable.id)
        : byVersion.get(key(card.orderable.id, card.versionNumber));
    const lot = card.lot ? byLot.get(card.lot.id) : null;
    if (!product || (card.lot && !lot)) throw new Error('Stock card product or lot not found');
    return {
      id: card.stockCard.id,
      stockOnHand: card.stockOnHand,
      active: card.active,
      occurredDate: card.occurredDate,
      orderable: product,
      lot: lot ?? null,
    };
  });
  return { cards: hydrated, identities, summaries, products: [...versioned, ...unversioned] };
}
