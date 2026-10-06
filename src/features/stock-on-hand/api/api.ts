import { isAxiosError } from 'axios';
import type { StockCardSummariesQuery, StockCardSummary } from '@/features/stock-on-hand/lib/types';
import { client } from '@/integrations/axios';
import type { Page } from '@/lib/types';

export async function fetchStockCardSummaries(query: StockCardSummariesQuery) {
  const { data } = await client.get<Page<StockCardSummary>>('/v2/stockCardSummaries', {
    params: query,
  });
  return data;
}

type ReportParams = { programId: string; facilityId: string; showInDoses: boolean; lang: string };

/** The facility and program's whole stock on hand as a PDF, read with the session's token rather than one in the address. */
export async function fetchStockOnHandReport({
  programId,
  facilityId,
  showInDoses,
  lang,
}: ReportParams) {
  try {
    const { data } = await client.get<Blob>('/stockCardSummaries/print', {
      params: { program: programId, facility: facilityId, showInDoses, lang },
      responseType: 'blob',
    });
    return data;
  } catch (error) {
    // An error asked for as a file arrives as one; its JSON carries the message.
    if (isAxiosError(error) && error.response?.data instanceof Blob) {
      try {
        error.response.data = JSON.parse(await error.response.data.text());
      } catch {
        error.response.data = undefined;
      }
    }
    throw error;
  }
}
