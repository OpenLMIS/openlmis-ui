import type { QueryClient } from '@tanstack/react-query';
import { permissionsOptions } from '@/features/auth/api/queries';
import { useLoginData } from '@/features/auth/store/login-data';
import { isRefused } from '@/lib/http';
import { type Permissions, parsePermissions } from '@/lib/permissions';
import { getSessionScope } from '@/lib/session-scope';

/** Thrown by a route whose user lacks every right that opens the page. */
export class ForbiddenError extends Error {
  constructor(rights: string | readonly string[]) {
    super(`Missing right ${[rights].flat().join(' or ')}`);
    this.name = 'ForbiddenError';
  }
}

/** A missing right, found by the page up front or refused by the server. */
export function isForbidden(error: unknown) {
  return error instanceof ForbiddenError || isRefused(error);
}

/** For a loader: resolves with the signed-in user's permissions once they include `right`, or one of a list, throws otherwise. */
export async function requirePermissions(
  queryClient: QueryClient,
  right: string | readonly string[],
): Promise<Permissions> {
  while (true) {
    const scope = getSessionScope();
    const userId = useLoginData.getState().referenceDataUserId;
    let permissions: Permissions;
    try {
      permissions = userId
        ? await queryClient.fetchQuery(permissionsOptions(userId))
        : parsePermissions([]);
    } catch (error) {
      if (scope !== getSessionScope()) continue;
      throw error;
    }
    if (scope !== getSessionScope()) continue;
    if (![right].flat().some((name) => permissions.rights.has(name))) {
      throw new ForbiddenError(right);
    }
    return permissions;
  }
}

export async function requireRight(queryClient: QueryClient, right: string | readonly string[]) {
  return (await requirePermissions(queryClient, right)).rights;
}
