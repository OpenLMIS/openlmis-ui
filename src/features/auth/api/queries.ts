import { queryOptions } from '@tanstack/react-query';
import { fetchPermissionStrings } from '@/features/auth/api/api';
import { userRightsKey } from '@/lib/key-factory';
import { offlineAccessQuery, withOfflineAccess } from '@/lib/offline-access';
import { parsePermissions } from '@/lib/permissions';

/** The signed-in user's permission strings, parsed once for both right names and facility and program grants. */
export const permissionsOptions = (userId: string) =>
  queryOptions({
    queryKey: userRightsKey(userId),
    // No one holds no rights; a page rendering while signing out must not ask for `/users//...`.
    queryFn: () =>
      userId
        ? withOfflineAccess(
            async () => parsePermissions(await fetchPermissionStrings(userId)),
            (saved) =>
              saved.userId === userId ? parsePermissions(saved.permissionStrings) : undefined,
          )
        : Promise.resolve(parsePermissions([])),
    ...offlineAccessQuery(30 * 60 * 1000),
    gcTime: Number.POSITIVE_INFINITY,
  });

/** The right names alone, for a component; `fetchQuery` and `ensureQueryData` skip `select`, so loaders read `permissionsOptions`. */
export const rightsOptions = (userId: string) =>
  queryOptions({ ...permissionsOptions(userId), select: (permissions) => permissions.rights });
