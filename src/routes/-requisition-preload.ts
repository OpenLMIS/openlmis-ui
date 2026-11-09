import type { FetchQueryOptions, QueryClient, QueryKey } from '@tanstack/react-query';
import type { AnyRouter } from '@tanstack/react-router';
import { permissionsOptions } from '@/features/auth/api/queries';
import {
  minimalFacilitiesOptions,
  programsOptions,
  rolesOptions,
  userProgramsOptions,
  userRecordOptions,
} from '@/features/reference-data/api/queries';
import { RIGHTS } from '@/lib/rights';
import { assertSessionScope, getSessionScope, getSessionUserId } from '@/lib/session-scope';
import { supervisoryNodesWithRight } from '@/lib/supervisory-nodes';

function sessionFetch(client: QueryClient, userId: string) {
  const scope = getSessionScope();
  return <T, K extends QueryKey>(options: FetchQueryOptions<T, Error, T, K>) => {
    assertSessionScope(scope);
    if (getSessionUserId() !== userId) return Promise.resolve(undefined);
    const queryFn = options.queryFn;
    return client.fetchQuery({
      ...options,
      queryFn: async (context) => {
        assertSessionScope(scope);
        if (typeof queryFn !== 'function') throw new Error('Missing reference reader');
        const result = await queryFn(context);
        assertSessionScope(scope);
        return result;
      },
    });
  };
}

export async function preloadRequisitionReferences(client: QueryClient, userId: string) {
  const scope = getSessionScope();
  if (!(await hasRequisitionReferences(client, userId))) return false;
  assertSessionScope(scope);
  const fetch = sessionFetch(client, userId);
  await Promise.all([
    fetch(minimalFacilitiesOptions()),
    fetch(programsOptions()),
    fetch(rolesOptions()),
    fetch(userProgramsOptions(userId)),
    fetch(userRecordOptions(userId)),
  ]);
  assertSessionScope(scope);
  return true;
}

export async function hasRequisitionReferences(client: QueryClient, userId: string) {
  const scope = getSessionScope();
  const fetch = sessionFetch(client, userId);
  const permissions = await fetch(permissionsOptions(userId));
  assertSessionScope(scope);
  if (!permissions) return false;
  if (
    permissions.rights.has(RIGHTS.requisitionView) ||
    permissions.rights.has(RIGHTS.requisitionApprove) ||
    permissions.rights.has(RIGHTS.orderCreate)
  )
    return true;
  const config = { connectionStatus: false };
  const user = await fetch(userRecordOptions(userId, config));
  assertSessionScope(scope);
  if (!user?.roleAssignments.some((assignment) => !!assignment.supervisoryNodeId)) return false;
  const roles = await fetch(rolesOptions(config));
  assertSessionScope(scope);
  return !!roles && supervisoryNodesWithRight(user, roles, RIGHTS.requisitionView).length > 0;
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
