import type {
  EquipmentStatus,
  RequisitionStatus,
  RequisitionSummary,
  SystemNotification,
} from '@/features/home/lib/types';
import { client } from '@/integrations/axios';
import type { Page } from '@/lib/types';

// Spring binds repeated params (`status=a&status=b`), not axios's default `status[]=a`.
const repeatArrays = { indexes: null };

/** How many records match, read from a one-row page so nothing else is transferred. */
async function countOf(url: string, params: Record<string, unknown> = {}): Promise<number> {
  const { data } = await client.get<Page<unknown>>(url, {
    params: { ...params, page: 0, size: 1 },
    paramsSerializer: repeatArrays,
  });
  return data.totalElements;
}

export type ApprovalsPage = {
  requisitions: RequisitionSummary[];
  total: number;
};

/** The requisitions waiting for this user's approval, emergencies and the longest-waiting first. */
export async function fetchApprovals(size: number): Promise<ApprovalsPage> {
  const { data } = await client.get<Page<RequisitionSummary>>(
    '/requisitions/requisitionsForApproval',
    {
      params: { page: 0, size, sort: ['emergency,desc', 'authorizedDate,asc'] },
      paramsSerializer: repeatArrays,
    },
  );
  return { requisitions: data.content, total: data.totalElements };
}

export function fetchConvertCount(): Promise<number> {
  return countOf('/requisitions/requisitionsForConvert');
}

/** Orders not received yet, from the moment they are placed until they reach the facility. */
const OPEN_ORDER_STATUSES = ['ORDERED', 'FULFILLING', 'READY_TO_PACK', 'SHIPPED', 'IN_ROUTE'];

export function fetchOpenOrdersCount(): Promise<number> {
  return countOf('/orders', { status: OPEN_ORDER_STATUSES });
}

/** The statuses a sent requisition moves through, in order, as the status meter shows them. */
export const REQUISITION_PIPELINE = [
  'SUBMITTED',
  'AUTHORIZED',
  'IN_APPROVAL',
  'APPROVED',
  'RELEASED',
] as const satisfies readonly RequisitionStatus[];

export type PipelineStatus = (typeof REQUISITION_PIPELINE)[number];

export async function fetchRequisitionStatusCounts(): Promise<Record<PipelineStatus, number>> {
  const counts = await Promise.all(
    REQUISITION_PIPELINE.map((status) =>
      countOf('/requisitions/search', { requisitionStatus: status }),
    ),
  );
  return Object.fromEntries(
    REQUISITION_PIPELINE.map((status, index) => [status, counts[index]]),
  ) as Record<PipelineStatus, number>;
}

/** How many of the latest requisitions the period chart groups; enough to fill six periods. */
const RECENT_REQUISITIONS = 500;

export async function fetchRecentRequisitions(): Promise<RequisitionSummary[]> {
  const { data } = await client.get<Page<RequisitionSummary>>('/requisitions/search', {
    params: { page: 0, size: RECENT_REQUISITIONS, sort: 'createdDate,desc' },
  });
  return data.content;
}

export const EQUIPMENT_STATUSES = [
  'FUNCTIONING',
  'NEEDS_ATTENTION',
  'AWAITING_REPAIR',
  'UNSERVICEABLE',
] as const satisfies readonly EquipmentStatus[];

export async function fetchEquipmentStatusCounts(): Promise<Record<EquipmentStatus, number>> {
  const counts = await Promise.all(
    EQUIPMENT_STATUSES.map((functionalStatus) => countOf('/inventoryItems', { functionalStatus })),
  );
  return Object.fromEntries(
    EQUIPMENT_STATUSES.map((status, index) => [status, counts[index]]),
  ) as Record<EquipmentStatus, number>;
}

/** Notices an administrator has published for everyone, as the legacy header shows them. */
export async function fetchSystemNotifications(): Promise<SystemNotification[]> {
  const { data } = await client.get<Page<SystemNotification>>('/systemNotifications', {
    params: { isDisplayed: true, page: 0, size: 5 },
  });
  return data.content;
}

export async function fetchFirstName(userId: string): Promise<string> {
  const { data } = await client.get<{ firstName: string }>(`/users/${userId}`);
  return data.firstName;
}
