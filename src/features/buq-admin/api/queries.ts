import { type QueryClient, queryOptions } from '@tanstack/react-query';
import { fetchCatalogRecord } from '@/features/buq-admin/api/api';
import { BUQ_CATALOGS, type BuqCatalogTab } from '@/features/buq-admin/lib/types';
import { buqRemarksOptions, buqSourcesOfFundsOptions } from '@/features/reference-data/api/queries';
import { queryKeys } from '@/lib/key-factory';

export const buqCatalogOptions = (tab: BuqCatalogTab) =>
  tab === 'remarks' ? buqRemarksOptions() : buqSourcesOfFundsOptions();

export const buqCatalogDetailOptions = (
  tab: BuqCatalogTab,
  id: string,
  opening: number,
  reread = false,
) =>
  queryOptions({
    queryKey: [...queryKeys.buq.all, BUQ_CATALOGS[tab].kind, id, opening, reread] as const,
    queryFn: ({ signal }) => fetchCatalogRecord(tab, id, signal),
  });

export async function refreshBuqCatalog(
  client: QueryClient,
  tab: BuqCatalogTab,
  isCurrent: () => boolean,
) {
  const { queryKey } = buqCatalogOptions(tab);
  await client.cancelQueries({ queryKey });
  if (!isCurrent()) return;
  await client.invalidateQueries({ queryKey });
}
