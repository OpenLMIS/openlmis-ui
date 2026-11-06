import type { Buq, BuqPeriod, BuqPreparation } from '@/features/buq/lib/types';
import { client } from '@/integrations/axios';
import { fetchReport } from '@/lib/fetch-report';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';
import type { Page } from '@/lib/types';

const PAGE_SIZE = 100;
const PREPARED_STATUSES = ['DRAFT', 'SUBMITTED', 'REJECTED'];

export const BUQ_CSV_FILENAME = 'buq_quantification_preparation_report.csv';

export async function fetchPreparedBuqs(facilityId: string) {
  const scope = getSessionScope();
  const buqs: Buq[] = [];
  for (let page = 0; ; page += 1) {
    assertSessionScope(scope);
    const { data } = await client.get<Page<Buq>>('/bottomUpQuantifications', {
      params: { facility: facilityId, status: PREPARED_STATUSES, page, size: PAGE_SIZE },
      paramsSerializer: { indexes: null },
    });
    assertSessionScope(scope);
    buqs.push(...data.content);
    if (page + 1 >= data.totalPages) return buqs;
  }
}

export async function fetchBuqPeriods(scheduleId: string) {
  const scope = getSessionScope();
  const periods: BuqPeriod[] = [];
  for (let page = 0; ; page += 1) {
    assertSessionScope(scope);
    const { data } = await client.get<Page<BuqPeriod>>('/processingPeriods', {
      params: { processingScheduleId: scheduleId, page, size: PAGE_SIZE, sort: 'startDate,asc' },
    });
    assertSessionScope(scope);
    periods.push(...data.content);
    if (page + 1 >= data.totalPages) return periods;
  }
}

export async function prepareBuq(preparation: BuqPreparation) {
  const { data } = await client.post<Buq>('/bottomUpQuantifications/prepare', null, {
    params: preparation,
  });
  return data;
}

export function downloadBuq(id: string) {
  return fetchReport(`/bottomUpQuantifications/${id}/download`, undefined);
}

export async function deleteBuq(id: string) {
  await client.delete(`/bottomUpQuantifications/${id}`);
}
