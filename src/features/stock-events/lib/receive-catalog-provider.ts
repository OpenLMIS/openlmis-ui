import { EVENT_KINDS } from '@/features/stock-events/lib/event-kinds';
import {
  fetchReceiveCatalog,
  RECEIVE_CATALOG_FORMAT,
  type ReceiveCatalog,
  type ReceiveCatalogScope,
} from '@/features/stock-events/lib/receive-catalog';
import { LOCAL_TABLES } from '@/integrations/local-db';
import {
  type DownloadAcceptance,
  type DownloadScope,
  defineDownloadProvider,
} from '@/lib/download-provider';
import { getFlag } from '@/lib/feature-flags';
import type { OfflineAccess } from '@/lib/offline-access';
import { parsePermissions, programGrants } from '@/lib/permissions';
import { homeStockScopes } from '@/lib/stock-programs';

export const acceptsReceiveCatalog: DownloadAcceptance<
  ReceiveCatalog,
  DownloadScope & ReceiveCatalogScope
> = (record, _access, scope) =>
  record.facilityId === scope.facilityId &&
  record.programId === scope.programId &&
  record.facilityTypeId === scope.facilityTypeId &&
  record.formatVersion === RECEIVE_CATALOG_FORMAT &&
  Array.isArray(record.approved) &&
  Array.isArray(record.products) &&
  Array.isArray(record.lots) &&
  Array.isArray(record.tradeItems) &&
  !!record.fulfils &&
  typeof record.fulfils === 'object' &&
  !Array.isArray(record.fulfils);

export function receiveCatalogScopes(
  access: OfflineAccess,
): (DownloadScope & ReceiveCatalogScope)[] {
  const grants = programGrants(
    parsePermissions(access.permissionStrings),
    EVENT_KINDS.receive.right,
  );
  return homeStockScopes(access).flatMap((scope) => {
    const programCode = access.programs.find((program) => program.id === scope.programId)?.code;
    return programCode &&
      grants.some(
        (grant) => grant.facilityId === scope.facilityId && grant.programId === scope.programId,
      )
      ? [
          {
            ...scope,
            programCode,
            refreshKey: `receive-catalog:${scope.facilityId}:${scope.programId}`,
            scanning: getFlag('GS1_SCANNING'),
          },
        ]
      : [];
  });
}

export function receiveCatalogProvider(fetch = fetchReceiveCatalog) {
  return defineDownloadProvider<DownloadScope & ReceiveCatalogScope, ReceiveCatalog>({
    id: 'receive-catalog',
    label: 'offline.download.receive-catalog',
    table: LOCAL_TABLES.receiveCatalogDownloads,
    refreshOn: ['sign-in'],
    scopes: receiveCatalogScopes,
    fetch,
    accepts: acceptsReceiveCatalog,
    isFresh: (record, access, scope) =>
      !!record &&
      !record.stale &&
      record.userId === access.userId &&
      acceptsReceiveCatalog(record, access, scope) &&
      (!scope.scanning || record.scanning),
  });
}
