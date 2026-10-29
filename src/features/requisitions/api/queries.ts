import { queryOptions } from '@tanstack/react-query';
import {
  approvedProductsByIdentitiesOptions,
  currencySettingsOptions,
  orderablesByIdentitiesOptions,
  processingPeriodOptions,
  programLookupOptions,
} from '@/features/reference-data/api/queries';
import {
  fetchRequisition,
  fetchStatusMessages,
  searchRequisitions,
} from '@/features/requisitions/api/api';
import type { RequisitionRecord, RequisitionsQuery } from '@/features/requisitions/lib/types';
import { queryKeys } from '@/lib/key-factory';

export const requisitionSearchOptions = (params: RequisitionsQuery) =>
  queryOptions({
    queryKey: queryKeys.requisitions.list(params),
    queryFn: () => searchRequisitions(params),
  });

export const requisitionOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.requisitions.detail(id),
    queryFn: () => fetchRequisition(id),
  });
export const requisitionStatusMessagesOptions = (id: string) =>
  queryOptions({
    queryKey: [...queryKeys.requisitions.all, 'statusMessages', id] as const,
    queryFn: () => fetchStatusMessages(id),
  });

export const requisitionGridQueries = (record: RequisitionRecord) =>
  [
    orderablesByIdentitiesOptions(record.requisitionLineItems.map((l) => l.orderable)),
    approvedProductsByIdentitiesOptions(
      record.requisitionLineItems.flatMap((l) => (l.approvedProduct ? [l.approvedProduct] : [])),
    ),
    processingPeriodOptions(record.processingPeriod.id),
    currencySettingsOptions(),
    programLookupOptions(record.program.id),
  ] as const;
