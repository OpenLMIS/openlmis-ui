import { createFileRoute, useRouter } from '@tanstack/react-router';
import { CalendarDaysIcon } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { schedulesListOptions } from '@/features/processing-schedules/api/queries';
import {
  SchedulesTable,
  SchedulesTableSkeleton,
} from '@/features/processing-schedules/components/schedules-table';
import { SchedulesToolbar } from '@/features/processing-schedules/components/schedules-toolbar';
import { landingPage } from '@/features/processing-schedules/lib/period-form';
import {
  PERIODS_PAGE_SIZE,
  type SchedulesSearch,
  schedulesSearchSchema,
  toSchedulesQuery,
} from '@/features/processing-schedules/lib/search';
import { useCardLayout } from '@/hooks/use-card-view';
import { useSearchNavigation } from '@/hooks/use-search-navigation';

const loadDialog = () => import('@/features/processing-schedules/components/schedule-form-dialog');
const ScheduleFormDialog = lazy(() =>
  loadDialog().then((module) => ({ default: module.ScheduleFormDialog })),
);

const loadPeriodsDialog = () => import('@/features/processing-schedules/components/periods-dialog');
const PeriodsDialog = lazy(() =>
  loadPeriodsDialog().then((module) => ({ default: module.PeriodsDialog })),
);

const CLOSED_DIALOGS = {
  schedule: undefined,
  periods: undefined,
  periodsPage: undefined,
} satisfies Partial<SchedulesSearch>;

export const Route = createFileRoute('/(protected)/_protected/administration/processing-schedules')(
  {
    validateSearch: schedulesSearchSchema,
    loaderDeps: ({ search }) => ({
      query: toSchedulesQuery(search),
    }),
    loader: async ({ context: { queryClient }, deps }) => {
      await requireRight(queryClient, RIGHTS.processingSchedulesManage);
      queryClient.prefetchQuery(schedulesListOptions(deps.query));
    },
    pendingComponent: SchedulesPagePending,
    component: SchedulesPage,
  },
);

function SchedulesPage() {
  const { t } = useTranslation();
  const search = Route.useSearch({
    select: ({
      schedule: _schedule,
      periods: _periods,
      periodsPage: _periodsPage,
      ...list
    }): SchedulesSearch => list,
    structuralSharing: true,
  });
  const router = useRouter();
  const periodsSearch = Route.useSearch({
    select: ({ periodsPage }) => ({ periodsPage }),
    structuralSharing: true,
  });
  const periods = Route.useSearch({ select: (search) => search.periods });
  const schedule = Route.useSearch({ select: (search) => search.schedule });
  const { updateSearch, openDialog, closeDialog } =
    useSearchNavigation<SchedulesSearch>(CLOSED_DIALOGS);
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  const addSchedule = useCallback(() => openDialog({ schedule: 'new' }), [openDialog]);
  const editSchedule = useCallback((id: string) => openDialog({ periods: id }), [openDialog]);
  const onAdded = useCallback(
    (scheduleId: string, total: number) => {
      const current = schedulesSearchSchema.parse(router.state.location.search);
      if (current.periods !== scheduleId) return;
      const landing = landingPage({ total, size: PERIODS_PAGE_SIZE });
      if (landing !== (current.periodsPage ?? 1))
        updateSearch({ periodsPage: landing === 1 ? undefined : landing }, true, {
          keepState: true,
        });
    },
    [router, updateSearch],
  );
  const [dialogsMounted, setDialogsMounted] = useState(
    schedule !== undefined || periods !== undefined,
  );
  if ((schedule !== undefined || periods !== undefined) && !dialogsMounted) setDialogsMounted(true);
  useEffect(() => {
    void loadDialog();
    void loadPeriodsDialog();
  }, []);

  return (
    <Workspace width="narrow">
      <SchedulesHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
          <SchedulesToolbar
            layout={cards ? 'cards' : 'table'}
            onAdd={addSchedule}
            onSortChange={updateSearch}
            search={search}
          />
          <QueryBoundary
            errorComponent={({ error, reset }) => (
              <ListError
                description={t('processing-schedules.error-description')}
                error={error}
                reset={reset}
                title={t('processing-schedules.error-title')}
              />
            )}
            pendingFallback={<SchedulesTableSkeleton cards={cards} search={search} />}
            resetKey={JSON.stringify(search)}
          >
            <SchedulesTable
              cards={cards}
              onEdit={editSchedule}
              onAdd={addSchedule}
              onSearchChange={updateSearch}
              search={search}
            />
          </QueryBoundary>
        </div>
        {dialogsMounted && (
          <Suspense fallback={null}>
            <ScheduleFormDialog onClose={closeDialog} target={schedule} />
            <PeriodsDialog
              target={periods}
              search={periodsSearch}
              onSearchChange={updateSearch}
              onClose={closeDialog}
              onAdded={onAdded}
            />
          </Suspense>
        )}
      </WorkspaceContent>
    </Workspace>
  );
}

function SchedulesHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <CalendarDaysIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('processing-schedules.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('processing-schedules.page-description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

function SchedulesPagePending() {
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  return (
    <Workspace width="narrow">
      <SchedulesHeader />
      <WorkspaceContent>
        <div ref={measure}>
          <SchedulesTableSkeleton cards={cards} search={{}} />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}
