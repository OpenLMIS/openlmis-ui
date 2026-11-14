import type { z } from 'zod';
import {
  ORDER_FILTERS,
  ORDER_SORT_FIELDS,
  toOrderParams,
  uuidFilter,
} from '@/features/orders/lib/order-search';
import { tableSearchSchema } from '@/lib/table-search';

export const podSearchSchema = tableSearchSchema(ORDER_SORT_FIELDS).extend({
  ...ORDER_FILTERS,
  supplyingFacilityId: uuidFilter,
});
export type PodListSearch = z.infer<typeof podSearchSchema>;
export const toPodParams = (search: PodListSearch) => toOrderParams(search, 'pod');
export function solePodSearch(
  search: PodListSearch,
  programIds: readonly string[],
  requestingFacilityIds: readonly string[],
): PodListSearch | null {
  const programId = search.programId ?? (programIds.length === 1 ? programIds[0] : undefined);
  const requestingFacilityId =
    search.requestingFacilityId ??
    (requestingFacilityIds.length === 1 ? requestingFacilityIds[0] : undefined);
  return programId !== search.programId || requestingFacilityId !== search.requestingFacilityId
    ? { ...search, programId, requestingFacilityId }
    : null;
}
export function refusedPodSearch(
  search: PodListSearch,
  allowed: {
    programIds: readonly string[];
    requestingFacilityIds: readonly string[];
    supplyingFacilityIds: readonly string[];
  },
) {
  return Boolean(
    (search.programId && !allowed.programIds.includes(search.programId)) ||
      (search.requestingFacilityId &&
        !allowed.requestingFacilityIds.includes(search.requestingFacilityId)) ||
      (search.supplyingFacilityId &&
        !allowed.supplyingFacilityIds.includes(search.supplyingFacilityId)),
  );
}
export const canSearchPods = (search: PodListSearch) =>
  Boolean(search.programId && (search.requestingFacilityId || search.supplyingFacilityId));
