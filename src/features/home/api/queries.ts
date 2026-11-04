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
    queryKey: key('approvals'),
    queryFn: ({ signal }) => fetchApprovals(APPROVALS_SHOWN, { signal }),
  });

export const convertCountOptions = () =>
  queryOptions({
    queryKey: key('convert-count'),
    queryFn: ({ signal }) => fetchConvertCount({ signal }),
  });

export const openOrdersCountOptions = () =>
  queryOptions({
    queryKey: key('open-orders-count'),
    queryFn: ({ signal }) => fetchOpenOrdersCount({ signal }),
  });

export const requisitionStatusCountsOptions = () =>
  queryOptions({
    queryKey: key('requisition-statuses'),
    queryFn: ({ signal }) => fetchRequisitionStatusCounts({ signal }),
  });

export const recentRequisitionsOptions = () =>
  queryOptions({
    queryKey: key('recent-requisitions'),
    queryFn: ({ signal }) => fetchRecentRequisitions({ signal }),
  });

export const equipmentStatusCountsOptions = () =>
  queryOptions({
    queryKey: key('equipment-statuses'),
    queryFn: ({ signal }) => fetchEquipmentStatusCounts({ signal }),
  });

export const systemNotificationsOptions = () =>
  queryOptions({
    queryKey: key('notifications'),
    queryFn: ({ signal }) => fetchSystemNotifications({ signal }),
  });

export const firstNameOptions = (userId: string) =>
  queryOptions({
    queryKey: key('first-name', userId),
    queryFn: ({ signal }) => fetchFirstName(userId, { signal }),
  });
