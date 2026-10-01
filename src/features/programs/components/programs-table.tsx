import { useSuspenseQuery } from '@tanstack/react-query';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { CheckIcon, EllipsisIcon, LayersIcon, PencilIcon, PlusIcon, XIcon } from 'lucide-react';
import { useEffect, useMemo } from 'react';
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
import { sortPrograms } from '@/features/programs/lib/programs-list';
import {
  DEFAULT_PROGRAMS_SORT,
  type ProgramSortField,
  type ProgramsSearch,
} from '@/features/programs/lib/search';
import { programsOptions } from '@/features/reference-data/api/queries';
import type { Program } from '@/features/reference-data/lib/types';
import { useMenuOpensDialog } from '@/hooks/use-menu-opens-dialog';
import {
  type SearchChange,
  toPaginationState,
  toSortingState,
  useTableSearchState,
} from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, Program>();

function createColumns(t: TFunction, onEdit: (id: string) => void) {
  return columnHelper.columns([
    columnHelper.accessor('name', {
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('programs.name')} />,
      cell: ({ getValue }) => (
        <span className="block truncate font-medium">
          <bdi>{getValue()}</bdi>
        </span>
      ),
    }),
    columnHelper.accessor('code', {
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('programs.code')} />,
      cell: ({ getValue }) => (
        <span className="block truncate">
          <bdi dir="ltr">{getValue()}</bdi>
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
              aria-label={t('programs.actions-for', { program: program.name || program.code })}
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
  programs,
  search,
  onSearchChange,
  columnVisibility,
  onEdit,
}: Omit<ProgramsTableProps, 'onAdd'> & { programs: Program[] }) {
  const { t } = useTranslation();
  const columns = useMemo(() => createColumns(t, onEdit), [t, onEdit]);
  const searchState = useTableSearchState({
    search,
    defaultSort: DEFAULT_PROGRAMS_SORT,
    onSearchChange,
  });
  const [{ id, desc }] = toSortingState(search, DEFAULT_PROGRAMS_SORT) as [
    { id: ProgramSortField; desc: boolean },
  ];
  const { pageIndex, pageSize } = toPaginationState(search);
  const sorted = useMemo(() => sortPrograms(programs, id, desc), [programs, id, desc]);
  const data = useMemo(
    () => sorted.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [sorted, pageIndex, pageSize],
  );

  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId,
    rowCount: sorted.length,
    manualPagination: true,
    manualSorting: true,
    enableSortingRemoval: false,
    ...searchState,
    state: { ...searchState.state, columnVisibility },
  });

  return { table, total: sorted.length };
}

export function ProgramsTableSkeleton({
  search,
  columnVisibility,
}: Pick<ProgramsTableProps, 'search' | 'columnVisibility'>) {
  const { table } = useProgramsTable({
    programs: NO_PROGRAMS,
    search,
    onSearchChange: noop,
    columnVisibility,
    onEdit: noop,
  });
  return <DataTableSkeleton rowCount={toPaginationState(search).pageSize} table={table} />;
}

export function ProgramsTable({ search, onSearchChange, onAdd, ...props }: ProgramsTableProps) {
  const { t } = useTranslation();
  const { data: programs } = useSuspenseQuery(programsOptions());
  const { table, total } = useProgramsTable({ programs, search, onSearchChange, ...props });
  const pageCount = table.getPageCount();
  const isPastLastPage = total > 0 && toPaginationState(search).pageIndex >= pageCount;

  useEffect(() => {
    if (isPastLastPage) onSearchChange({ page: pageCount > 1 ? pageCount : undefined }, true);
  }, [isPastLastPage, pageCount, onSearchChange]);

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
      footer={!isPastLastPage && total > 0 && <DataTablePagination table={table} />}
      table={table}
    />
  );
}
