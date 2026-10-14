import {
  createFileRoute,
  type ErrorComponentProps,
  Link,
  notFound,
  useRouter,
} from '@tanstack/react-router';
import { CalendarRangeIcon, SearchXIcon } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useColumnVisibility, useElementWidth } from '@/components/data-table/responsive-columns';
import { ErrorFallback } from '@/components/error-fallback';
import { ListError } from '@/components/list-error';
import { QueryBoundary } from '@/components/query-boundary';
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
} from '@/components/workspace';
import { requireRight } from '@/features/auth/lib/access';
import { RIGHTS } from '@/features/auth/lib/rights';
import {
  periodsListOptions,
  scheduleDetailOptions,
} from '@/features/processing-schedules/api/queries';
import {
  PeriodsTable,
  PeriodsTableSkeleton,
} from '@/features/processing-schedules/components/periods-table';
import { PeriodsToolbar } from '@/features/processing-schedules/components/periods-toolbar';
import { landingPage } from '@/features/processing-schedules/lib/period-form';
import {
  PERIOD_HIDEABLE_COLUMNS,
  type PeriodsSearch,
  periodsSearchSchema,
  toListSearch,
  toPeriodsQuery,
} from '@/features/processing-schedules/lib/search';
import type { ProcessingSchedule } from '@/features/reference-data/lib/types';
import { useSearchNavigation } from '@/hooks/use-search-navigation';
import { useStoredState } from '@/hooks/use-stored-state';
import { isNotFound } from '@/lib/http';
import { toPaginationState } from '@/lib/table-search';

const loadDialog = () => import('@/features/processing-schedules/components/period-form-dialog');
const PeriodFormDialog = lazy(() =>
  loadDialog().then((module) => ({ default: module.PeriodFormDialog })),
);
const CLOSED_DIALOGS = { period: undefined } satisfies Partial<PeriodsSearch>;
const columnChoicesSchema = z.record(z.string(), z.boolean());

export const Route = createFileRoute(
  '/(protected)/_protected/administration/processing-schedules_/$id',
)({
  validateSearch: periodsSearchSchema,
  loaderDeps: ({ search: { page, size, sort, dir } }) => ({ page, size, sort, dir }),
  loader: async ({ context: { queryClient }, params, deps }) => {
    await requireRight(queryClient, RIGHTS.processingSchedulesManage);
    if (!z.guid().safeParse(params.id).success) throw notFound();
    queryClient.prefetchQuery(periodsListOptions(toPeriodsQuery(params.id, deps)));
    const schedule = await queryClient.ensureQueryData(scheduleDetailOptions(params.id));
    return schedule;
  },
  staticData: {
    crumbKey: 'processing-schedules.periods.crumb',
    crumbParentSearch: toListSearch,
  },
  pendingComponent: PeriodsPagePending,
  errorComponent: PeriodsPageError,
  notFoundComponent: PeriodsNotFound,
  component: PeriodsPage,
});

function PeriodsPage() {
  const { t } = useTranslation();
  const schedule = Route.useLoaderData();
  const router = useRouter();
  const search = Route.useSearch({
    select: ({ period: _period, ...list }): PeriodsSearch => list,
    structuralSharing: true,
  });
  const period = Route.useSearch({ select: (search) => search.period });
  const { measureContent, columnView } = usePeriodsColumnView();
  const { updateSearch, openDialog, closeDialog } =
    useSearchNavigation<PeriodsSearch>(CLOSED_DIALOGS);
  const addPeriod = useCallback(() => openDialog({ period: 'new' }), [openDialog]);
  const onAdded = useCallback(
    (total: number) => {
      const current = periodsSearchSchema.parse(router.state.location.search);
      const landing = landingPage({
        total,
        size: toPaginationState(current).pageSize,
        desc: current.dir === 'desc',
      });
      if (landing !== (current.page ?? 1)) {
        updateSearch({ ...CLOSED_DIALOGS, page: landing === 1 ? undefined : landing }, true);
      } else closeDialog();
    },
    [router, updateSearch, closeDialog],
  );
  const [dialogsMounted, setDialogsMounted] = useState(period !== undefined);
  if (period !== undefined && !dialogsMounted) setDialogsMounted(true);
  useEffect(() => {
    void loadDialog();
  }, []);

  return (
    <Workspace>
      <PeriodsHeader schedule={schedule} />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measureContent}>
          <PeriodsToolbar columnView={columnView} onAdd={addPeriod} />
          <QueryBoundary
            errorComponent={({ error, reset }) => (
              <ListError
                description={t('processing-schedules.periods.error-description')}
                error={error}
                reset={reset}
                title={t('processing-schedules.periods.error-title')}
              />
            )}
            pendingFallback={
              <PeriodsTableSkeleton columnVisibility={columnView.visibility} search={search} />
            }
            resetKey={JSON.stringify(search)}
          >
            <PeriodsTable
              scheduleId={schedule.id}
              scheduleCode={schedule.code}
              columnVisibility={columnView.visibility}
              onAdd={addPeriod}
              onSearchChange={updateSearch}
              search={search}
            />
          </QueryBoundary>
        </div>
        {dialogsMounted && (
          <Suspense fallback={null}>
            <PeriodFormDialog
              key={schedule.id}
              schedule={schedule}
              onAdded={onAdded}
              onClose={closeDialog}
              target={period}
            />
          </Suspense>
        )}
      </WorkspaceContent>
    </Workspace>
  );
}

function PeriodsHeader({ schedule }: { schedule?: ProcessingSchedule }) {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <CalendarRangeIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>
          {schedule ? (
            t('processing-schedules.periods.title', { schedule: schedule.name })
          ) : (
            <div className="h-8 w-56">
              <Skeleton fill />
            </div>
          )}
        </WorkspaceTitle>
        <WorkspaceDescription>
          {schedule
            ? t('processing-schedules.periods.page-description', { code: schedule.code })
            : t('processing-schedules.periods.pending-description')}
        </WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

function usePeriodsColumnView() {
  const [measureContent, contentWidth] = useElementWidth<HTMLDivElement>();
  const columnView = useColumnVisibility(
    PERIOD_HIDEABLE_COLUMNS,
    useStoredState('processing-periods.column-visibility', columnChoicesSchema, {}),
    contentWidth,
  );
  return { measureContent, columnView };
}

function PeriodsPagePending() {
  const search = Route.useSearch();
  const { measureContent, columnView } = usePeriodsColumnView();
  return (
    <Workspace>
      <PeriodsHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measureContent}>
          <PeriodsToolbar columnView={columnView} disabled onAdd={() => {}} />
          <PeriodsTableSkeleton columnVisibility={columnView.visibility} search={search} />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}

function PeriodsPageError(props: ErrorComponentProps) {
  const { t } = useTranslation();
  const search = Route.useSearch();
  if (isNotFound(props.error)) return <PeriodsNotFound />;
  return (
    <ErrorFallback
      {...props}
      back={
        <Button
          nativeButton={false}
          render={<Link to="/administration/processing-schedules" search={toListSearch(search)} />}
          size="lg"
        >
          {t('processing-schedules.periods.back')}
        </Button>
      }
      description={t('processing-schedules.periods.load-error-description')}
      title={t('processing-schedules.periods.load-error-title')}
    />
  );
}

function PeriodsNotFound() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  return (
    <Workspace>
      <WorkspaceContent>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>{t('processing-schedules.periods.not-found-title')}</EmptyTitle>
            <EmptyDescription>
              {t('processing-schedules.periods.not-found-description')}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              nativeButton={false}
              render={
                <Link to="/administration/processing-schedules" search={toListSearch(search)} />
              }
              variant="outline"
            >
              {t('processing-schedules.periods.back')}
            </Button>
          </EmptyContent>
        </Empty>
      </WorkspaceContent>
    </Workspace>
  );
}
