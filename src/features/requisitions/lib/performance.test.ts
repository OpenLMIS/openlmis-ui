import { expect, it } from 'vitest';
import { calculateLine, calculateTotals } from '@/features/requisitions/lib/calculations';
import { column, line, product, record } from '@/features/requisitions/lib/fixtures/builders';
import { buildLines } from '@/features/requisitions/lib/lines';
import { compileColumns } from '@/features/requisitions/lib/template';

it('compiles, sorts and calculates 500 lines within 50ms', () => {
  const products = Array.from({ length: 500 }, (_, i) =>
    product({ id: String(i), fullProductName: `Product ${500 - i}` }),
  );
  const r = record({
    template: {
      columnsMap: Object.fromEntries(
        [
          'approvedQuantity',
          'beginningBalance',
          'remarks',
          'requestedQuantity',
          'requestedQuantityExplanation',
          'stockOnHand',
          'skipped',
          'totalReceivedQuantity',
          'totalConsumedQuantity',
          'totalLossesAndAdjustments',
          'total',
          'packsToShip',
          'orderable.productCode',
          'pricePerPack',
          'orderable.fullProductName',
          'dispensable',
          'totalCost',
          'adjustedConsumption',
          'numberOfNewPatientsAdded',
          'totalStockoutDays',
          'averageConsumption',
          'maximumStockQuantity',
          'calculatedOrderQuantity',
          'calculatedOrderQuantityIsa',
          'additionalQuantityRequired',
          'idealStockAmount',
          'numberOfPatientsOnTreatmentNextMonth',
          'dosesPerPatient',
          'totalRequirement',
          'totalQuantityNeededByHf',
          'quantityToIssue',
          'convertedQuantityToIssue',
          'remarksForTBDispensedQuantity',
          'supplyingFacilityStockOnHand',
        ].map((name, i) => [name, column(name, i)]),
      ),
    },
    requisitionLineItems: products.map((p) =>
      line({
        id: p.id,
        orderable: { id: p.id, versionNumber: 1 },
        beginningBalance: 100,
        totalConsumedQuantity: 10,
        requestedQuantity: 20,
      }),
    ),
  });
  const approvedProducts = [{ id: 'approved', meta: { versionNumber: 1 }, maxPeriodsOfStock: 2.5 }];
  const run = () => {
    compileColumns(r.template, { tab: 'fullSupply', status: r.status });
    return calculateTotals(
      buildLines(r, products, approvedProducts).map((m) => ({
        ...m,
        line: calculateLine(m, r, 1),
      })),
    );
  };
  run();
  const start = performance.now();
  expect(run().total).toBe(2000);
  expect(performance.now() - start).toBeLessThan(50);
});
