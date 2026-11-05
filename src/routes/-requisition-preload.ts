import type { QueryClient } from '@tanstack/react-query';
import type { AnyRouter } from '@tanstack/react-router';
import { permissionsOptions } from '@/features/auth/api/queries';
import { userRecordOptions } from '@/features/reference-data/api/queries';
import { requisitionReferences } from '@/features/reference-data/api/requisition-reference';
import { RIGHTS } from '@/lib/rights';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export async function preloadRequisitionReferences(client: QueryClient, userId: string) {
  const scope = getSessionScope();
  const permissions = await client.fetchQuery(permissionsOptions(userId));
  assertSessionScope(scope);
  if (
    !permissions.rights.has(RIGHTS.requisitionView) &&
    !permissions.rights.has(RIGHTS.requisitionApprove)
  ) {
    const user = await client.fetchQuery(userRecordOptions(userId));
    assertSessionScope(scope);
    if (!user.roleAssignments.some((assignment) => !!assignment.supervisoryNodeId)) return;
  }
  await requisitionReferences(client, userId);
}

export async function hasRequisitionReferences(client: QueryClient, userId: string) {
  const scope = getSessionScope();
  const permissions = await client.fetchQuery(permissionsOptions(userId));
  assertSessionScope(scope);
  if (
    permissions.rights.has(RIGHTS.requisitionView) ||
    permissions.rights.has(RIGHTS.requisitionApprove)
  )
    return true;
  const user = await client.fetchQuery(userRecordOptions(userId));
  assertSessionScope(scope);
  return user.roleAssignments.some((assignment) => !!assignment.supervisoryNodeId);
}

export function warmRequisitionChunks(router: AnyRouter) {
  const scope = getSessionScope();
  const load = () => {
    if (scope !== getSessionScope()) return;
    for (const route of Object.values(router.routesById)) {
      if (route.id.includes('/requisitions')) void router.loadRouteChunk(route)?.catch(() => {});
    }
  };
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(load);
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(load, 1000);
  return () => clearTimeout(id);
}
