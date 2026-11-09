import { describe, expect, it } from 'vitest';
import {
  fulfillOrdersSearchSchema,
  toOrderParams,
  viewOrdersSearchSchema,
} from '@/features/orders/lib/order-search';

const supplier = 'b1b0d686-38ad-4f41-ae8e-f3dba2958397';

describe('order list requests from shared links', () => {
  it('drops unsupported statuses and defaults fulfillment to both statuses', () => {
    for (const status of ['unknown', 'CREATING']) {
      expect(toOrderParams(viewOrdersSearchSchema.parse({ status })).status).toBeUndefined();
      expect(toOrderParams(fulfillOrdersSearchSchema.parse({ status }), 'fulfill').status).toEqual([
        'ORDERED',
        'FULFILLING',
      ]);
    }
    expect(viewOrdersSearchSchema.parse({ status: 'transfer_failed' }).status).toBe(
      'TRANSFER_FAILED',
    );
    expect(toOrderParams(fulfillOrdersSearchSchema.parse({}), 'fulfill').status).toEqual([
      'ORDERED',
      'FULFILLING',
    ]);
  });

  it('drops malformed ids and maps date parameters before building requests', () => {
    const search = viewOrdersSearchSchema.parse({
      supplyingFacilityId: 'bad',
      requestingFacilityId: 'bad',
      programId: 'bad',
      periodStart: '2026-11-01',
      periodEnd: '2026-11-09',
    });
    expect(toOrderParams(search)).toMatchObject({
      supplyingFacilityId: undefined,
      requestingFacilityId: undefined,
      programId: undefined,
      periodStartDate: '2026-11-01',
      periodEndDate: '2026-11-09',
    });
  });

  it('adds stable sort tiebreakers without repeating the chosen date field', () => {
    expect(toOrderParams({ sort: 'emergency', dir: 'desc' }).sort).toEqual([
      'emergency,desc',
      'createdDate,desc',
      'id,asc',
    ]);
    expect(toOrderParams({ sort: 'orderCode', dir: 'asc' }).sort).toEqual([
      'orderCode,asc',
      'createdDate,desc',
      'id,asc',
    ]);
    expect(toOrderParams({ sort: 'createdDate', dir: 'asc' }).sort).toEqual([
      'createdDate,asc',
      'id,asc',
    ]);
    expect(toOrderParams({}).sort).toEqual(['createdDate,desc', 'id,asc']);
  });

  it('forwards valid facility and program ids', () => {
    expect(
      toOrderParams(
        viewOrdersSearchSchema.parse({
          supplyingFacilityId: supplier,
          requestingFacilityId: supplier,
          programId: supplier,
        }),
      ),
    ).toMatchObject({
      supplyingFacilityId: supplier,
      requestingFacilityId: supplier,
      programId: supplier,
    });
  });
});
