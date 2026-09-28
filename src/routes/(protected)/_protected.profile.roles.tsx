import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useCallback } from 'react';
import { useElementWidth } from '@/components/data-table/responsive-columns';
import { RoleRightsDialog } from '@/components/role-rights-dialog';
import { useLoginData } from '@/features/auth/store/login-data';
import { profileOptions } from '@/features/profile/api/queries';
import {
  minimalFacilitiesOptions,
  programsOptions,
  rolesOptions,
  supervisoryNodesOptions,
} from '@/features/reference-data/api/queries';
import { RoleTabs } from '@/features/users/components/role-tabs';
import { ROLE_TABS } from '@/features/users/lib/role-assignments';
import { type RolesTableSearch, rolesSearchSchema } from '@/features/users/lib/roles-search';
import type { SearchChange } from '@/lib/table-search';

// The profile's own dialog param stays with the layout; roles are only shown here.
const profileRolesSearchSchema = rolesSearchSchema.omit({ dialog: true });

export const Route = createFileRoute('/(protected)/_protected/profile/roles')({
  validateSearch: profileRolesSearchSchema,
  staticData: { crumbKey: 'profile.title' },
  loader: ({ context: { queryClient } }) => {
    queryClient.prefetchQuery(rolesOptions());
    queryClient.prefetchQuery(programsOptions());
    // Slow, so they start now and fill in the rows when they arrive.
    queryClient.prefetchQuery(supervisoryNodesOptions());
    queryClient.prefetchQuery(minimalFacilitiesOptions());
  },
  component: RoleAssignmentsPage,
});

/** Too narrow for a column per name, so each row lists them under the role. */
const COMPACT_BELOW = 576;

function RoleAssignmentsPage() {
  const userId = useLoginData((state) => state.referenceDataUserId);
  return userId ? <RoleAssignmentsTab userId={userId} /> : null;
}

function RoleAssignmentsTab({ userId }: { userId: string }) {
  const router = useRouter();
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const { data: profile } = useSuspenseQuery(profileOptions(userId));
  const { user } = profile;
  const tab = ROLE_TABS.find((item) => item.id === (search.tab ?? 'supervision')) ?? ROLE_TABS[0];
  const [measureContent, contentWidth] = useElementWidth<HTMLDivElement>();

  const updateSearch = useCallback(
    (update: Parameters<SearchChange<RolesTableSearch>>[0], replace = false) =>
      navigate({
        search: (previous) => ({
          ...previous,
          ...(typeof update === 'function' ? update(previous) : update),
        }),
        replace,
      }),
    [navigate],
  );
  const viewRights = useCallback(
    (roleId: string) =>
      navigate({
        search: (previous) => ({ ...previous, rights: roleId }),
        state: (previous) => ({ ...previous, dialogOpenedHere: true }),
      }),
    [navigate],
  );
  const closeRights = () => {
    if (router.state.location.state.dialogOpenedHere) router.history.back();
    else
      void navigate({ search: (previous) => ({ ...previous, rights: undefined }), replace: true });
  };

  return (
    <>
      <div ref={measureContent}>
        <RoleTabs
          compact={contentWidth !== undefined && contentWidth < COMPACT_BELOW}
          draft={user.roleAssignments}
          homeFacilityId={user.homeFacilityId}
          onSearchChange={updateSearch}
          onViewRights={viewRights}
          saved={user.roleAssignments}
          search={search}
          tab={tab}
        />
      </div>
      <RoleRightsDialog onClose={closeRights} roleId={search.rights} />
    </>
  );
}
