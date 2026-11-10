import { createFileRoute, type ErrorComponentProps, notFound } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Workspace, WorkspaceContent } from '@/components/workspace/workspace';
import { RIGHTS } from '@/features/auth/lib/rights';
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
import { loadBuqAccess, loadForecast, useForecastRights } from '@/routes/-buq-access';

const FORECASTING_RIGHTS = [RIGHTS.createForecasting, RIGHTS.authorizeForecasting];

export const Route = createFileRoute('/(protected)/_protected/buq/create_/$id')({
  staticData: { crumbKey: 'buq.forecast.crumb' },
  preload: false,
  shouldReload: ({ cause }) => cause === 'enter',
  validateSearch: forecastSearchSchema,
  loader: async ({ context: { queryClient }, params, cause }) => {
    if (!z.guid().safeParse(params.id).success) throw notFound();
    const access = await loadBuqAccess(queryClient, FORECASTING_RIGHTS, cause, {
      activeSupport: false,
    });
    if (access.kind !== 'ready') return access;
    const forecast = await loadForecast(queryClient, params.id, cause);
    if (forecast.facilityId !== access.facility.id || forecast.programId !== access.program.id) {
      throw notFound();
    }
    return access;
  },
  pendingComponent: CreatePending,
  errorComponent: CreateError,
  notFoundComponent: CreateNotFound,
  component: CreateForecastPage,
});

function CreateHeader() {
  const { t } = useTranslation();
  return <ForecastHeader description={t('buq.forecast.description')} />;
}

function CreateForecastPage() {
  const { t } = useTranslation();
  const access = Route.useLoaderData();
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const listSearch = useListSearch();
  const { updateSearch, openDialog, closeDialog } =
    useSearchNavigation<ForecastSearch>(FORECAST_DIALOGS);
  const rights = useForecastRights(access);
  if (access.kind !== 'ready') {
    return (
      <Workspace>
        <CreateHeader />
        <WorkspaceContent>
          <BuqUnavailable kind={access.kind} title={t('buq.create.unavailable-title')} />
        </WorkspaceContent>
      </Workspace>
    );
  }
  return (
    <ForecastBoundary header={<CreateHeader />} id={id}>
      <ForecastEditor
        forecastId={id}
        header={<CreateHeader />}
        mode={{ kind: 'create', rights, skipAuthorization: access.skipAuthorization }}
        onCloseDialog={closeDialog}
        onDone={() => void navigate({ to: '/buq/create', search: listSearch })}
        onOpenDialog={(dialog) => openDialog({ dialog })}
        onSearchChange={updateSearch}
        search={search}
      />
    </ForecastBoundary>
  );
}

function CreatePending() {
  return <ForecastPending header={<CreateHeader />} />;
}

function CreateNotFound() {
  const { t } = useTranslation();
  return (
    <ForecastNotFound
      description={t('buq.forecast.not-found-description')}
      header={<CreateHeader />}
      list="/buq/create"
    />
  );
}

function CreateError(props: ErrorComponentProps) {
  return <ForecastError {...props} list="/buq/create" />;
}
