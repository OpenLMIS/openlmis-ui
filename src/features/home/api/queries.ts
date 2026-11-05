import { queryOptions } from '@tanstack/react-query';
import {
  fetchApprovals,
  fetchConvertCount,
  fetchEquipmentStatusCounts,
  fetchFirstName,
  fetchOpenOrdersCount,
  fetchRecentRequisitions,
  fetchRequisitionStatusCounts,
  fetchSystemNotifications,
} from '@/features/home/api/api';
import { queryKeys } from '@/lib/key-factory';

const key = (...parts: string[]) => [...queryKeys.home.all, ...parts] as const;

/** Rows the approvals table shows; its total also feeds the To Approve tile. */
const APPROVALS_SHOWN = 5;

export const approvalsOptions = () =>
  queryOptions({
    retry: false,
    queryKey: key('approvals'),
    queryFn: ({ signal }) =>
      fetchApprovals(APPROVALS_SHOWN, {
        signal,
        backgroundDownload: true,
        downloadProvider: 'home',
      }),
  });

export const convertCountOptions = () =>
  queryOptions({
    retry: false,
    queryKey: key('convert-count'),
    queryFn: ({ signal }) =>
      fetchConvertCount({ signal, backgroundDownload: true, downloadProvider: 'home' }),
  });

export const openOrdersCountOptions = () =>
  queryOptions({
    retry: false,
    queryKey: key('open-orders-count'),
    queryFn: ({ signal }) =>
      fetchOpenOrdersCount({ signal, backgroundDownload: true, downloadProvider: 'home' }),
  });

export const requisitionStatusCountsOptions = () =>
  queryOptions({
    retry: false,
    queryKey: key('requisition-statuses'),
    queryFn: ({ signal }) =>
      fetchRequisitionStatusCounts({ signal, backgroundDownload: true, downloadProvider: 'home' }),
  });

export const recentRequisitionsOptions = () =>
  queryOptions({
    retry: false,
    queryKey: key('recent-requisitions'),
    queryFn: ({ signal }) =>
      fetchRecentRequisitions({ signal, backgroundDownload: true, downloadProvider: 'home' }),
  });

export const equipmentStatusCountsOptions = () =>
  queryOptions({
    retry: false,
    queryKey: key('equipment-statuses'),
    queryFn: ({ signal }) =>
      fetchEquipmentStatusCounts({ signal, backgroundDownload: true, downloadProvider: 'home' }),
  });

export const systemNotificationsOptions = () =>
  queryOptions({
    retry: false,
    queryKey: key('notifications'),
    queryFn: ({ signal }) =>
      fetchSystemNotifications({ signal, backgroundDownload: true, downloadProvider: 'home' }),
  });

export const firstNameOptions = (userId: string) =>
  queryOptions({
    retry: false,
    queryKey: key('first-name', userId),
    queryFn: ({ signal }) =>
      fetchFirstName(userId, { signal, backgroundDownload: true, downloadProvider: 'home' }),
  });
