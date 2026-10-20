import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { z } from 'zod';
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
import { rolesSearchSchema } from '@/features/users/lib/roles-search';
import { useSearchNavigation } from '@/hooks/use-search-navigation';

// The profile's own dialog param stays with the layout; roles are only shown here.
const profileRolesSearchSchema = rolesSearchSchema.omit({ dialog: true });

type ProfileRolesSearch = z.infer<typeof profileRolesSearchSchema>;

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

function RoleAssignmentsPage() {
  const userId = useLoginData((state) => state.referenceDataUserId);
  return userId ? <RoleAssignmentsTab userId={userId} /> : null;
}

function RoleAssignmentsTab({ userId }: { userId: string }) {
  const search = Route.useSearch();
  const { data: profile } = useSuspenseQuery(profileOptions(userId));
  const { user } = profile;
  const tab = ROLE_TABS.find((item) => item.id === (search.tab ?? 'supervision')) ?? ROLE_TABS[0];

  const { updateSearch } = useSearchNavigation<ProfileRolesSearch>({});

  return (
    <div>
      <RoleTabs
        draft={user.roleAssignments}
        homeFacilityId={user.homeFacilityId}
        onSearchChange={updateSearch}
        saved={user.roleAssignments}
        search={search}
        tab={tab}
      />
    </div>
  );
}
