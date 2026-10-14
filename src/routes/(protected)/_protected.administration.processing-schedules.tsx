import { createFileRoute } from '@tanstack/react-router';
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
import {
  type SchedulesSearch,
  schedulesSearchSchema,
  toSchedulesQuery,
} from '@/features/processing-schedules/lib/search';
import { useSearchNavigation } from '@/hooks/use-search-navigation';

const loadDialog = () => import('@/features/processing-schedules/components/schedule-form-dialog');
const ScheduleFormDialog = lazy(() =>
  loadDialog().then((module) => ({ default: module.ScheduleFormDialog })),
);

const CLOSED_DIALOGS = { schedule: undefined } satisfies Partial<SchedulesSearch>;

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
    select: ({ schedule: _schedule, ...list }): SchedulesSearch => list,
    structuralSharing: true,
  });
  const schedule = Route.useSearch({ select: (search) => search.schedule });
  const { updateSearch, openDialog, closeDialog } =
    useSearchNavigation<SchedulesSearch>(CLOSED_DIALOGS);
  const addSchedule = useCallback(() => openDialog({ schedule: 'new' }), [openDialog]);
  const [dialogsMounted, setDialogsMounted] = useState(schedule !== undefined);
  if (schedule !== undefined && !dialogsMounted) setDialogsMounted(true);
  useEffect(() => {
    void loadDialog();
  }, []);

  return (
    <Workspace width="narrow">
      <SchedulesHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6">
          <SchedulesToolbar onAdd={addSchedule} />
          <QueryBoundary
            errorComponent={({ error, reset }) => (
              <ListError
                description={t('processing-schedules.error-description')}
                error={error}
                reset={reset}
                title={t('processing-schedules.error-title')}
              />
            )}
            pendingFallback={<SchedulesTableSkeleton search={search} />}
            resetKey={JSON.stringify(search)}
          >
            <SchedulesTable onAdd={addSchedule} onSearchChange={updateSearch} search={search} />
          </QueryBoundary>
        </div>
        {dialogsMounted && (
          <Suspense fallback={null}>
            <ScheduleFormDialog onClose={closeDialog} target={schedule} />
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
  return (
    <Workspace width="narrow">
      <SchedulesHeader />
      <WorkspaceContent>
        <SchedulesTableSkeleton search={{}} />
      </WorkspaceContent>
    </Workspace>
  );
}
