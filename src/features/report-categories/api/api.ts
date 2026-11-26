import type { ReportCategoriesQuery, ReportCategory } from '@/features/report-categories/lib/types';
import { client } from '@/integrations/axios';
import type { Page } from '@/lib/types';

const categoriesUrl = '/reports/reportCategories';

export async function fetchReportCategories(params: ReportCategoriesQuery, signal: AbortSignal) {
  const { data } = await client.get<Page<ReportCategory>>(categoriesUrl, { params, signal });
  return data;
}

export async function fetchReportCategory(id: string, signal: AbortSignal) {
  const { data } = await client.get<ReportCategory>(`${categoriesUrl}/${id}`, { signal });
  return data;
}

export async function createReportCategory(name: string) {
  const { data } = await client.post<ReportCategory>(categoriesUrl, { name });
  return data;
}

export async function updateReportCategory(id: string, name: string) {
  const { data } = await client.put<ReportCategory>(`${categoriesUrl}/${id}`, { id, name });
  return data;
}

export async function deleteReportCategory(id: string) {
  await client.delete(`${categoriesUrl}/${id}`);
}
