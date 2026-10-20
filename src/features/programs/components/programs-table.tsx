import { useSuspenseQuery } from '@tanstack/react-query';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { LayersIcon, PencilIcon, PlusIcon } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RowActions } from '@/components/card-actions';
import {
  DataTable,
  DataTableColumnHeader,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { FlagBadge } from '@/components/flag-badge';
import { CellText, TableCards, TableCardsSkeleton } from '@/components/table-cards';
import { Button } from '@/components/ui/button';
import { pageOfPrograms } from '@/features/programs/lib/programs-list';
import { DEFAULT_PROGRAMS_SORT, type ProgramsSearch } from '@/features/programs/lib/search';
import { programsOptions } from '@/features/reference-data/api/queries';
import { programName } from '@/features/reference-data/lib/programs';
import type { Program } from '@/features/reference-data/lib/types';
import { usePagedTableSearch } from '@/hooks/use-page-start';
import { type SearchChange, toPaginationState } from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, Program>();

function createColumns(t: TFunction, onEdit: (id: string) => void) {
  return columnHelper.columns([
    columnHelper.accessor('name', {
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('programs.name')} />,
      cell: ({ getValue }) => (getValue() ? <CellText strong>{getValue()}</CellText> : null),
    }),
    columnHelper.accessor('code', {
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('programs.code')} />,
      cell: ({ getValue }) => <CellText dir="ltr">{getValue()}</CellText>,
      meta: { className: '@xl/main:w-1/4', label: t('programs.code') },
    }),
    columnHelper.accessor('active', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('programs.status')} />
      ),
      cell: ({ getValue }) => (
        <FlagBadge
          value={getValue() ?? false}
          trueLabel={t('programs.active')}
          falseLabel={t('programs.inactive')}
        />
      ),
      meta: { className: 'w-32', label: t('programs.status') },
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

  const label = t('programs.actions-for', { program: programName(program) });

  return (
    <RowActions
      label={label}
      actions={[
        {
          id: 'edit',
          icon: <PencilIcon />,
          label: t('programs.edit'),
          onSelect: () => onEdit(program.id),
        },
      ]}
    />
  );
}

type ProgramsTableProps = {
  cards: boolean;
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
  cards,
  data,
  rowCount,
  search,
  onSearchChange,
  columnVisibility,
  onEdit,
}: Omit<ProgramsTableProps, 'onAdd'> & { data: Program[]; rowCount: number }) {
  const { t } = useTranslation();
  const columns = useMemo(() => createColumns(t, onEdit), [t, onEdit]);
  const { pageStart, searchState } = usePagedTableSearch({
    search,
    defaultSort: DEFAULT_PROGRAMS_SORT,
    onSearchChange,
    cards,
  });

  const table = useTable({
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
  return { table, pageStart };
}

export function ProgramsTableSkeleton({
  cards,
  search,
  columnVisibility,
}: Pick<ProgramsTableProps, 'cards' | 'search' | 'columnVisibility'>) {
  const { table } = useProgramsTable({
    cards: false,
    data: NO_PROGRAMS,
    rowCount: 0,
    search,
    onSearchChange: noop,
    columnVisibility,
    onEdit: noop,
  });
  const rowCount = toPaginationState(search).pageSize;
  if (cards) return <TableCardsSkeleton rowCount={rowCount} table={table} title="name" />;
  return <DataTableSkeleton rowCount={rowCount} table={table} />;
}

export function ProgramsTable({
  cards,
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
  const { table, pageStart } = useProgramsTable({
    cards,
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

  const empty = !isPastLastPage && (
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
  );
  const footer = !isPastLastPage && data.totalElements > 0 && <DataTablePagination table={table} />;
  const isStale = search !== deferredSearch;
  if (cards) {
    return (
      <TableCards
        busy={isStale}
        empty={empty}
        footer={footer}
        listRef={pageStart.ref}
        table={table}
        title="name"
      />
    );
  }
  return <DataTable empty={empty} footer={footer} isStale={isStale} table={table} />;
}
