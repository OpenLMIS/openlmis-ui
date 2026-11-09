import { useQuery } from '@tanstack/react-query';
import { orderRequestingFacilitiesOptions } from '@/features/orders/api/queries';
import { minimalFacilitiesOptions, programsOptions } from '@/features/reference-data/api/queries';

export function useOrderFilterOptions(supplierIds: string[]) {
  const programQuery = useQuery(programsOptions());
  const requesters = useQuery(orderRequestingFacilitiesOptions(supplierIds));
  const requestingIds = new Set(requesters.data ?? []);
  const facilityQuery = useQuery({
    ...minimalFacilitiesOptions(),
    enabled: requestingIds.size > 0,
  });
  const failedLookup = [
    programQuery,
    ...(supplierIds.length ? [requesters, facilityQuery] : []),
  ].find((query) => query.isError);
  return {
    programs: (programQuery.data ?? []).map(({ id, name }) => ({ value: id, label: name ?? id })),
    facilities: (facilityQuery.data ?? [])
      .filter(({ id }) => requestingIds.has(id))
      .map(({ id, code, name }) => ({ value: id, label: [code, name].filter(Boolean).join(' - ') }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    programsDisabled: !programQuery.isSuccess,
    facilitiesDisabled: !requesters.isSuccess || !facilityQuery.isSuccess,
    failedLookup,
  };
}
