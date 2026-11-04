import type { AxiosRequestConfig } from 'axios';
import type { RequisitionSummary, SystemNotification } from '@/features/home/lib/types';
import { client } from '@/integrations/axios';
import { EQUIPMENT_STATUSES, type EquipmentStatus } from '@/lib/cce-equipment-status';
import type { RequisitionStatus } from '@/lib/requisition-status';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import type { Page } from '@/lib/types';

// Spring binds repeated params (`status=a&status=b`), not axios's default `status[]=a`.
const repeatArrays = { indexes: null };

/** One count per status, fetched together, keyed by status. */
async function countEach<TStatus extends string>(
  statuses: readonly TStatus[],
  count: (status: TStatus) => Promise<number>,
): Promise<Record<TStatus, number>> {
  const counts = await Promise.all(statuses.map(count));
  return Object.fromEntries(statuses.map((status, index) => [status, counts[index]])) as Record<
    TStatus,
    number
  >;
}

/** How many records match, read from a one-row page so nothing else is transferred. */
async function countOf(
  url: string,
  params: Record<string, unknown> = {},
  config?: AxiosRequestConfig,
): Promise<number> {
  const { data } = await client.get<Page<unknown>>(url, {
    ...config,
    params: { ...params, page: 0, size: 1 },
    paramsSerializer: repeatArrays,
  });
  return data.totalElements;
}

type ApprovalsPage = {
  requisitions: RequisitionSummary[];
  total: number;
};

/** The requisitions waiting for this user's approval, emergencies and the longest-waiting first. */
export async function fetchApprovals(
  size: number,
  config?: AxiosRequestConfig,
): Promise<ApprovalsPage> {
  const { data } = await client.get<Page<RequisitionSummary>>(
    '/requisitions/requisitionsForApproval',
    {
      ...config,
      params: { page: 0, size, sort: ['emergency,desc', 'authorizedDate,asc'] },
      paramsSerializer: repeatArrays,
    },
  );
  return { requisitions: data.content, total: data.totalElements };
}

export function fetchConvertCount(config?: AxiosRequestConfig): Promise<number> {
  return countOf('/requisitions/requisitionsForConvert', {}, config);
}

/** Orders not received yet, from the moment they are placed until they reach the facility. */
const OPEN_ORDER_STATUSES = ['ORDERED', 'FULFILLING', 'READY_TO_PACK', 'SHIPPED', 'IN_ROUTE'];

export function fetchOpenOrdersCount(config?: AxiosRequestConfig): Promise<number> {
  return countOf('/orders', { status: OPEN_ORDER_STATUSES }, config);
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

export function fetchRequisitionStatusCounts(
  config?: AxiosRequestConfig,
): Promise<Record<PipelineStatus, number>> {
  return countEach(REQUISITION_PIPELINE, (requisitionStatus) =>
    countOf('/requisitions/search', { requisitionStatus }, config),
  );
}

/** How many of the latest requisitions the period chart groups; enough to fill six periods. */
const RECENT_REQUISITIONS = 500;

export async function fetchRecentRequisitions(
  config?: AxiosRequestConfig,
): Promise<RequisitionSummary[]> {
  const { data } = await client.get<Page<RequisitionSummary>>('/requisitions/search', {
    ...config,
    params: { page: 0, size: RECENT_REQUISITIONS, sort: 'createdDate,desc' },
  });
  return data.content;
}

export function fetchEquipmentStatusCounts(
  config?: AxiosRequestConfig,
): Promise<Record<EquipmentStatus, number>> {
  return countEach(EQUIPMENT_STATUSES, (functionalStatus) =>
    countOf('/inventoryItems', { functionalStatus }, config),
  );
}

/** Notices an administrator has published for everyone. */
export async function fetchSystemNotifications(
  config?: AxiosRequestConfig,
): Promise<SystemNotification[]> {
  const scope = getSessionScope();
  const notifications: SystemNotification[] = [];
  for (let page = 0; ; page += 1) {
    assertSessionScope(scope);
    const { data } = await client.get<Page<SystemNotification>>('/systemNotifications', {
      ...config,
      params: { isDisplayed: true, expand: 'author', page, size: 100, sort: 'createdDate,desc' },
    });
    assertSessionScope(scope);
    notifications.push(...data.content);
    if (page + 1 >= data.totalPages) break;
  }
  return notifications;
}

export async function fetchFirstName(userId: string, config?: AxiosRequestConfig): Promise<string> {
  const { data } = await client.get<{ firstName: string }>(`/users/${userId}`, config);
  return data.firstName;
}
