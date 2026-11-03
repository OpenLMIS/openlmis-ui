import { hasProgramGrant, type Permissions, programGrants } from '@/lib/permissions';
import { RIGHTS } from '@/lib/rights';

export function editableGrants(permissions: Permissions) {
  return programGrants(permissions, RIGHTS.cceInventoryEdit).filter((grant) =>
    hasProgramGrant(permissions, RIGHTS.cceInventoryView, grant.facilityId, grant.programId),
  );
}
