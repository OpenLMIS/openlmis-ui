import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import {
  type ColumnVisibilityState,
  createColumnHelper,
  type RowSelectionState,
  type Updater,
  useTable,
} from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { EllipsisIcon, MapPinnedIcon, SearchXIcon, Trash2Icon } from 'lucide-react';
import { useCallback, useDeferredValue, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableCard,
  DataTableColumnHeader,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { selectionColumn } from '@/components/data-table/data-table-selection';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  type AssignmentsSearch,
  assignmentFilterKey,
  CLEARED_ASSIGNMENT_FILTERS,
  hasAssignmentFilters,
  toAssignmentsQuery,
} from '@/components/valid-assignments/search';
import {
  applySelection,
  type Picked,
  toRowSelection,
} from '@/components/valid-assignments/selection';
import type { AssignmentsApi, ValidAssignment } from '@/components/valid-assignments/types';
import {
  facilitiesByIdsOptions,
  facilityTypesOptions,
  geographicLevelsOptions,
  programsOptions,
} from '@/features/reference-data/api/queries';
import { facilityTypeName } from '@/features/reference-data/lib/facility-types';
import { programName } from '@/features/reference-data/lib/programs';
import { useMenuOpensDialog } from '@/hooks/use-menu-opens-dialog';
import {
  type DefaultSort,
  type SearchChange,
  toPaginationState,
  useTableSearchState,
} from '@/lib/table-search';

type Lookup = string | null | undefined;

type AssignmentRow = ValidAssignment & {
  label: string;
  rowName: string;
  program: Lookup;
  facilityType: Lookup;
  geoLevel: Lookup;
};

type DeleteRow = (row: { id: string; name: string }, rowsFilterKey: string) => void;

const columnHelper = createColumnHelper<DataTableFeatures, AssignmentRow>();

const muted = (text: string) => <span className="text-muted-foreground">{text}</span>;

const wrapped = (text: string) => (
  <span className="block whitespace-normal break-words" dir="auto">
    {text}
  </span>
);

function createColumns(
  t: TFunction,
  zones: ReadonlyMap<string, string> | undefined,
  onDelete: (row: { id: string; name: string }) => void,
) {
  const unknown = t('valid-assignments.unknown');
  const looked = (value: Lookup) => {
    if (value === undefined) return <CellSkeleton />;
    return value === null ? muted(unknown) : wrapped(value);
  };

  return columnHelper.columns([
    selectionColumn<AssignmentRow>((row) => row.rowName),
    columnHelper.accessor('program', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('valid-assignments.program')} />
      ),
      cell: ({ getValue }) => looked(getValue()),
    }),
    columnHelper.accessor('facilityType', {
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('valid-assignments.facility-type')} />
      ),
      cell: ({ getValue }) => looked(getValue()),
    }),
    columnHelper.accessor('label', {
      id: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('valid-assignments.name')} />
      ),
      cell: ({ row, table }) => {
        const folded = (['program', 'facilityType'] as const)
          .filter((id) => !table.getColumn(id)?.getIsVisible())
          .map((id) => row.original[id])
          .filter((value) => value !== undefined)
          .map((value) => value ?? unknown);
        return (
          <span className="flex flex-col whitespace-normal break-words" dir="auto">
            <span className="font-medium">{row.original.label}</span>
            {folded.length > 0 && muted(folded.join(' · '))}
          </span>
        );
      },
      meta: { className: '@2xl/main:w-1/4' },
    }),
    columnHelper.display({
      id: 'geoZone',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('valid-assignments.geo-zone')} />
      ),
      cell: ({ row }) => {
        if (!row.original.node.refDataFacility) return muted(t('valid-assignments.organization'));
        if (!zones) return <CellSkeleton />;
        const zone = zones.get(row.original.node.referenceId);
        return zone ? wrapped(zone) : null;
      },
    }),
    columnHelper.accessor('geoLevel', {
      id: 'geoLevelAffinity',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('valid-assignments.geo-level-affinity')} />
      ),
      cell: ({ getValue, row }) => (row.original.geoLevelAffinityId ? looked(getValue()) : null),
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="sr-only">{t('valid-assignments.actions')}</span>,
      meta: { className: 'w-16' },
      cell: ({ row }) => (
        <AssignmentActions
          label={row.original.rowName}
          onDelete={() => onDelete({ id: row.original.id, name: row.original.rowName })}
        />
      ),
    }),
  ]);
}

function CellSkeleton() {
  return (
    <div className="h-4 w-2/3">
      <Skeleton fill />
    </div>
  );
}

function AssignmentActions({ label, onDelete }: { label: string; onDelete: () => void }) {
  const { t } = useTranslation();
  const menu = useMenuOpensDialog();

  return (
    <div className="flex justify-end">
      <DropdownMenu onOpenChange={menu.onOpenChange}>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t('valid-assignments.actions-for', { name: label })}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <EllipsisIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" finalFocus={menu.finalFocus} width="auto">
          <DropdownMenuItem onClick={menu.opensDialog(onDelete)} variant="destructive">
            <Trash2Icon />
            {t('valid-assignments.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function useNames<T extends { id: string }>(
  { data, isError }: { data: readonly T[] | undefined; isError: boolean },
  name: (item: T) => string,
) {
  return useMemo(() => {
    const names = data && new Map(data.map((item) => [item.id, name(item)]));
    return (id: string): Lookup => (names ? (names.get(id) ?? null) : isError ? null : undefined);
  }, [data, isError, name]);
}

const levelName = (level: { code: string; name: string | null }) => level.name || level.code;

function useAssignmentRows(data: readonly ValidAssignment[]): AssignmentRow[] {
  const { t } = useTranslation();
  const programOf = useNames(useQuery(programsOptions()), programName);
  const typeOf = useNames(useQuery(facilityTypesOptions()), facilityTypeName);
  const levelOf = useNames(useQuery(geographicLevelsOptions()), levelName);

  return useMemo(() => {
    const unknown = t('valid-assignments.unknown');
    return data.map((assignment) => {
      const label = assignment.name ?? unknown;
      const program = programOf(assignment.programId);
      const facilityType = typeOf(assignment.facilityTypeId);
      return {
        ...assignment,
        label,
        rowName:
          program === undefined || facilityType === undefined
            ? label
            : t('valid-assignments.row-name', {
                name: label,
                program: program ?? unknown,
                type: facilityType ?? unknown,
              }),
        program,
        facilityType,
        geoLevel: assignment.geoLevelAffinityId ? levelOf(assignment.geoLevelAffinityId) : null,
      };
    });
  }, [data, programOf, typeOf, levelOf, t]);
}

function useZones(data: readonly ValidAssignment[]) {
  const ids = useMemo(
    () =>
      [
        ...new Set(
          data.filter(({ node }) => node.refDataFacility).map(({ node }) => node.referenceId),
        ),
      ].sort(),
    [data],
  );
  const { data: facilities, isError } = useQuery(facilitiesByIdsOptions(ids));
  return useMemo(() => {
    if (isError) return new Map<string, string>();
    return facilities && new Map(facilities.map((f) => [f.id, f.geographicZone.name]));
  }, [facilities, isError]);
}

type AssignmentsTableProps = {
  api: AssignmentsApi;
  search: AssignmentsSearch;
  onSearchChange: SearchChange<AssignmentsSearch>;
  columnVisibility: ColumnVisibilityState;
  picked: Picked;
  onPickedChange: (picked: Picked, rowsFilterKey: string) => void;
  onDelete: DeleteRow;
};

const NO_ROWS: AssignmentRow[] = [];
const UNSORTED: DefaultSort = { id: 'name', desc: false };
const getRowId = (row: AssignmentRow) => row.id;
const noop = () => {};

function useAssignmentsTable({
  rows,
  rowCount,
  search,
  onSearchChange,
  columnVisibility,
  zones,
  rowSelection,
  onRowSelectionChange,
  onDelete,
}: {
  rows: AssignmentRow[];
  rowCount: number;
  search: AssignmentsSearch;
  onSearchChange: SearchChange<AssignmentsSearch>;
  columnVisibility: ColumnVisibilityState;
  zones: ReadonlyMap<string, string> | undefined;
  rowSelection: RowSelectionState;
  onRowSelectionChange: (updater: Updater<RowSelectionState>) => void;
  onDelete: (row: { id: string; name: string }) => void;
}) {
  const { t } = useTranslation();
  const columns = useMemo(() => createColumns(t, zones, onDelete), [t, zones, onDelete]);
  const searchState = useTableSearchState({ search, defaultSort: UNSORTED, onSearchChange });

  return useTable({
    features: dataTableFeatures,
    columns,
    data: rows,
    getRowId,
    rowCount,
    manualPagination: true,
    manualSorting: true,
    enableSorting: false,
    ...searchState,
    state: { ...searchState.state, columnVisibility, rowSelection },
    onRowSelectionChange,
  });
}

export function AssignmentsTableSkeleton({
  search,
  columnVisibility,
}: {
  search: AssignmentsSearch;
  columnVisibility: ColumnVisibilityState;
}) {
  const table = useAssignmentsTable({
    rows: NO_ROWS,
    rowCount: 0,
    search,
    onSearchChange: noop,
    columnVisibility,
    zones: undefined,
    rowSelection: {},
    onRowSelectionChange: noop,
    onDelete: noop,
  });

  return <DataTableSkeleton rowCount={toPaginationState(search).pageSize} table={table} />;
}

export function AssignmentsTable({
  api,
  search,
  onSearchChange,
  columnVisibility,
  picked,
  onPickedChange,
  onDelete,
}: AssignmentsTableProps) {
  const { t } = useTranslation();
  const deferredSearch = useDeferredValue(search);
  const { data } = useSuspenseQuery(api.listOptions(toAssignmentsQuery(deferredSearch)));
  const rows = useAssignmentRows(data.content);
  const zones = useZones(data.content);
  const rowSelection = useMemo(() => toRowSelection(picked), [picked]);
  const rowsFilterKey = assignmentFilterKey(deferredSearch);
  const deleteRow = useCallback(
    (row: { id: string; name: string }) => onDelete(row, rowsFilterKey),
    [onDelete, rowsFilterKey],
  );
  const table = useAssignmentsTable({
    rows,
    rowCount: data.totalElements,
    search: deferredSearch,
    onSearchChange,
    columnVisibility,
    zones,
    rowSelection,
    onRowSelectionChange: (updater) => {
      const next = typeof updater === 'function' ? updater(rowSelection) : updater;
      onPickedChange(applySelection(picked, next, rows), rowsFilterKey);
    },
    onDelete: deleteRow,
  });
  const isPastLastPage = data.content.length === 0 && data.totalElements > 0;

  useEffect(() => {
    if (isPastLastPage) {
      onSearchChange({ page: data.totalPages > 1 ? data.totalPages : undefined }, true);
    }
  }, [isPastLastPage, data.totalPages, onSearchChange]);

  const empty = hasAssignmentFilters(deferredSearch) ? (
    <DataTableEmpty
      action={
        <Button onClick={() => onSearchChange(CLEARED_ASSIGNMENT_FILTERS)} variant="destructive">
          {t('valid-assignments.clear-filters')}
        </Button>
      }
      description={t('valid-assignments.no-results-description', { kind: api.kind })}
      icon={<SearchXIcon />}
      title={t('valid-assignments.no-results-title')}
    />
  ) : (
    <DataTableEmpty
      description={t('valid-assignments.empty-description', { kind: api.kind })}
      icon={<MapPinnedIcon />}
      title={t('valid-assignments.empty-title', { kind: api.kind })}
    />
  );

  return (
    <DataTable
      empty={!isPastLastPage && empty}
      footer={!isPastLastPage && data.totalElements > 0 && <DataTablePagination table={table} />}
      isStale={search !== deferredSearch}
      table={table}
    />
  );
}

export function HalfFilteredNotice({
  search,
  onClear,
}: {
  search: AssignmentsSearch;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  return (
    <DataTableCard>
      <DataTableEmpty
        action={
          <Button onClick={onClear} variant="destructive">
            {t('valid-assignments.clear-filters')}
          </Button>
        }
        description={t(
          search.facilityId
            ? 'valid-assignments.half-filter-program'
            : 'valid-assignments.half-filter-facility',
        )}
        icon={<SearchXIcon />}
        title={t('valid-assignments.half-filter-title')}
      />
    </DataTableCard>
  );
}
