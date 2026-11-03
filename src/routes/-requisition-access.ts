import type { QueryClient } from '@tanstack/react-query';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { permissionsOptions } from '@/features/auth/api/queries';
import { ForbiddenError } from '@/features/auth/lib/access';
import {
  requireRequisitionView,
  supervisoryNodesWithRight,
} from '@/features/auth/lib/requisition-access';
import { fetchUserRecord } from '@/features/reference-data/api/api';
import {
  requisitionGroupOptions,
  rolesOptions,
  supervisoryNodesByIdsOptions,
  userRecordOptions,
} from '@/features/reference-data/api/queries';
import { prepareRequisitionAccess } from '@/features/requisitions/lib/offline-access';
import { onlineOrDevice, requireOnline } from '@/lib/local-data';
import { parsePermissions } from '@/lib/permissions';
import { RIGHTS } from '@/lib/rights';
import {
  assertSessionScope,
  getSessionScope,
  getSessionUserId,
  SessionEndedError,
} from '@/lib/session-scope';

export async function requireRequisitionViewWithDevice(client: QueryClient) {
  await prepareRequisitionAccess(client);
  return onlineOrDevice(
    () => requireRequisitionView(client),
    async () => {
      await prepareRequisitionAccess(client, true);
      return requireRequisitionView(client);
    },
  );
}
export async function freshRequisitionAccess(client: QueryClient) {
  const scope = getSessionScope();
  requireOnline();
  const id = getSessionUserId();
  if (!id) throw new SessionEndedError();
  const [permissions, user, roles] = await Promise.all([
    client.fetchQuery({
      ...permissionsOptions(id),
      queryFn: async () => parsePermissions(await fetchPermissionStrings(id)),
      staleTime: 0,
    }),
    client.fetchQuery({
      ...userRecordOptions(id),
      queryFn: () => fetchUserRecord(id),
      staleTime: 0,
    }),
    client.fetchQuery({ ...rolesOptions(), staleTime: 0 }),
  ]);
  assertSessionScope(scope);
  requireOnline();
  return { permissions, user, roles };
}
export async function currentApprovalNodes(
  client: QueryClient,
  access: Awaited<ReturnType<typeof freshRequisitionAccess>>,
  record: { facility: { id: string }; program: { id: string }; supervisoryNode?: string | null },
) {
  const scope = getSessionScope();
  const ids = supervisoryNodesWithRight(
    access.user,
    access.roles,
    RIGHTS.requisitionApprove,
    record.program.id,
  );
  if (record.supervisoryNode) return ids.filter((id) => id === record.supervisoryNode);
  const nodes = await client.fetchQuery({ ...supervisoryNodesByIdsOptions(ids), staleTime: 0 });
  assertSessionScope(scope);
  const groups = await Promise.all(
    nodes.flatMap((node) =>
      node.requisitionGroup
        ? [
            client.fetchQuery({
              ...requisitionGroupOptions(node.requisitionGroup.id),
              staleTime: 0,
            }),
          ]
        : [],
    ),
  );
  assertSessionScope(scope);
  requireOnline();
  return nodes
    .filter((node) =>
      groups.some(
        (group) =>
          group.id === node.requisitionGroup?.id &&
          group.memberFacilities.some((facility) => facility.id === record.facility.id),
      ),
    )
    .map((node) => node.id);
}
export function requireApprovalNode(nodes: readonly string[]) {
  if (!nodes.length) throw new ForbiddenError(RIGHTS.requisitionApprove);
}
