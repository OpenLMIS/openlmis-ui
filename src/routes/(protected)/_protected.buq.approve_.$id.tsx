import { createFileRoute, type ErrorComponentProps, notFound } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Workspace, WorkspaceContent } from '@/components/workspace/workspace';
import { buqsForApprovalOptions } from '@/features/buq/api/queries';
import { BuqUnavailable } from '@/features/buq/components/buq-unavailable';
import { ForecastEditor } from '@/features/buq/components/forecast-editor';
import {
  ForecastBoundary,
  ForecastError,
  ForecastHeader,
  ForecastNotFound,
  ForecastPending,
  useListSearch,
} from '@/features/buq/components/forecast-page';
import {
  FORECAST_DIALOGS,
  type ForecastSearch,
  forecastSearchSchema,
} from '@/features/buq/lib/search';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { loadApproveAccess, loadForecast } from '@/routes/-buq-access';

export const Route = createFileRoute('/(protected)/_protected/buq/approve_/$id')({
  staticData: { crumbKey: 'buq.approve.crumb' },
  preload: false,
  shouldReload: ({ cause }) => cause === 'enter',
  validateSearch: forecastSearchSchema,
  loader: async ({ context: { queryClient }, params, cause }) => {
    if (!z.guid().safeParse(params.id).success) throw notFound();
    const access = await loadApproveAccess(queryClient, cause);
    if (access.kind !== 'ready') return access;
    const [waiting] = await Promise.all([
      queryClient.fetchQuery({ ...buqsForApprovalOptions(access.programId), staleTime: 0 }),
      loadForecast(queryClient, params.id, cause),
    ]);
    if (!waiting.some(({ id }) => id === params.id)) throw notFound();
    return access;
  },
  pendingComponent: ApprovePending,
  errorComponent: ApproveError,
  notFoundComponent: ApproveNotFound,
  component: ApproveForecastPage,
});

function ApproveHeader() {
  const { t } = useTranslation();
  return <ForecastHeader description={t('buq.approve.forecast-description')} />;
}

function ApproveForecastPage() {
  const { t } = useTranslation();
  const access = Route.useLoaderData();
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const listSearch = useListSearch();
  const { updateSearch, openDialog, closeDialog } =
    useSearchNavigation<ForecastSearch>(FORECAST_DIALOGS);
  if (access.kind !== 'ready') {
    return (
      <Workspace>
        <ApproveHeader />
        <WorkspaceContent>
          <BuqUnavailable kind={access.kind} title={t('buq.approve.unavailable-title')} />
        </WorkspaceContent>
      </Workspace>
    );
  }
  return (
    <ForecastBoundary header={<ApproveHeader />} id={id}>
      <ForecastEditor
        forecastId={id}
        header={<ApproveHeader />}
        mode={{ kind: 'approve', programId: access.programId }}
        onCloseDialog={closeDialog}
        onDone={() => void navigate({ to: '/buq/approve', search: listSearch })}
        onOpenDialog={(dialog) => openDialog({ dialog })}
        onSearchChange={updateSearch}
        search={search}
      />
    </ForecastBoundary>
  );
}

function ApprovePending() {
  return <ForecastPending header={<ApproveHeader />} />;
}

function ApproveNotFound() {
  const { t } = useTranslation();
  return (
    <ForecastNotFound
      description={t('buq.approve.not-found-description')}
      header={<ApproveHeader />}
      list="/buq/approve"
    />
  );
}

function ApproveError(props: ErrorComponentProps) {
  return <ForecastError {...props} list="/buq/approve" />;
}
