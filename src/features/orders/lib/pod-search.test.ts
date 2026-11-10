import { describe, expect, it } from 'vitest';
import { POD_STATUSES } from '@/features/orders/lib/order-status';
import {
  canSearchPods,
  podSearchSchema,
  refusedPodSearch,
  solePodSearch,
  toPodParams,
} from '@/features/orders/lib/pod-search';

const p = '11111111-1111-4111-8111-111111111111';
const f = '22222222-2222-4222-8222-222222222222';
describe('POD list search', () => {
  it('validates UUIDs and uses the View Orders sort fields and stable POD status request', () => {
    expect(
      podSearchSchema.parse({ programId: 'bad', requestingFacilityId: f, sort: 'bad' }),
    ).toEqual({ requestingFacilityId: f });
    const params = toPodParams(
      podSearchSchema.parse({ programId: p, sort: 'orderCode', dir: 'asc' }),
    );
    expect(params.status).toEqual(POD_STATUSES);
    expect(params.sort).toEqual(['orderCode,asc', 'createdDate,desc', 'id,asc']);
    expect(toPodParams({}).sort).toEqual(['createdDate,desc', 'id,asc']);
  });
  it('adds sole choices even to supplier-only links, without replacing explicit selections', () => {
    expect(solePodSearch({ supplyingFacilityId: 's', page: 3 }, [p], [f])).toEqual({
      supplyingFacilityId: 's',
      page: 3,
      programId: p,
      requestingFacilityId: f,
    });
    expect(solePodSearch({ programId: 'other', requestingFacilityId: f }, [p], [f])).toBeNull();
    expect(solePodSearch({}, [p, 'q'], [])).toBeNull();
  });
  it('refuses unavailable choices and requires a program and either facility to search', () => {
    const allowed = { programIds: [p], requestingFacilityIds: [f], supplyingFacilityIds: ['s'] };
    expect(refusedPodSearch({ programId: 'q' }, allowed)).toBe(true);
    expect(refusedPodSearch({ requestingFacilityId: 'x' }, allowed)).toBe(true);
    expect(refusedPodSearch({ supplyingFacilityId: 'x' }, allowed)).toBe(true);
    expect(refusedPodSearch({}, allowed)).toBe(false);
    expect(canSearchPods({ programId: p, supplyingFacilityId: 's' })).toBe(true);
    expect(canSearchPods({ programId: p })).toBe(false);
  });
});
