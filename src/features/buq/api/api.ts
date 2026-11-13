import type { AxiosRequestConfig } from 'axios';
import type { forecastBody } from '@/features/buq/lib/forecast';
import type {
  Buq,
  BuqForecast,
  BuqPeriod,
  BuqPreparation,
  BuqRejection,
  NamedItem,
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
      params: { sort: 'id,asc', ...config.params, page, size: PAGE_SIZE },
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

export type ForecastBody = ReturnType<typeof forecastBody>;

export async function fetchBuqForecast(id: string) {
  const { data } = await client.get<BuqForecast>(`/bottomUpQuantifications/${id}`);
  return data;
}

export async function saveBuqForecast(body: ForecastBody) {
  const { data } = await client.put<BuqForecast>(`/bottomUpQuantifications/${body.id}`, body);
  return data;
}

export async function submitBuqForecast(body: ForecastBody) {
  const { data } = await client.post<BuqForecast>(
    `/bottomUpQuantifications/${body.id}/submit`,
    body,
  );
  return data;
}

export async function authorizeBuqForecast(body: ForecastBody) {
  const { data } = await client.post<BuqForecast>(
    `/bottomUpQuantifications/${body.id}/authorize`,
    body,
  );
  return data;
}

export async function fetchRemarks() {
  const { data } = await client.get<NamedItem[]>('/remark');
  return data;
}

export function fetchSourcesOfFunds() {
  return fetchEveryPage<NamedItem>('/sourcesOfFunds', { params: { sort: undefined } });
}

export async function fetchMostRecentRejection(id: string) {
  const { data } = await client.get<BuqRejection>(
    `/bottomUpQuantifications/${id}/mostRecentRejection`,
  );
  return data;
}
