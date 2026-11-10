import { expect, it } from 'vitest';
import {
  buildShipmentLines,
  type ShipmentLine,
  shipmentGroups,
  validateShipmentFill,
} from '@/features/orders/lib/shipment-lines';

const product = { id: 'p', netContent: 10, meta: { versionNumber: 2 } };
const orders = [{ orderable: product, orderedQuantity: 2 }];
const card = (lot: string | null, stockOnHand = 20, id = 'p') => ({
  orderable: { id },
  lot: lot ? { id: lot } : null,
  stockOnHand,
  stockCard: { id: `card-${lot}` },
  active: true,
});
const summary = (cards = [card(null)]) => [
  { orderable: { id: 'p' }, stockOnHand: 20, canFulfillForMe: cards },
];
const saved = (lot: string | null, quantityShipped = 1) => ({
  id: `line-${lot}`,
  orderable: { id: 'p', versionNumber: 1 },
  lot: lot ? { id: lot } : null,
  quantityShipped,
});
const build = (cards = [card(null)], lines?: ReturnType<typeof saved>[]) =>
  buildShipmentLines({
    orderLines: orders,
    summaries: summary(cards),
    products: [product],
    savedLines: lines,
  });

it('merges draft values by product and lot, keeps vanished stock and starts new stock at zero', () => {
  const lines = build([card(null), card('new')], [saved(null, 2), saved('gone', 3)]);
  expect(
    lines.map((line) => [
      line.lot?.id ?? null,
      line.fill,
      line.stockOnHand,
      line.id,
      line.product.meta?.versionNumber,
    ]),
  ).toEqual([
    [null, 2, 20, 'line-null', 1],
    ['new', 0, 20, undefined, 2],
    ['gone', 3, 0, 'line-gone', 1],
  ]);
});
it('uses only saved lines for a read-only shipment while retaining current stock', () => {
  const lines = buildShipmentLines({
    orderLines: orders,
    summaries: summary([card(null), card('new')]),
    products: [product],
    savedLines: [saved(null)],
    readOnly: true,
  });
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatchObject({ fill: 1, stockOnHand: 20 });
});
it('renders a self-filling product without a lot as a single row and a missing summary as an empty group', () => {
  expect(shipmentGroups(orders, build())[0]).toMatchObject({ kind: 'single', noStock: false });
  const lines = buildShipmentLines({ orderLines: orders, summaries: [], products: [product] });
  expect(shipmentGroups(orders, lines)[0]).toMatchObject({
    kind: 'product',
    noStock: true,
    children: [],
  });
  expect(shipmentGroups(orders, build([card(null, 0)]))[0].noStock).toBe(false);
});
it('groups filling products by id, retains subgroup lots and leaves single trade-item rows alone', () => {
  const lines = build([card('a', 0, 'other'), card('b', 0, 'other'), card('c', 20, 'third')]);
  const group = shipmentGroups(orders, lines)[0];
  expect(group.kind).toBe('product');
  expect(group.children.map((child) => [child.kind, child.noStock, child.lines.length])).toEqual([
    ['subgroup', true, 2],
    ['single', false, 1],
  ]);
});
it('hides zero-product children except filled rows, including stock below one pack', () => {
  const group = shipmentGroups(orders, build([card('a', 7), card('b', 0)], [saved('b', 1)]))[0];
  expect(group.noStock).toBe(true);
  expect(group.children.flatMap((child) => child.lines).map((line) => line.lot?.id)).toEqual(['b']);
});
it('sorts no-lot first, then VVM descending, missing VVM as stage one, expiry then stock', () => {
  const lines = build([
    card('late'),
    card('early'),
    card('none'),
    card(null),
    card('vvm'),
    card('low'),
  ]);
  const decorated = lines.map(
    (line): ShipmentLine => ({
      ...line,
      vvmStatus: line.lot?.id === 'vvm' ? 'STAGE_2' : null,
      lot: line.lot
        ? {
            ...line.lot,
            expirationDate:
              line.lot.id === 'none' ? null : line.lot.id === 'late' ? '2027-01-01' : '2026-01-01',
          }
        : null,
      stockOnHand: line.lot?.id === 'low' ? 10 : 20,
    }),
  );
  expect(
    shipmentGroups(orders, decorated)[0]
      .children.flatMap((child) => child.lines)
      .map((line) => line.lot?.id ?? null),
  ).toEqual([null, 'vvm', 'none', 'low', 'early', 'late']);
});
it('validates required fill, whole numbers, available packs and missing pack sizes', () => {
  const line = build()[0];
  expect(validateShipmentFill(line, '')).toBe('orders.shipment.fill-required');
  expect(validateShipmentFill(line, 0)).toBeNull();
  expect(validateShipmentFill(line, 3)).toBe('orders.shipment.fill-exceeds-stock');
  expect(validateShipmentFill(line, 1.5)).toBe('orders.shipment.fill-whole-number');
  expect(validateShipmentFill({ ...line, product: { id: 'p', netContent: 0 } }, 1)).toBe(
    'orders.shipment.invalid-pack-size',
  );
});
it('uses the latest product for new cards and the exact saved version for draft lines', () => {
  const lines = buildShipmentLines({
    orderLines: orders,
    summaries: summary([card(null), card('new')]),
    products: [{ ...product, netContent: 20, meta: { versionNumber: 1 } }, product],
    savedLines: [saved(null)],
  });
  expect(
    lines.map((line) => [
      line.lot?.id ?? null,
      line.product.netContent,
      line.product.meta?.versionNumber,
    ]),
  ).toEqual([
    [null, 20, 1],
    ['new', 10, 2],
  ]);
});
it('keeps a shared filling line in each ordered product group without duplicating the API line', () => {
  const other = { ...product, id: 'commodity' };
  const lines = buildShipmentLines({
    orderLines: [...orders, { orderable: other, orderedQuantity: 1 }],
    summaries: [...summary(), { ...summary()[0], orderable: { id: 'commodity' } }],
    products: [product],
  });
  expect(lines).toHaveLength(1);
  expect(
    shipmentGroups([...orders, { orderable: other, orderedQuantity: 1 }], lines).map(
      (group) => group.lines.length,
    ),
  ).toEqual([1, 1]);
});
it('orders stock by whole available packs and keeps partial-pack ties stable', () => {
  const lines = build([card('first', 19), card('second', 11)]);
  expect(shipmentGroups(orders, lines)[0].children[0].lines.map((line) => line.lot?.id)).toEqual([
    'first',
    'second',
  ]);
});
