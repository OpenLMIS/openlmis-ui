import type { QueryClient } from '@tanstack/react-query';
import type { AnyRouter } from '@tanstack/react-router';
import { permissionsOptions } from '@/features/auth/api/queries';
import { userRecordOptions } from '@/features/reference-data/api/queries';
import { requisitionReferences } from '@/features/reference-data/api/requisition-reference';
import { RIGHTS } from '@/lib/rights';
import { assertSessionScope, getSessionScope } from '@/lib/session-scope';

export async function preloadRequisitionReferences(client: QueryClient, userId: string) {
  const scope = getSessionScope();
  const [permissions, user] = await Promise.all([
    client.fetchQuery(permissionsOptions(userId)),
    client.fetchQuery(userRecordOptions(userId)),
  ]);
  assertSessionScope(scope);
  if (
    permissions.rights.has(RIGHTS.requisitionView) ||
    permissions.rights.has(RIGHTS.requisitionApprove) ||
    user.roleAssignments.some((assignment) => !!assignment.supervisoryNodeId)
  )
    await requisitionReferences(client, userId);
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
