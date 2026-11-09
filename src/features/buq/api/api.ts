import type { AxiosRequestConfig } from 'axios';
import type {
  Buq,
  BuqPeriod,
  BuqPreparation,
  PreparedBuq,
  TakenPeriod,
} from '@/features/buq/lib/types';
import { client } from '@/integrations/axios';
import { fetchReport } from '@/lib/fetch-report';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import type { Page } from '@/lib/types';

const PAGE_SIZE = 100;
const OPEN_STATUSES = ['DRAFT', 'SUBMITTED', 'REJECTED'];

export const BUQ_CSV_FILENAME = 'buq_quantification_preparation_report.csv';

export class BuqMovedError extends Error {}

async function fetchEveryPage<T>(path: string, config: AxiosRequestConfig) {
  const scope = getSessionScope();
  const records: T[] = [];
  for (let page = 0; ; page += 1) {
    assertSessionScope(scope);
    const { data } = await client.get<Page<T>>(path, {
      ...config,
      params: { ...config.params, page, size: PAGE_SIZE },
    });
    assertSessionScope(scope);
    records.push(...data.content);
    if (page + 1 >= data.totalPages) return records;
  }
}

export function fetchOpenBuqs(facilityId: string) {
  return fetchEveryPage<Buq>('/bottomUpQuantifications', {
    params: { facility: facilityId, status: OPEN_STATUSES },
    paramsSerializer: { indexes: null },
  });
}

export function fetchTakenPeriods(facilityId: string) {
  return fetchEveryPage<TakenPeriod>('/bottomUpQuantifications', {
    params: { facility: facilityId },
  });
}

export function fetchBuqPeriods(scheduleId: string) {
  return fetchEveryPage<BuqPeriod>('/processingPeriods', {
    params: { processingScheduleId: scheduleId, sort: 'startDate,asc' },
  });
}

export async function prepareBuq(preparation: BuqPreparation) {
  const { data } = await client.post<PreparedBuq>('/bottomUpQuantifications/prepare', null, {
    params: preparation,
  });
  return data;
}

export function downloadBuq(id: string) {
  return fetchReport(`/bottomUpQuantifications/${id}/download`, undefined);
}

export async function deleteBuq(id: string) {
  const scope = getSessionScope();
  const { data } = await client.get<{ status: string }>(`/bottomUpQuantifications/${id}`);
  if (!OPEN_STATUSES.includes(data.status)) throw new BuqMovedError();
  assertSessionScope(scope);
  await client.delete(`/bottomUpQuantifications/${id}`);
}
