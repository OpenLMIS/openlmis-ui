import type { StockCardSummariesQuery, StockCardSummary } from '@/features/stock-on-hand/lib/types';
import { client } from '@/integrations/axios';
import { fetchReport } from '@/lib/fetch-report';
import type { Page } from '@/lib/types';

export async function fetchStockCardSummaries(query: StockCardSummariesQuery) {
  const { data } = await client.get<Page<StockCardSummary>>('/v2/stockCardSummaries', {
    params: query,
  });
  return data;
}

type ReportParams = { programId: string; facilityId: string; showInDoses: boolean; lang: string };

export async function fetchStockOnHandReport({
  programId,
  facilityId,
  showInDoses,
  lang,
}: ReportParams) {
  return fetchReport('/stockCardSummaries/print', {
    program: programId,
    facility: facilityId,
    showInDoses,
    lang,
  });
}
