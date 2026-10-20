import { createFileRoute } from '@tanstack/react-router';
import { LayersIcon } from 'lucide-react';
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
import {
  ProgramsTable,
  ProgramsTableSkeleton,
} from '@/features/programs/components/programs-table';
import { ProgramsToolbar } from '@/features/programs/components/programs-toolbar';
import {
  PROGRAM_HIDEABLE_COLUMNS,
  type ProgramsSearch,
  programsSearchSchema,
} from '@/features/programs/lib/search';
import { programsOptions } from '@/features/reference-data/api/queries';
import { useCardView } from '@/hooks/use-card-view';
import { useSearchNavigation } from '@/hooks/use-search-navigation';

const loadDialog = () => import('@/features/programs/components/program-form-dialog');
const ProgramFormDialog = lazy(() =>
  loadDialog().then((module) => ({ default: module.ProgramFormDialog })),
);

const CLOSED_DIALOGS = { program: undefined } satisfies Partial<ProgramsSearch>;

const usePageCardView = () => useCardView(PROGRAM_HIDEABLE_COLUMNS, 'programs.column-visibility');

export const Route = createFileRoute('/(protected)/_protected/administration/programs')({
  validateSearch: programsSearchSchema,
  loaderDeps: ({ search }) => ({ program: search.program }),
  loader: async ({ context: { queryClient }, deps }) => {
    await requireRight(queryClient, RIGHTS.programsManage);
    queryClient.prefetchQuery(programsOptions());
    if (deps.program === 'new') queryClient.prefetchQuery(programsOptions());
  },
  pendingComponent: ProgramsPagePending,
  component: ProgramsPage,
});

function ProgramsPage() {
  const { t } = useTranslation();
  const search = Route.useSearch({
    select: ({ program: _program, ...list }): ProgramsSearch => list,
    structuralSharing: true,
  });
  const program = Route.useSearch({ select: (search) => search.program });
  const { measure, cards, columnView, layout } = usePageCardView();
  const { updateSearch, openDialog, closeDialog } =
    useSearchNavigation<ProgramsSearch>(CLOSED_DIALOGS);
  const addProgram = useCallback(() => openDialog({ program: 'new' }), [openDialog]);
  const editProgram = useCallback((id: string) => openDialog({ program: id }), [openDialog]);
  const [dialogMounted, setDialogMounted] = useState(program !== undefined);
  if (program !== undefined && !dialogMounted) setDialogMounted(true);
  useEffect(() => {
    void loadDialog();
  }, []);

  return (
    <Workspace>
      <ProgramsHeader />
      <WorkspaceContent>
        <div className="flex flex-col gap-4 @4xl/main:gap-6" ref={measure}>
          <ProgramsToolbar
            columnView={columnView}
            layout={layout}
            onAdd={addProgram}
            onSortChange={updateSearch}
            search={search}
          />
          <QueryBoundary
            errorComponent={({ error, reset }) => (
              <ListError
                description={t('programs.error-description')}
                error={error}
                reset={reset}
                title={t('programs.error-title')}
              />
            )}
            pendingFallback={
              <ProgramsTableSkeleton
                cards={cards}
                columnVisibility={columnView.visibility}
                search={search}
              />
            }
            resetKey={JSON.stringify(search)}
          >
            <ProgramsTable
              cards={cards}
              columnVisibility={columnView.visibility}
              onAdd={addProgram}
              onEdit={editProgram}
              onSearchChange={updateSearch}
              search={search}
            />
          </QueryBoundary>
        </div>
        {dialogMounted && (
          <Suspense fallback={null}>
            <ProgramFormDialog onClose={closeDialog} target={program} />
          </Suspense>
        )}
      </WorkspaceContent>
    </Workspace>
  );
}

function ProgramsHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <LayersIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('programs.title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('programs.page-description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

function ProgramsPagePending() {
  const { measure, cards, columnView } = usePageCardView();
  return (
    <Workspace>
      <ProgramsHeader />
      <WorkspaceContent>
        <div ref={measure}>
          <ProgramsTableSkeleton
            cards={cards}
            columnVisibility={columnView.visibility}
            search={{}}
          />
        </div>
      </WorkspaceContent>
    </Workspace>
  );
}
