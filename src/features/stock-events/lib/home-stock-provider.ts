import { downloadIsStale } from '@/features/stock-events/lib/download-read';
import {
  fetchHomeStockBundle,
  HOME_STOCK_FORMATS,
  type HomeStockBundle,
  type HomeStockFormat,
  type HomeStockScope,
} from '@/features/stock-events/lib/home-stock-bundle';
import { LOCAL_TABLES } from '@/integrations/local-db';
import {
  type DownloadAcceptance,
  type DownloadScope,
  defineDownloadProvider,
} from '@/lib/download-provider';
import { getFlag } from '@/lib/feature-flags';
import { homeStockScopes } from '@/lib/stock-programs';

const acceptsMinimum =
  (minimum: HomeStockFormat): DownloadAcceptance<HomeStockBundle, HomeStockScope> =>
  (record, _access, scope) =>
    record.facilityId === scope.facilityId &&
    record.programId === scope.programId &&
    record.facilityTypeId === scope.facilityTypeId &&
    HOME_STOCK_FORMATS.includes(record.formatVersion) &&
    record.formatVersion >= minimum &&
    (minimum < 5 || (Array.isArray(record.summaries) && Array.isArray(record.products))) &&
    (minimum < 6 || (Array.isArray(record.destinations) && Array.isArray(record.sources)));

export const HOME_STOCK_ACCEPTANCE: Record<
  HomeStockFormat,
  DownloadAcceptance<HomeStockBundle, HomeStockScope>
> = {
  4: acceptsMinimum(4),
  5: acceptsMinimum(5),
  6: acceptsMinimum(6),
};

export function homeStockProvider(fetch = fetchHomeStockBundle) {
  return defineDownloadProvider<DownloadScope & HomeStockScope, HomeStockBundle>({
    id: 'home-stock',
    refreshOn: ['sign-in', 'periodic', 'force', 'accepted'],
    label: 'offline.download.home-stock',
    table: LOCAL_TABLES.homeStockDownloads,
    scopes: (access) =>
      homeStockScopes(access).map((scope) => ({
        ...scope,
        scanning: getFlag('GS1_SCANNING'),
      })),
    fetch: (scope, signal) =>
      fetch(
        {
          facilityId: scope.facilityId,
          programId: scope.programId,
          facilityTypeId: scope.facilityTypeId,
          scanning: scope.scanning,
        },
        signal,
      ),
    isFresh: (record, access, scope) =>
      !downloadIsStale(record) &&
      !!record &&
      record.userId === access.userId &&
      HOME_STOCK_ACCEPTANCE[6](record, access, scope) &&
      (!scope.scanning || record.scanning),
    accepts: HOME_STOCK_ACCEPTANCE[6],
  });
}
