import { isAxiosError } from 'axios';
import { z } from 'zod';
import type { ConvertListRow } from '@/features/requisitions/lib/types';
import { tableSearchSchema, toPaginationState } from '@/lib/table-search';

export const convertSearchSchema = tableSearchSchema(['unused'])
  .omit({ sort: true, dir: true })
  .extend({
    programId: z.uuid().optional().catch(undefined),
    facilityId: z.uuid().optional().catch(undefined),
  });
export type ConvertSearch = z.infer<typeof convertSearchSchema>;
export type ConvertSelection = ReadonlyMap<string, { label: string }>;
export type DepotMap = Readonly<Record<string, string>>;
export type DepotOffers = Pick<ConvertListRow, 'supplyingDepots'> & { requisition: { id: string } };
export function toConvertQuery(search: ConvertSearch) {
  const { pageIndex, pageSize } = toPaginationState(search, 20);
  return {
    page: pageIndex,
    size: pageSize,
    ...(search.programId && { programId: search.programId }),
    ...(search.facilityId && { facilityId: search.facilityId }),
  };
}
export function seedDepots(previous: DepotMap, rows: readonly DepotOffers[]): DepotMap {
  const next = { ...previous };
  for (const { requisition, supplyingDepots } of rows) {
    const offered = supplyingDepots.filter((depot) => depot !== null);
    const chosen = previous[requisition.id];
    next[requisition.id] = offered.some(({ id }) => id === chosen)
      ? (chosen ?? '')
      : offered.length === 1
        ? offered[0].id
        : '';
  }
  return next;
}
export function convertSelectionError(picked: ConvertSelection, depots: DepotMap) {
  if (!picked.size) return 'none';
  if ([...picked.keys()].some((id) => !depots[id])) return 'depot';
}
export function releaseBody(createOrder: boolean, picked: ConvertSelection, depots: DepotMap) {
  return {
    createOrder,
    requisitionsToRelease: [...picked.keys()].map((requisitionId) => ({
      requisitionId,
      supplyingDepotId: depots[requisitionId] ?? '',
    })),
  };
}
export type ReleaseBody = ReturnType<typeof releaseBody>;
export function uncertainRelease(error: unknown) {
  return (
    !isAxiosError(error) ||
    !error.response ||
    error.response.status >= 500 ||
    error.response.data?.messageKey === 'requisition.error.convertingMultipleRequisitions'
  );
}
