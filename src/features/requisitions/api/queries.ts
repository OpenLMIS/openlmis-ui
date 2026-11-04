import { queryOptions } from '@tanstack/react-query';
import {
  currencySettingsOptions,
  processingPeriodOptions,
  programLookupOptions,
} from '@/features/reference-data/api/queries';
import {
  fetchApprovalList,
  fetchBatchRequisitions,
  fetchConvertList,
  fetchPeriodsForInitiate,
  fetchRequisition,
  fetchStatusMessages,
  fetchUnskipSetting,
  searchRequisitions,
} from '@/features/requisitions/api/api';
import { LOCAL_LIST_KEY } from '@/features/requisitions/hooks/use-offline-copies';
import { type ApprovalSearch, toApprovalQuery } from '@/features/requisitions/lib/approval-search';
import { type ConvertSearch, toConvertQuery } from '@/features/requisitions/lib/convert-search';
import { localApprovals, localRequisitions } from '@/features/requisitions/lib/offline-search';
import {
  readSingle,
  savedApprovedOptions,
  savedProductsOptions,
} from '@/features/requisitions/lib/offline-single';
import type {
  InitiateQuery,
  RequisitionRecord,
  RequisitionsQuery,
} from '@/features/requisitions/lib/types';
import { deviceQuery } from '@/lib/device-query';
import { queryKeys } from '@/lib/key-factory';
import { onlineOrDevice } from '@/lib/local-data';
import { isOnline } from '@/lib/online';

export const requisitionSearchOptions = (
  params: RequisitionsQuery,
  online = isOnline(),
  offline = false,
  timeZone = 'UTC',
) =>
  deviceQuery({
    queryKey:
      !online || offline
        ? [...LOCAL_LIST_KEY, 'view', params]
        : queryKeys.requisitions.list(params),
    online: online && !offline,
    server: () => (offline ? localRequisitions(params, timeZone) : searchRequisitions(params)),
    device: () => localRequisitions(params, timeZone),
    staleTime: 30_000,
  });

export const requisitionOptions = (id: string) =>
  deviceQuery({
    queryKey: queryKeys.requisitions.detail(id),
    online: isOnline(),
    server: () => fetchRequisition(id),
    device: async () => (await readSingle(id)).single.record,
    staleTime: 0,
  });
export const requisitionStatusMessagesOptions = (id: string) =>
  queryOptions({
    queryKey: [...queryKeys.requisitions.all, 'statusMessages', id] as const,
    queryFn: () =>
      onlineOrDevice(
        () => fetchStatusMessages(id),
        async () => (await readSingle(id)).single.references.messages,
      ),
  });

export const requisitionGridQueries = (record: RequisitionRecord) =>
  [
    savedProductsOptions(
      record.id,
      record.requisitionLineItems.map((l) => l.orderable),
    ),
    savedApprovedOptions(
      record.id,
      record.requisitionLineItems.flatMap((l) => (l.approvedProduct ? [l.approvedProduct] : [])),
    ),
    processingPeriodOptions(record.processingPeriod.id),
    currencySettingsOptions(),
    programLookupOptions(record.program.id),
  ] as const;

export const periodsForInitiateOptions = (params: InitiateQuery) =>
  queryOptions({
    queryKey: [...queryKeys.requisitions.all, 'periodsForInitiate', params] as const,
    queryFn: () => fetchPeriodsForInitiate(params),
    staleTime: 0,
  });

export const unskipSettingOptions = () =>
  queryOptions({
    queryKey: queryKeys.requisitionUnskipSetting.all,
    queryFn: fetchUnskipSetting,
  });

export const approvalListOptions = (search: ApprovalSearch, online = isOnline()) =>
  deviceQuery({
    queryKey:
      !online || search.offline
        ? [...LOCAL_LIST_KEY, 'approve', search]
        : [...queryKeys.requisitions.all, 'approval', search],
    online: online && !search.offline,
    server: () =>
      search.offline ? localApprovals(search) : fetchApprovalList(toApprovalQuery(search)),
    device: () => localApprovals(search),
    staleTime: 0,
  });

export const convertListOptions = (search: ConvertSearch) =>
  queryOptions({
    queryKey: [...queryKeys.requisitions.all, 'convert', search] as const,
    queryFn: () => fetchConvertList(toConvertQuery(search)),
  });

export const batchRequisitionsOptions = (ids: readonly string[]) =>
  queryOptions({
    queryKey: [...queryKeys.requisitions.all, 'batch', ids] as const,
    queryFn: () => fetchBatchRequisitions(ids),
    staleTime: 0,
  });
