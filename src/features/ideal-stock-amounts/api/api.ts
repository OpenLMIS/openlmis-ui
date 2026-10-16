import {
  type IdealStockAmountsUploadResult,
  idealStockAmountsUploadResultSchema,
} from '@/features/ideal-stock-amounts/lib/types';
import { client } from '@/integrations/axios';
import { fetchReport } from '@/lib/fetch-report';

export function exportIdealStockAmounts() {
  return fetchReport('/idealStockAmounts', { format: 'csv' });
}

export async function uploadIdealStockAmounts(file: File): Promise<IdealStockAmountsUploadResult> {
  const body = new FormData();
  body.append('file', file, file.name.replace(/\.csv$/i, '.csv'));
  const { data } = await client.post<unknown>('/idealStockAmounts', body, {
    headers: { 'Content-Type': 'multipart/form-data' },
    params: { format: 'csv' },
    timeout: 300_000,
  });
  return idealStockAmountsUploadResultSchema.parse(data);
}
