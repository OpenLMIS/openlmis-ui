import { useSuspenseQuery } from '@tanstack/react-query';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { CheckIcon, EllipsisIcon, LayersIcon, PencilIcon, PlusIcon, XIcon } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableColumnHeader,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { pageOfPrograms } from '@/features/programs/lib/programs-list';
import { DEFAULT_PROGRAMS_SORT, type ProgramsSearch } from '@/features/programs/lib/search';
import { programsOptions } from '@/features/reference-data/api/queries';
import { programName } from '@/features/reference-data/lib/programs';
import type { Program } from '@/features/reference-data/lib/types';
import { useMenuOpensDialog } from '@/hooks/use-menu-opens-dialog';
import { type SearchChange, toPaginationState, useTableSearchState } from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, Program>();

function createColumns(t: TFunction, onEdit: (id: string) => void) {
  return columnHelper.columns([
    columnHelper.accessor('name', {
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('programs.name')} />,
      cell: ({ getValue }) =>
        getValue() ? (
          <span className="flex">
            <span className="min-w-0 truncate font-medium" dir="auto">
              {getValue()}
            </span>
          </span>
        ) : null,
    }),
    columnHelper.accessor('code', {
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('programs.code')} />,
      cell: ({ getValue }) => (
        <span className="flex">
          <span className="min-w-0 truncate" dir="ltr">
            {getValue()}
          </span>
        </span>
      ),
      meta: { className: '@xl/main:w-1/4' },
    }),
    columnHelper.accessor('active', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('programs.status')} />
      ),
      cell: ({ getValue }) =>
        getValue() ? (
          <Badge variant="success">
            <CheckIcon data-icon="inline-start" />
            {t('programs.active')}
          </Badge>
        ) : (
          <Badge variant="destructive">
            <XIcon data-icon="inline-start" />
            {t('programs.inactive')}
          </Badge>
        ),
      meta: { className: 'w-32' },
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="sr-only">{t('programs.actions')}</span>,
      meta: { className: 'w-16' },
      cell: ({ row }) => <ProgramActions onEdit={onEdit} program={row.original} />,
    }),
  ]);
}

function ProgramActions({ program, onEdit }: { program: Program; onEdit: (id: string) => void }) {
  const { t } = useTranslation();
  const menu = useMenuOpensDialog();

  return (
    <div className="flex justify-end">
      <DropdownMenu onOpenChange={menu.onOpenChange}>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t('programs.actions-for', { program: programName(program) })}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" finalFocus={menu.finalFocus} width="auto">
          <DropdownMenuItem onClick={menu.opensDialog(() => onEdit(program.id))}>
            <PencilIcon />
            {t('programs.edit')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

type ProgramsTableProps = {
  search: ProgramsSearch;
  onSearchChange: SearchChange<ProgramsSearch>;
  columnVisibility: ColumnVisibilityState;
  onAdd: () => void;
  onEdit: (id: string) => void;
};

const NO_PROGRAMS: Program[] = [];

const getRowId = (program: Program) => program.id;

const noop = () => {};

function useProgramsTable({
  data,
  rowCount,
  search,
  onSearchChange,
  columnVisibility,
  onEdit,
}: Omit<ProgramsTableProps, 'onAdd'> & { data: Program[]; rowCount: number }) {
  const { t } = useTranslation();
  const columns = useMemo(() => createColumns(t, onEdit), [t, onEdit]);
  const searchState = useTableSearchState({
    search,
    defaultSort: DEFAULT_PROGRAMS_SORT,
    onSearchChange,
  });

  return useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId,
    rowCount,
    manualPagination: true,
    manualSorting: true,
    enableSortingRemoval: false,
    ...searchState,
    state: { ...searchState.state, columnVisibility },
  });
}

export function ProgramsTableSkeleton({
  search,
  columnVisibility,
}: Pick<ProgramsTableProps, 'search' | 'columnVisibility'>) {
  const table = useProgramsTable({
    data: NO_PROGRAMS,
    rowCount: 0,
    search,
    onSearchChange: noop,
    columnVisibility,
    onEdit: noop,
  });
  return <DataTableSkeleton rowCount={toPaginationState(search).pageSize} table={table} />;
}

export function ProgramsTable({
  search,
  onSearchChange,
  columnVisibility,
  onAdd,
  onEdit,
}: ProgramsTableProps) {
  const { t } = useTranslation();
  const deferredSearch = useDeferredValue(search);
  const { data: programs } = useSuspenseQuery(programsOptions());
  const data = useMemo(() => pageOfPrograms(programs, deferredSearch), [programs, deferredSearch]);
  const table = useProgramsTable({
    data: data.content,
    rowCount: data.totalElements,
    search: deferredSearch,
    onSearchChange,
    columnVisibility,
    onEdit,
  });
  const isPastLastPage = data.content.length === 0 && data.totalElements > 0;

  useEffect(() => {
    if (isPastLastPage) {
      onSearchChange({ page: data.totalPages > 1 ? data.totalPages : undefined }, true);
    }
  }, [isPastLastPage, data.totalPages, onSearchChange]);

  return (
    <DataTable
      empty={
        !isPastLastPage && (
          <DataTableEmpty
            action={
              <Button onClick={onAdd}>
                <PlusIcon data-icon="inline-start" />
                {t('programs.add')}
              </Button>
            }
            description={t('programs.empty-description')}
            icon={<LayersIcon />}
            title={t('programs.empty-title')}
          />
        )
      }
      footer={!isPastLastPage && data.totalElements > 0 && <DataTablePagination table={table} />}
      isStale={search !== deferredSearch}
      table={table}
    />
  );
}
