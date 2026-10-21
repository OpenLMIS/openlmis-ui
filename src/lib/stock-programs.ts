import { type NamedRecord, recordLabel } from '@/lib/facility-program-selection';
import type { OfflineAccess } from '@/lib/offline-access';
import { hasProgramGrant, parsePermissions, programGrants } from '@/lib/permissions';
import { RIGHTS } from '@/lib/rights';

type HomeStockProgramSources = {
  homeFacility:
    | {
        id: string;
        supportedPrograms?: readonly { id: string }[];
      }
    | null
    | undefined;
  programs: readonly NamedRecord[];
  grants: readonly { facilityId: string; programId: string }[];
};

export function homeStockPrograms({ homeFacility, programs, grants }: HomeStockProgramSources) {
  if (!homeFacility) return [];
  const supported = new Set(homeFacility.supportedPrograms?.map((program) => program.id));
  const granted = new Set(
    grants.filter((grant) => grant.facilityId === homeFacility.id).map((grant) => grant.programId),
  );
  return programs
    .filter((program) => supported.has(program.id) && granted.has(program.id))
    .sort((a, b) => recordLabel(a).localeCompare(recordLabel(b)) || a.code.localeCompare(b.code));
}

export type HomeStockAccess = Pick<
  OfflineAccess,
  'homeFacility' | 'programs' | 'permissionStrings'
>;

export function homeStockScopes(access: HomeStockAccess) {
  const home = access.homeFacility;
  if (!home) return [];
  return homeStockPrograms({
    homeFacility: home,
    programs: access.programs,
    grants: programGrants(parsePermissions(access.permissionStrings), RIGHTS.stockCardsView),
  }).map((program) => ({
    id: program.id,
    name: recordLabel(program),
    key: [home.id, program.id],
    refreshKey: `${home.id}:${program.id}`,
    facilityId: home.id,
    programId: program.id,
    facilityTypeId: home.type.id,
  }));
}

export function isHomeStockScope(access: HomeStockAccess, facilityId: string, programId: string) {
  return homeStockScopes(access).some(
    (scope) => scope.facilityId === facilityId && scope.programId === programId,
  );
}

export function offlineEventScopes(access: HomeStockAccess, right: string) {
  const permissions = parsePermissions(access.permissionStrings);
  return homeStockScopes(access).filter((scope) =>
    hasProgramGrant(permissions, right, scope.facilityId, scope.programId),
  );
}
