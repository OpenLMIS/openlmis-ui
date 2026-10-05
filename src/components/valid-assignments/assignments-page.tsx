import { ArrowDownToLineIcon, ArrowUpFromLineIcon, Trash2Icon } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { DataTableSelectionBar } from '@/components/data-table/data-table-selection';
import { useColumnVisibility, useElementWidth } from '@/components/data-table/responsive-columns';
import { ListError } from '@/components/list-error';
import { QueryBoundary } from '@/components/query-boundary';
import { Button } from '@/components/ui/button';
import {
  AssignmentsTable,
  AssignmentsTableSkeleton,
  HalfFilteredNotice,
} from '@/components/valid-assignments/assignments-table';
import { AssignmentsToolbar } from '@/components/valid-assignments/assignments-toolbar';
import { DeleteAssignmentsDialog } from '@/components/valid-assignments/delete-assignments-dialog';
import {
  ASSIGNMENT_HIDEABLE_COLUMNS,
  type AssignmentsSearch,
  assignmentFilterKey,
  CLEARED_ASSIGNMENT_FILTERS,
  isHalfFiltered,
  toAssignmentsQuery,
} from '@/components/valid-assignments/search';
import {
  NOTHING_PICKED,
  type Picked,
  useFilterScoped,
  withoutIds,
} from '@/components/valid-assignments/selection';
import type { AssignmentKind, AssignmentsApi } from '@/components/valid-assignments/types';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace';
import { useStoredState } from '@/hooks/use-stored-state';
import type { SearchChange } from '@/lib/table-search';

const loadDialog = () => import('@/components/valid-assignments/add-assignment-dialog');
const AddAssignmentDialog = lazy(() =>
  loadDialog().then((module) => ({ default: module.AddAssignmentDialog })),
);

const columnChoicesSchema = z.record(z.string(), z.boolean());

type AssignmentsPageProps = {
  api: AssignmentsApi;
  search: AssignmentsSearch;
  onSearchChange: SearchChange<AssignmentsSearch>;
  adding: boolean;
  onAdd: () => void;
  onCloseAdd: () => void;
  canPickOrganizations: boolean;
};

export function AssignmentsPage({
  api,
  search,
  onSearchChange,
  adding,
  onAdd,
  onCloseAdd,
  canPickOrganizations,
}: AssignmentsPageProps) {
  const { t } = useTranslation();
  const [measureContent, contentWidth] = useElementWidth<HTMLElement>();
  const content = useRef<HTMLElement>(null);
  const contentRef = useCallback(
    (element: HTMLElement | null) => {
      measureContent(element);
      content.current = element;
    },
    [measureContent],
  );
  const columnView = useColumnVisibility(
    ASSIGNMENT_HIDEABLE_COLUMNS,
    useStoredState(`valid-${api.kind}.column-visibility`, columnChoicesSchema, {}),
    contentWidth,
  );

  const filterKey = assignmentFilterKey(search);
  const [picked, setPicked] = useFilterScoped(filterKey, NOTHING_PICKED);
  const [deleting, setDeleting] = useFilterScoped<Picked | undefined>(filterKey, undefined);
  const deleteOne = useCallback(
    (row: { id: string; name: string }, rowsFilterKey: string) =>
      setDeleting(new Map([[row.id, row.name]]), rowsFilterKey),
    [setDeleting],
  );

  const [dialogMounted, setDialogMounted] = useState(adding);
  if (adding && !dialogMounted) setDialogMounted(true);
  useEffect(() => {
    void loadDialog();
  }, []);

  return (
    <Workspace>
      <AssignmentsHeader kind={api.kind} />
      <WorkspaceContent>
        <section
          aria-label={t('valid-assignments.title', { kind: api.kind })}
          className="flex flex-col gap-4 outline-none @4xl/main:gap-6"
          ref={contentRef}
          tabIndex={-1}
        >
          <AssignmentsToolbar
            columnView={columnView}
            kind={api.kind}
            onAdd={onAdd}
            onFilterChange={(patch) => onSearchChange(patch, true)}
            search={search}
          />
          {isHalfFiltered(search) ? (
            <HalfFilteredNotice
              onClear={() => onSearchChange(CLEARED_ASSIGNMENT_FILTERS, true)}
              search={search}
            />
          ) : (
            <QueryBoundary
              errorComponent={({ error, reset }) => (
                <ListError
                  description={t('valid-assignments.error-description')}
                  error={error}
                  reset={reset}
                  title={t('valid-assignments.error-title', { kind: api.kind })}
                />
              )}
              pendingFallback={
                <AssignmentsTableSkeleton
                  columnVisibility={columnView.visibility}
                  search={search}
                />
              }
              resetKey={JSON.stringify(toAssignmentsQuery(search))}
            >
              <AssignmentsTable
                api={api}
                columnVisibility={columnView.visibility}
                onDelete={deleteOne}
                onPickedChange={setPicked}
                onSearchChange={onSearchChange}
                picked={picked}
                search={search}
              />
            </QueryBoundary>
          )}
          <DataTableSelectionBar
            count={picked.size}
            onClear={() => setPicked(NOTHING_PICKED, filterKey)}
          >
            <Button onClick={() => setDeleting(picked, filterKey)} size="sm" variant="destructive">
              <Trash2Icon data-icon="inline-start" />
              {t('valid-assignments.delete-selected')}
            </Button>
          </DataTableSelectionBar>
        </section>
        <DeleteAssignmentsDialog
          api={api}
          focusAfterDelete={content}
          onClose={() => setDeleting(undefined, filterKey)}
          onDeleted={(ids) => setPicked(withoutIds(picked, ids), filterKey)}
          targets={deleting}
        />
        {dialogMounted && (
          <Suspense fallback={null}>
            <AddAssignmentDialog
              api={api}
              canPickOrganizations={canPickOrganizations}
              onClose={onCloseAdd}
              open={adding}
            />
          </Suspense>
        )}
      </WorkspaceContent>
    </Workspace>
  );
}

function AssignmentsHeader({ kind }: { kind: AssignmentKind }) {
  const { t } = useTranslation();
  const Icon = kind === 'destinations' ? ArrowUpFromLineIcon : ArrowDownToLineIcon;
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <Icon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('valid-assignments.title', { kind })}</WorkspaceTitle>
        <WorkspaceDescription>
          {t('valid-assignments.page-description', { kind })}
        </WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

export function AssignmentsPagePending({ kind }: { kind: AssignmentKind }) {
  return (
    <Workspace>
      <AssignmentsHeader kind={kind} />
      <WorkspaceContent>
        <AssignmentsTableSkeleton columnVisibility={{}} search={{}} />
      </WorkspaceContent>
    </Workspace>
  );
}
