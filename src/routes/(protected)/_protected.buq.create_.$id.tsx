import {
  createFileRoute,
  type ErrorComponentProps,
  Link,
  notFound,
  useLocation,
} from '@tanstack/react-router';
import { ArrowLeftIcon, FilePenLineIcon, SearchXIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { ErrorFallback } from '@/components/app-shell/error-fallback';
import { LoadError } from '@/components/app-shell/load-error';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace/workspace';
import { RIGHTS } from '@/features/auth/lib/rights';
import {
  buqForecastOptions,
  buqRemarksOptions,
  buqSourcesOfFundsOptions,
} from '@/features/buq/api/queries';
import { BuqUnavailable } from '@/features/buq/components/buq-unavailable';
import { ForecastEditor } from '@/features/buq/components/forecast-editor';
import {
  FORECAST_DIALOGS,
  type ForecastSearch,
  forecastSearchSchema,
} from '@/features/buq/lib/search';
import {
  currencySettingsOptions,
  facilityOptions,
  orderablesByIdsOptions,
} from '@/features/reference-data/api/queries';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { isNotFound } from '@/lib/http';
import { loadBuqAccess, useForecastRights } from '@/routes/-buq-access';

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
    try {
      const forecast = await queryClient.fetchQuery({
        ...buqForecastOptions(params.id),
        staleTime: 0,
      });
      if (forecast.facilityId !== access.facility.id || forecast.programId !== access.program.id) {
        throw notFound();
      }
      queryClient.prefetchQuery(
        orderablesByIdsOptions(
          forecast.bottomUpQuantificationLineItems.map(({ orderableId }) => orderableId),
        ),
      );
      queryClient.prefetchQuery(facilityOptions(forecast.facilityId));
      queryClient.prefetchQuery(buqRemarksOptions());
      queryClient.prefetchQuery(buqSourcesOfFundsOptions());
      queryClient.prefetchQuery(currencySettingsOptions());
      return access;
    } catch (error) {
      if (isNotFound(error)) throw notFound();
      throw error;
    }
  },
  pendingComponent: ForecastPending,
  errorComponent: ForecastError,
  notFoundComponent: ForecastNotFound,
  component: ForecastPage,
});

function ForecastHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <FilePenLineIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('buq.forecast.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('buq.forecast.description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

function ForecastSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-4 @4xl/main:gap-6">
      <div className="h-6 w-24">
        <Skeleton fill />
      </div>
      <div className="grid gap-4 @3xl/main:grid-cols-2">
        <div className="h-28">
          <Skeleton fill />
        </div>
        <div className="h-28">
          <Skeleton fill />
        </div>
      </div>
      <div className="h-96">
        <Skeleton fill />
      </div>
    </div>
  );
}

function useListSearch() {
  const current = useLocation({ select: (location) => location.state.buqListSearch });
  const [listSearch] = useState(current);
  return listSearch ?? {};
}

function BackToList() {
  const { t } = useTranslation();
  const listSearch = useListSearch();
  return (
    <Button
      nativeButton={false}
      render={<Link search={listSearch} to="/buq/create" />}
      size="lg"
      variant="outline"
    >
      <ArrowLeftIcon className="rtl:rotate-180" data-icon="inline-start" />
      {t('buq.forecast.back')}
    </Button>
  );
}

function ForecastPage() {
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
        <ForecastHeader />
        <WorkspaceContent>
          <BuqUnavailable kind={access.kind} title={t('buq.create.unavailable-title')} />
        </WorkspaceContent>
      </Workspace>
    );
  }
  return (
    <QueryBoundary
      errorComponent={({ error, reset }) => (
        <Workspace width="wide">
          <ForecastHeader />
          <WorkspaceContent>
            <LoadError
              description={t('buq.forecast.load-error')}
              error={error}
              reset={reset}
              title={t('buq.forecast.load-error-title')}
            />
          </WorkspaceContent>
        </Workspace>
      )}
      pendingFallback={<ForecastPending />}
      resetKey={id}
    >
      <ForecastEditor
        forecastId={id}
        header={<ForecastHeader />}
        onCloseDialog={closeDialog}
        onDone={() => void navigate({ to: '/buq/create', search: listSearch })}
        onOpenDialog={(dialog) => openDialog({ dialog })}
        onSearchChange={updateSearch}
        rights={rights}
        search={search}
        skipAuthorization={access.skipAuthorization}
      />
    </QueryBoundary>
  );
}

function ForecastPending() {
  return (
    <Workspace width="wide">
      <ForecastHeader />
      <WorkspaceContent>
        <ForecastSkeleton />
      </WorkspaceContent>
    </Workspace>
  );
}

function ForecastNotFound() {
  const { t } = useTranslation();
  return (
    <Workspace>
      <ForecastHeader />
      <WorkspaceContent>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>{t('buq.forecast.not-found-title')}</EmptyTitle>
            <EmptyDescription>{t('buq.forecast.not-found-description')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <BackToList />
          </EmptyContent>
        </Empty>
      </WorkspaceContent>
    </Workspace>
  );
}

function ForecastError(props: ErrorComponentProps) {
  const { t } = useTranslation();
  return (
    <ErrorFallback
      {...props}
      back={<BackToList />}
      description={t('buq.forecast.load-error')}
      title={t('buq.forecast.load-error-title')}
    />
  );
}
