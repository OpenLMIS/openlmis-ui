import { expect, it } from 'vitest';
import { column, line, product, record } from '@/features/requisitions/lib/fixtures/builders';
import { buildLines, filterLines, splitLines } from '@/features/requisitions/lib/lines';

it('joins exact versions, uses the last program entry and splits both supply types', () => {
  const products = [
    product({ meta: { versionNumber: 2 }, fullProductName: 'Wrong version' }),
    product({
      programs: [
        { programId: 'program', fullSupply: true, pricePerPack: 1 },
        { programId: 'other', fullSupply: true },
        { programId: 'program', fullSupply: false, pricePerPack: 5 },
      ],
    }),
  ];
  const models = buildLines(record({ requisitionLineItems: [line()] }), products, [
    { id: 'approved', meta: { versionNumber: 1 }, maxPeriodsOfStock: 2 },
  ]);
  expect(models[0]?.product?.fullProductName).toBe('Product');
  expect(models[0]?.program?.pricePerPack).toBe(5);
  expect(models[0]?.approvedProduct?.maxPeriodsOfStock).toBe(2);
  expect(splitLines(models)).toMatchObject({
    fullSupply: [],
    nonFullSupply: [{ fullSupply: false }],
  });
});
it('sorts both supply types by category order/name, product order/name and filters code or name', () => {
  const products = ['Zulu', 'Alpha', 'Beta', 'Gamma'].map((name, i) =>
    product({
      id: String(i),
      fullProductName: name,
      productCode: `CODE${i}`,
      programs: [
        {
          programId: 'program',
          fullSupply: false,
          orderableCategoryDisplayOrder: i === 3 ? 0 : 1,
          orderableCategoryDisplayName: i === 2 ? 'B' : 'A',
          displayOrder: 1,
        },
      ],
    }),
  );
  const models = buildLines(
    record({
      requisitionLineItems: products.map((p) =>
        line({ id: p.id, orderable: { id: p.id, versionNumber: 1 } }),
      ),
    }),
    products,
  );
  expect(models.map((m) => m.product?.fullProductName)).toEqual(['Gamma', 'Alpha', 'Zulu', 'Beta']);
  expect(filterLines(models, { product: 'cOdE2' }).map((m) => m.line.id)).toEqual(['2']);
  expect(filterLines(models, { product: 'alp' }).map((m) => m.line.id)).toEqual(['1']);
});
it('hides skipped only by template option with an explicit show-skipped override', () => {
  const r = record({
    template: {
      columnsMap: {
        skipped: column('skipped', 0, { option: { optionName: 'hideSkippedLineItems' } }),
      },
    },
    requisitionLineItems: [line({ skipped: true })],
  });
  const models = buildLines(r, [product()]);
  expect(filterLines(models, { hideSkipped: true })).toEqual([]);
  expect(filterLines(models, { hideSkipped: true, showSkipped: true })).toHaveLength(1);
});

it('does not silently hydrate a missing pinned version from a newer product or approval', () => {
  const models = buildLines(
    record({ requisitionLineItems: [line()] }),
    [product({ meta: { versionNumber: 2 } })],
    [{ id: 'approved', meta: { versionNumber: 2 }, maxPeriodsOfStock: 10 }],
  );
  expect(models[0]?.product).toBeUndefined();
  expect(models[0]?.approvedProduct).toBeUndefined();
});
