import { downloadIsStale } from '@/features/stock-events/lib/download-read';
import {
  fetchHomeStockBundle,
  type HomeStockBundle,
  type HomeStockScope,
} from '@/features/stock-events/lib/home-stock-bundle';
import { type DownloadScope, defineDownloadProvider } from '@/lib/download-provider';
import { getFlag } from '@/lib/feature-flags';
import { parsePermissions, programGrants } from '@/lib/permissions';
import { homeStockPrograms } from '@/lib/stock-programs';

export function homeStockProvider(fetch = fetchHomeStockBundle) {
  return defineDownloadProvider<DownloadScope & HomeStockScope, HomeStockBundle>({
    id: 'home-stock',
    label: 'offline.download.home-stock',
    table: 'homeStockDownloads',
    scopes(access) {
      const home = access.homeFacility;
      if (!home) return [];
      const permissions = parsePermissions(access.permissionStrings);
      const programs = homeStockPrograms({
        homeFacility: home,
        programs: access.programs,
        grants: programGrants(permissions, 'STOCK_CARDS_VIEW'),
      });
      return programs.map((program) => ({
        id: program.id,
        name: program.name ?? program.code,
        key: [home.id, program.id],
        refreshKey: `${home.id}:${program.id}`,
        facilityId: home.id,
        programId: program.id,
        facilityTypeId: home.type.id,
        scanning: getFlag('GS1_SCANNING'),
      }));
    },
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
      record?.formatVersion === 5 &&
      Array.isArray(record.summaries) &&
      Array.isArray(record.products) &&
      record.userId === access.userId &&
      record.facilityTypeId === scope.facilityTypeId &&
      (!scope.scanning || record.scanning),
    accepts: (record, _access, scope) =>
      record.facilityId === scope.facilityId &&
      record.programId === scope.programId &&
      record.facilityTypeId === scope.facilityTypeId &&
      record.formatVersion === 5 &&
      Array.isArray(record.summaries) &&
      Array.isArray(record.products),
  });
}
