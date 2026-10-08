import type { EventStockCard } from '@/features/stock-events/lib/types';

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
  | { labelKey: 'stock-events.no-lot-defined' | 'stock-events.product-has-no-lots'; label?: never }
);

export function eventProductOptions(cards: readonly EventStockCard[]): EventProductOption[] {
  const products = new Map<string, EventProductOption>();
  for (const card of cards) {
    const { orderable } = card;
    const product = products.get(orderable.id);
    if (product) {
      product.cards.push(card);
    } else {
      const name = orderable.fullProductName || orderable.productCode;
      const unit = orderable.dispensable?.displayUnit;
      products.set(orderable.id, {
        value: orderable.id,
        label: unit ? `${name} - ${unit}` : name,
        orderable,
        cards: [card],
      });
    }
  }
  return [...products.values()];
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
      labelKey: lots.size ? 'stock-events.no-lot-defined' : 'stock-events.product-has-no-lots',
    });
  }
  return sorted;
}
