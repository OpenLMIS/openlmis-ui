import { createFileRoute, type ErrorComponentProps, notFound } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Workspace, WorkspaceContent } from '@/components/workspace/workspace';
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
import { loadNationalForecast } from '@/routes/-buq-access';

export const Route = createFileRoute('/(protected)/_protected/buq/national-approval_/$id')({
  staticData: { crumbKey: 'buq.approve.crumb' },
  preload: false,
  shouldReload: ({ cause }) => cause === 'enter',
  validateSearch: forecastSearchSchema,
  loader: ({ context: { queryClient }, params, cause }) => {
    if (!z.guid().safeParse(params.id).success) throw notFound();
    return loadNationalForecast(queryClient, params.id, cause);
  },
  pendingComponent: NationalPending,
  errorComponent: NationalError,
  notFoundComponent: NationalNotFound,
  component: NationalForecastPage,
});

function NationalHeader() {
  const { t } = useTranslation();
  return <ForecastHeader description={t('buq.national.forecast-description')} />;
}

function NationalForecastPage() {
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
        <NationalHeader />
        <WorkspaceContent>
          <BuqUnavailable kind={access.kind} title={t('buq.national.unavailable-title')} />
        </WorkspaceContent>
      </Workspace>
    );
  }
  return (
    <ForecastBoundary header={<NationalHeader />} id={id}>
      <ForecastEditor
        forecastId={id}
        header={<NationalHeader />}
        mode={{ kind: 'national', programId: access.programId, zoneIds: access.zoneIds }}
        onCloseDialog={closeDialog}
        onDone={() => void navigate({ to: '/buq/national-approval', search: listSearch })}
        onOpenDialog={(dialog) => openDialog({ dialog })}
        onSearchChange={updateSearch}
        search={search}
      />
    </ForecastBoundary>
  );
}

function NationalPending() {
  return <ForecastPending header={<NationalHeader />} />;
}

function NationalNotFound() {
  const { t } = useTranslation();
  return (
    <ForecastNotFound
      description={t('buq.national.not-found-description')}
      header={<NationalHeader />}
      list="/buq/national-approval"
    />
  );
}

function NationalError(props: ErrorComponentProps) {
  return <ForecastError {...props} list="/buq/national-approval" />;
}
