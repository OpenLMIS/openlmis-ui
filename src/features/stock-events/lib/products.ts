import type {
  ApprovedProduct,
  LotSummary,
  OrderableFulfills,
} from '@/features/reference-data/lib/types';
import { stockKey } from '@/features/stock-events/lib/event-reverse';
import type { EventStockCard, EventStockOnHand } from '@/features/stock-events/lib/types';

export type EventProductOption = {
  value: string;
  label: string;
  orderable: EventStockCard['orderable'];
  cards: EventStockCard[];
};

export type EventLotOption = {
  value: string;
  lot: EventStockCard['lot'];
  card: EventStockCard;
} & (
  | { label: string; labelKey?: never }
  | { labelKey: 'stock-events.no-lot-defined'; label?: never }
);

export type ApprovedProductOption = Omit<EventProductOption, 'cards'> & { approvedId: string };

export const ADD_NEW_LOT = 'add-new-lot';

export type ReceiveLotOption =
  | EventLotOption
  | { value: typeof ADD_NEW_LOT; lot: null; labelKey: 'stock-events.add-new-lot'; card?: never };

function productLabel(orderable: EventStockCard['orderable']): string {
  const name = orderable.fullProductName || orderable.productCode;
  const unit = orderable.dispensable?.displayUnit;
  return unit ? `${name} - ${unit}` : name;
}

export function eventProductOptions(cards: readonly EventStockCard[]): EventProductOption[] {
  const products = new Map<string, EventProductOption>();
  for (const card of cards) {
    const { orderable } = card;
    const product = products.get(orderable.id);
    if (product) {
      product.cards.push(card);
    } else {
      products.set(orderable.id, {
        value: orderable.id,
        label: productLabel(orderable),
        orderable,
        cards: [card],
      });
    }
  }
  return [...products.values()];
}

export function approvedProductOptions(
  page: readonly ApprovedProduct[],
  fulfils: OrderableFulfills | undefined,
  fulfillingOrderables: readonly EventStockCard['orderable'][],
  search = '',
): ApprovedProductOption[] {
  const fulfilling = new Map(fulfillingOrderables.map((orderable) => [orderable.id, orderable]));
  const options = new Map<string, ApprovedProductOption>();
  const place = (orderable: EventStockCard['orderable'], approvedId: string) => {
    if (!options.has(orderable.id))
      options.set(orderable.id, {
        value: orderable.id,
        label: productLabel(orderable),
        orderable,
        approvedId,
      });
  };
  const term = search.trim().toLowerCase();
  if (term) {
    for (const orderable of fulfillingOrderables) {
      const approvedId = Object.keys(fulfils ?? {}).find((id) =>
        fulfils?.[id]?.canFulfillForMe?.includes(orderable.id),
      );
      if (approvedId && orderable.fullProductName?.toLowerCase().includes(term))
        place(orderable, approvedId);
    }
  }
  for (const { orderable } of page) {
    for (const id of fulfils?.[orderable.id]?.canFulfillForMe ?? []) {
      const fulfiller = fulfilling.get(id);
      if (fulfiller) place(fulfiller, orderable.id);
    }
    place(orderable, orderable.id);
  }
  return [...options.values()];
}

const byExpiry = (first: LotSummary, second: LotSummary) =>
  first.expirationDate && second.expirationDate
    ? first.expirationDate.localeCompare(second.expirationDate)
    : Number(!first.expirationDate) - Number(!second.expirationDate);

export function receiveLotOptions(
  { orderable }: Pick<ApprovedProductOption, 'orderable'>,
  lots: readonly LotSummary[],
  stock: EventStockOnHand,
  canAddLot: boolean,
): ReceiveLotOption[] {
  const card = (lot: LotSummary | null): EventStockCard => ({
    orderable,
    lot,
    stockOnHand: stock[stockKey(orderable.id, lot?.id)] ?? null,
  });
  return [
    ...(canAddLot && orderable.identifiers?.tradeItem
      ? [{ value: ADD_NEW_LOT, lot: null, labelKey: 'stock-events.add-new-lot' } as const]
      : []),
    { value: '', lot: null, labelKey: 'stock-events.no-lot-defined', card: card(null) },
    ...[...lots]
      .sort(byExpiry)
      .map((lot) => ({ value: lot.id, label: lot.lotCode, lot, card: card(lot) })),
  ];
}

export function eventLotOptions(cards: readonly EventStockCard[]): EventLotOption[] {
  const lots = new Map<string, EventLotOption>();
  const noLot = cards.find((card) => !card.lot);
  for (const card of cards) {
    if (!card.lot || lots.has(card.lot.id)) continue;
    lots.set(card.lot.id, { value: card.lot.id, label: card.lot.lotCode, lot: card.lot, card });
  }
  const sorted = [...lots.values()].sort((a, b) => {
    const first = a.lot?.expirationDate;
    const second = b.lot?.expirationDate;
    return first && second ? first.localeCompare(second) : 0;
  });
  if (noLot) {
    sorted.unshift({
      value: '',
      lot: null,
      card: noLot,
      labelKey: 'stock-events.no-lot-defined',
    });
  }
  return sorted;
}

export type EventCardFilter = (cards: readonly EventStockCard[]) => readonly EventStockCard[];
export const allEventCards: EventCardFilter = (cards) => cards;

export function issuableCards(cards: readonly EventStockCard[], today: string): EventStockCard[] {
  return cards.filter(
    (card) =>
      card.stockOnHand !== 0 && (!card.lot?.expirationDate || card.lot.expirationDate >= today),
  );
}

export function productHasLots(cards: readonly EventStockCard[], orderableId: string): boolean {
  return cards.some((card) => card.orderable.id === orderableId && !!card.lot);
}

export function kitCards(cards: readonly EventStockCard[], _today?: string): EventStockCard[] {
  return cards.filter((card) => !!card.orderable.children?.length && card.stockOnHand !== 0);
}
