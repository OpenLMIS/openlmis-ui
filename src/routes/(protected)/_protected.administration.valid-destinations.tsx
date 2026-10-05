import { createFileRoute } from '@tanstack/react-router';
import { useCallback } from 'react';
import {
  AssignmentsPage,
  AssignmentsPagePending,
} from '@/components/valid-assignments/assignments-page';
import {
  type AssignmentsSearch,
  assignmentsSearchSchema,
  isHalfFiltered,
  toAssignmentsQuery,
} from '@/components/valid-assignments/search';
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import {
  facilityTypesOptions,
  geographicLevelsOptions,
  programsOptions,
} from '@/features/reference-data/api/queries';
import { VALID_DESTINATIONS_API } from '@/features/valid-destinations/api/queries';
import { useSearchNavigation } from '@/hooks/use-search-navigation';

const CLOSED_DIALOGS = { assignment: undefined } satisfies Partial<AssignmentsSearch>;

export const Route = createFileRoute('/(protected)/_protected/administration/valid-destinations')({
  validateSearch: assignmentsSearchSchema,
  loaderDeps: ({ search }) => ({ query: toAssignmentsQuery(search), half: isHalfFiltered(search) }),
  loader: async ({ context: { queryClient }, deps }) => {
    const rights = await requireRight(queryClient, RIGHTS.stockDestinationsManage);
    if (!deps.half) {
      queryClient.prefetchQuery(VALID_DESTINATIONS_API.listOptions(deps.query));
    }
    queryClient.prefetchQuery(programsOptions());
    queryClient.prefetchQuery(facilityTypesOptions());
    queryClient.prefetchQuery(geographicLevelsOptions());
    return { canPickOrganizations: rights.has(RIGHTS.stockOrganizationsManage) };
  },
  pendingComponent: () => <AssignmentsPagePending kind="destinations" />,
  component: ValidDestinationsPage,
});

function ValidDestinationsPage() {
  const { canPickOrganizations } = Route.useLoaderData();
  const search = Route.useSearch({
    select: ({ assignment: _assignment, ...list }): AssignmentsSearch => list,
    structuralSharing: true,
  });
  const adding = Route.useSearch({ select: (search) => search.assignment === 'new' });
  const { updateSearch, openDialog, closeDialog } =
    useSearchNavigation<AssignmentsSearch>(CLOSED_DIALOGS);
  const add = useCallback(() => openDialog({ assignment: 'new' }), [openDialog]);

  return (
    <AssignmentsPage
      adding={adding}
      api={VALID_DESTINATIONS_API}
      canPickOrganizations={canPickOrganizations}
      onAdd={add}
      onCloseAdd={closeDialog}
      onSearchChange={updateSearch}
      search={search}
    />
  );
}
