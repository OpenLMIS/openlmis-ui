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
export const APPROVALS_SHOWN = 5;

export const approvalsOptions = () =>
  queryOptions({ queryKey: key('approvals'), queryFn: () => fetchApprovals(APPROVALS_SHOWN) });

export const convertCountOptions = () =>
  queryOptions({ queryKey: key('convert-count'), queryFn: fetchConvertCount });

export const openOrdersCountOptions = () =>
  queryOptions({ queryKey: key('open-orders-count'), queryFn: fetchOpenOrdersCount });

export const requisitionStatusCountsOptions = () =>
  queryOptions({ queryKey: key('requisition-statuses'), queryFn: fetchRequisitionStatusCounts });

export const recentRequisitionsOptions = () =>
  queryOptions({ queryKey: key('recent-requisitions'), queryFn: fetchRecentRequisitions });

export const equipmentStatusCountsOptions = () =>
  queryOptions({ queryKey: key('equipment-statuses'), queryFn: fetchEquipmentStatusCounts });

export const systemNotificationsOptions = () =>
  queryOptions({ queryKey: key('notifications'), queryFn: fetchSystemNotifications });

export const firstNameOptions = (userId: string) =>
  queryOptions({ queryKey: key('first-name', userId), queryFn: () => fetchFirstName(userId) });
