import { createFileRoute } from '@tanstack/react-router';
import { MessageSquareTextIcon } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useColumnVisibility, useElementWidth } from '@/components/data-table/responsive-columns';
import { ListError } from '@/components/list-error';
import { QueryBoundary } from '@/components/query-boundary';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace';
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import { ReasonsTable, ReasonsTableSkeleton } from '@/features/reasons/components/reasons-table';
import { ReasonsToolbar } from '@/features/reasons/components/reasons-toolbar';
import {
  REASON_HIDEABLE_COLUMNS,
  type ReasonsSearch,
  reasonsSearchSchema,
} from '@/features/reasons/lib/search';
import { reasonsOptions } from '@/features/reference-data/api/queries';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { useStoredState } from '@/hooks/use-stored-state';

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: extending the router's type needs interface merging.
  interface HistoryState {
    reasonsListSearch?: ReasonsSearch;
  }
}

// Legacy reloads the list on every visit; another admin may have changed a reason since.
const LIST_FRESH_FOR = 30 * 1000;

export const Route = createFileRoute('/(protected)/_protected/administration/reasons')({
  validateSearch: reasonsSearchSchema,
  loader: async ({ context: { queryClient } }) => {
    await requireRight(queryClient, RIGHTS.stockCardLineItemReasonsManage);
    queryClient.prefetchQuery({ ...reasonsOptions(), staleTime: LIST_FRESH_FOR });
  },
  pendingComponent: ReasonsPagePending,
  component: ReasonsPage,
});

const columnChoicesSchema = z.record(z.string(), z.boolean());

function ReasonsPage() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [measureContent, contentWidth] = useElementWidth<HTMLDivElement>();
  const columnView = useColumnVisibility(
    REASON_HIDEABLE_COLUMNS,
    useStoredState('reasons.column-visibility', columnChoicesSchema, {}),
    contentWidth,
  );
  const { updateSearch } = useSearchNavigation<ReasonsSearch>({});
  const addReason = useCallback(
    () => navigate({ to: '/administration/reasons/new', state: { reasonsListSearch: search } }),
    [navigate, search],
  );

  return (
    <Workspace>
      <ReasonsHeader />
      <WorkspaceContent>
        {/* Measured, because the room for columns depends on the sidebar as well as the window. */}
        <div className="flex flex-col gap-4 lg:gap-6" ref={measureContent}>
          <ReasonsToolbar
            columnView={columnView}
            onAdd={addReason}
            onFilterChange={(patch) => updateSearch(patch, true)}
            search={search}
          />
          <QueryBoundary
            errorComponent={({ error, reset }) => (
              <ListError
                description={t('reasons.error-description')}
                error={error}
                reset={reset}
                title={t('reasons.error-title')}
              />
            )}
            pendingFallback={
              <ReasonsTableSkeleton columnVisibility={columnView.visibility} search={search} />
            }
            resetKey="reasons"
          >
            <ReasonsTable
              columnVisibility={columnView.visibility}
              onSearchChange={updateSearch}
              search={search}
            />
          </QueryBoundary>
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}

function ReasonsHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <MessageSquareTextIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('reasons.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('reasons.page-description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

/** While the rights check runs on a first visit: the page's header over a table skeleton. */
function ReasonsPagePending() {
  return (
    <Workspace>
      <ReasonsHeader />
      <WorkspaceContent>
        <ReasonsTableSkeleton columnVisibility={{}} search={{}} />
      </WorkspaceContent>
    </Workspace>
  );
}
