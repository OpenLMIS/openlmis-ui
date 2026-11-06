import { hasProgramGrant, type Permissions, programGrants } from '@/lib/permissions';
import { RIGHTS } from '@/lib/rights';

const viewableGrants = (permissions: Permissions, right: string) =>
  programGrants(permissions, right).filter((grant) =>
    hasProgramGrant(permissions, RIGHTS.cceInventoryView, grant.facilityId, grant.programId),
  );

export const editableGrants = (permissions: Permissions) =>
  viewableGrants(permissions, RIGHTS.cceInventoryEdit);

export const transferableGrants = (permissions: Permissions) =>
  viewableGrants(permissions, RIGHTS.cceInventoryTransfer);
