import type { OrderableChild, Reason } from '@/features/reference-data/lib/types';
import type { StockEventLineItem } from '@/features/stock-events/lib/types';

import { MAX_WHOLE_NUMBER } from '@/lib/whole-number';

type KitRecord = { id: string; children?: readonly OrderableChild[] };
type KitContents = Pick<KitRecord, 'children'>;
type KitContentLine = KitContents & { quantity: number };
export type KitReasons = { debit: string; credit: string };
export type KitUnpackReasonIds = {
  kitUnpackReasonId?: string;
  unpackedFromKitReasonId?: string;
};
type UnpackReasonsResult =
  | ({ ok: true } & KitReasons)
  | { ok: false; setting: 'KIT_UNPACK_REASON_ID' | 'UNPACKED_FROM_KIT_REASON_ID' };

export function unpackReasons(
  reasons: readonly Reason[] | undefined,
  ids: KitUnpackReasonIds,
): UnpackReasonsResult {
  const valid = (id: string | undefined, type: string) =>
    !!id?.trim() &&
    reasons?.some(
      (reason) =>
        reason.id === id && reason.reasonType === type && reason.reasonCategory === 'AGGREGATION',
    );
  if (!valid(ids.kitUnpackReasonId, 'DEBIT')) {
    return { ok: false, setting: 'KIT_UNPACK_REASON_ID' };
  }
  if (!valid(ids.unpackedFromKitReasonId, 'CREDIT')) {
    return { ok: false, setting: 'UNPACKED_FROM_KIT_REASON_ID' };
  }
  return {
    ok: true,
    debit: ids.kitUnpackReasonId as string,
    credit: ids.unpackedFromKitReasonId as string,
  };
}

export function kitContentsProblem(
  orderable: KitContents,
): 'not-a-kit' | 'invalid-count' | undefined {
  if (!orderable.children?.length) return 'not-a-kit';
  if (
    orderable.children.some(
      ({ quantity }) =>
        quantity === null ||
        !Number.isInteger(quantity) ||
        quantity < 0 ||
        quantity > MAX_WHOLE_NUMBER,
    )
  )
    return 'invalid-count';
  return undefined;
}

export function expandKitLines(
  items: readonly StockEventLineItem[],
  childrenPerItem: readonly (readonly OrderableChild[] | undefined)[],
  reasons: KitReasons,
): StockEventLineItem[] {
  return [
    ...items.map((item) => ({
      ...item,
      reasonId: reasons.debit,
    })),
    ...items.flatMap((item, index) =>
      (childrenPerItem[index] ?? []).map((child) => ({
        orderableId: child.orderable.id,
        lotId: null,
        quantity: item.quantity * (child.quantity as number),
        occurredDate: item.occurredDate,
        reasonId: reasons.credit,
        extraData: {},
      })),
    ),
  ];
}

export function contentTotalsTooLarge(lines: readonly KitContentLine[]): number[] {
  const totals = new Map<string, { quantity: number; indexes: Set<number> }>();
  lines.forEach((line, index) => {
    for (const child of line.children ?? []) {
      const quantity = line.quantity * (child.quantity as number);
      if (!(quantity > 0)) continue;
      const total = totals.get(child.orderable.id) ?? { quantity: 0, indexes: new Set<number>() };
      total.quantity += quantity;
      total.indexes.add(index);
      totals.set(child.orderable.id, total);
    }
  });
  return [
    ...new Set(
      [...totals.values()]
        .filter((total) => total.quantity > MAX_WHOLE_NUMBER)
        .flatMap((total) => [...total.indexes]),
    ),
  ].sort((a, b) => a - b);
}

function contentsMultiset(kit: KitContents): string[] {
  return (kit.children ?? [])
    .map((child) =>
      JSON.stringify([child.orderable.id, child.quantity === null ? null : String(child.quantity)]),
    )
    .sort();
}

export function refreshKitContents<T extends { orderable: KitRecord }>(
  lines: readonly T[],
  freshKits: readonly KitRecord[],
): { lines: T[]; changed: T['orderable'][] } {
  const byId = new Map(freshKits.map((kit) => [kit.id, kit]));
  const changed = new Map<string, T['orderable']>();
  const refreshed = lines.map((line) => {
    const children = byId.get(line.orderable.id)?.children;
    if (
      JSON.stringify(contentsMultiset(line.orderable)) !==
      JSON.stringify(contentsMultiset({ children }))
    ) {
      changed.set(line.orderable.id, line.orderable);
    }
    return { ...line, orderable: { ...line.orderable, children } };
  });
  return { lines: refreshed, changed: [...changed.values()] };
}
