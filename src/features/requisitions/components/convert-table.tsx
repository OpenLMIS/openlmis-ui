import { useSuspenseQuery } from '@tanstack/react-query';
import {
  type ColumnVisibilityState,
  createColumnHelper,
  functionalUpdate,
  useTable,
} from '@tanstack/react-table';
import { ClipboardListIcon, SearchXIcon } from 'lucide-react';
import { createContext, memo, type Ref, use, useDeferredValue, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTableEmpty,
  type DataTableFeatures,
  DataTableHeaderLabel,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { selectionColumn } from '@/components/data-table/data-table-selection';
import { useInCards } from '@/components/display/card-actions';
import { formatTimestamp } from '@/components/form/date-value';
import { HiddenFromView } from '@/components/form/form-fields';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { convertListOptions } from '@/features/requisitions/api/queries';
import {
  cardColumns,
  EMERGENCY_COLUMN,
  hideableColumns,
  REQUISITION_LIST_COLUMNS,
  RequisitionListSkeleton,
  RequisitionListTable,
  requisitionListCell,
  requisitionRowLabel,
} from '@/features/requisitions/components/requisition-list-parts';
import type {
  ConvertSearch,
  ConvertSelection,
  DepotMap,
} from '@/features/requisitions/lib/convert-search';
import type { ConvertListRow } from '@/features/requisitions/lib/types';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { usePagedTableSearch } from '@/hooks/use-page-start';
import { type SearchChange, toPaginationState } from '@/lib/table-search';

const helper = createColumnHelper<DataTableFeatures, ConvertListRow>();
const COLUMNS = [
  ...REQUISITION_LIST_COLUMNS.slice(0, 2),
  ['district', 'requisitions.convert.district'],
  ...REQUISITION_LIST_COLUMNS.slice(2),
  ['approvedDate', 'requisitions.convert.date-approved'],
  EMERGENCY_COLUMN,
] as const;
const CARD_COLUMNS = cardColumns(COLUMNS);
export const CONVERT_HIDEABLE_COLUMNS = hideableColumns(COLUMNS).filter(
  ({ id }) => id !== 'facility',
);
const EMPTY: ConvertListRow[] = [];
const noop = () => {};
const rowId = (row: ConvertListRow) => row.requisition.id;

type Props = {
  cards: boolean;
  search: ConvertSearch;
  columns: ColumnVisibilityState;
  onSearchChange: SearchChange<ConvertSearch>;
  picked: ConvertSelection;
  onSelection: (next: ConvertSelection) => void;
  depots: DepotMap;
  onDepot: (id: string, depot: string) => void;
  onRows: (rows: ConvertListRow[]) => void;
  invalid: boolean;
  pending: boolean;
  listRef: Ref<HTMLElement>;
};
const DepotSelect = memo(function DepotSelect({
  row,
  value,
  onChange,
  invalid,
  disabled,
}: {
  row: ConvertListRow;
  value: string;
  onChange: (id: string, value: string) => void;
  invalid: boolean;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const cards = useInCards();
  const id = `depot-${row.requisition.id}`;
  const offered = row.supplyingDepots.filter((depot) => depot !== null);
  return (
    <div className={cards ? 'inline-block w-44 max-w-full align-middle' : undefined}>
      <Field surface="background" data-invalid={invalid || undefined}>
        <HiddenFromView>
          <FieldLabel htmlFor={id}>
            {t('requisitions.convert.depot-label', {
              name: requisitionRowLabel(row.requisition, t('requisitions.columns.emergency')),
            })}
          </FieldLabel>
        </HiddenFromView>
        <Select
          value={value || null}
          onValueChange={(next) => onChange(row.requisition.id, next ?? '')}
          disabled={disabled}
          items={offered.map((depot) => ({ value: depot.id, label: depot.name ?? depot.id }))}
        >
          <SelectTrigger
            id={id}
            width={cards ? 'full' : 'default'}
            wrap={cards ? 'wrap' : 'nowrap'}
            size={cards ? 'default' : 'sm'}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? `${id}-error` : undefined}
          >
            <SelectValue placeholder={t('requisitions.convert.select-depot')} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {offered.map((depot) => (
                <SelectItem key={depot.id} value={depot.id}>
                  {depot.name ?? depot.id}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {invalid && (
          <HiddenFromView>
            <span id={`${id}-error`}>{t('requisitions.convert.no-depot')}</span>
          </HiddenFromView>
        )}
      </Field>
    </div>
  );
});
type DepotState = Pick<Props, 'depots' | 'picked' | 'invalid' | 'pending' | 'onDepot'> & {
  stale: boolean;
};
const DepotContext = createContext<DepotState | null>(null);
function DepotCell({ row }: { row: ConvertListRow }) {
  const state = use(DepotContext);
  if (!state) return null;
  const id = row.requisition.id;
  return (
    <DepotSelect
      row={row}
      value={state.depots[id] ?? ''}
      onChange={state.onDepot}
      invalid={state.invalid && state.picked.has(id) && !state.depots[id]}
      disabled={state.pending || state.stale}
    />
  );
}
function useResultsTable(
  props: Omit<Props, 'onRows' | 'listRef'> & {
    rows: ConvertListRow[];
    total: number;
    stale: boolean;
  },
) {
  const { t, i18n } = useTranslation();
  const timeZone = useDeploymentTimeZone();
  const {
    search,
    columns,
    onSearchChange,
    cards,
    picked,
    onSelection,
    pending,
    rows,
    total,
    stale,
  } = props;
  const defs = useMemo(
    () =>
      helper.columns([
        selectionColumn<ConvertListRow>((row) =>
          requisitionRowLabel(row.requisition, t('requisitions.columns.emergency')),
        ),
        ...(cards ? CARD_COLUMNS : COLUMNS).map(([id, key]) =>
          helper.display({
            id,
            meta: { label: t(key) },
            enableSorting: false,
            header: () => <DataTableHeaderLabel>{t(key)}</DataTableHeaderLabel>,
            cell: ({ row: { original: row } }) => {
              if (id === 'district') return row.requisition.facility?.geographicZone?.name ?? null;
              if (id === 'approvedDate')
                return formatTimestamp(
                  row.requisition.statusChanges?.APPROVED?.changeDate,
                  i18n.language,
                  { timeZone },
                );
              return requisitionListCell(id, row.requisition, i18n.language, timeZone, t);
            },
          }),
        ),
        helper.display({
          id: 'depot',
          meta: { label: t('requisitions.convert.supplying-depot'), skeleton: 'control' },
          header: () => (
            <DataTableHeaderLabel>{t('requisitions.convert.supplying-depot')}</DataTableHeaderLabel>
          ),
          cell: ({ row: { original: row } }) => <DepotCell row={row} />,
        }),
      ]),
    [t, i18n.language, timeZone, cards],
  );
  const rowSelection = Object.fromEntries([...picked.keys()].map((id) => [id, true as const]));
  const { pageStart, searchState } = usePagedTableSearch({
    cards,
    search,
    defaultSort: { id: 'unused', desc: false },
    defaultPageSize: 10,
    onSearchChange,
  });
  const table = useTable({
    features: dataTableFeatures,
    columns: defs,
    data: rows,
    getRowId: rowId,
    rowCount: total,
    manualPagination: true,
    manualSorting: true,
    ...searchState,
    enableRowSelection: !stale && !pending,
    state: { ...searchState.state, sorting: [], columnVisibility: columns, rowSelection },
    onRowSelectionChange: (updater) => {
      if (stale || pending) return;
      const next = functionalUpdate(updater, rowSelection);
      const labels = new Map(
        rows.map((row) => [
          rowId(row),
          { label: requisitionRowLabel(row.requisition, t('requisitions.columns.emergency')) },
        ]),
      );
      onSelection(
        new Map(
          Object.entries(next).flatMap(([id, selected]) => {
            const value = labels.get(id) ?? picked.get(id);
            return selected && value ? [[id, value] as const] : [];
          }),
        ),
      );
    },
  });
  return { table, pageStart };
}
export function ConvertTable(props: Props) {
  const { t } = useTranslation();
  const deferred = useDeferredValue(props.search);
  const { data: page } = useSuspenseQuery(convertListOptions(deferred));
  const stale = deferred !== props.search;
  const { onRows, onSearchChange } = props;
  useEffect(() => {
    if (!stale) onRows(page.content);
  }, [page, stale, onRows]);
  const { table, pageStart } = useResultsTable({
    ...props,
    search: deferred,
    rows: page.content,
    total: page.totalElements,
    stale,
  });
  const pastEnd = page.content.length === 0 && (deferred.page ?? 1) > Math.max(1, page.totalPages);
  useEffect(() => {
    if (pastEnd) onSearchChange({ page: page.totalPages > 1 ? page.totalPages : undefined }, true);
  }, [pastEnd, page.totalPages, onSearchChange]);
  const missingDepot = (id: string) => props.invalid && props.picked.has(id) && !props.depots[id];
  const filtered = deferred.programId || deferred.facilityId;
  const empty = (
    <DataTableEmpty
      icon={filtered ? <SearchXIcon /> : <ClipboardListIcon />}
      title={t(filtered ? 'requisitions.view.no-matches-title' : 'requisitions.convert.empty')}
      description={t(
        filtered
          ? 'requisitions.view.no-matches-description'
          : 'requisitions.convert.empty-description',
      )}
      action={
        filtered && (
          <Button
            variant="destructive"
            onClick={() =>
              onSearchChange({ programId: undefined, facilityId: undefined, page: undefined })
            }
          >
            {t('data-table.clear-filters')}
          </Button>
        )
      }
    />
  );
  return (
    <section
      ref={props.listRef}
      aria-label={t('requisitions.convert.title')}
      className="outline-none"
      tabIndex={-1}
    >
      <DepotContext
        value={{
          depots: props.depots,
          picked: props.picked,
          invalid: props.invalid,
          pending: props.pending,
          onDepot: props.onDepot,
          stale,
        }}
      >
        <RequisitionListTable
          cards={props.cards}
          table={table}
          stale={stale || props.pending}
          empty={!pastEnd && empty}
          footer={!pastEnd && page.totalElements > 0 && <DataTablePagination table={table} />}
          listRef={pageStart.ref}
          isRowInvalid={(row) => missingDepot(rowId(row))}
        />
      </DepotContext>
    </section>
  );
}
export function ConvertTableSkeleton({
  cards,
  search,
  columns,
}: Pick<Props, 'cards' | 'search' | 'columns'>) {
  const { table } = useResultsTable({
    cards,
    search,
    columns,
    onSearchChange: noop,
    picked: new Map(),
    onSelection: noop,
    depots: {},
    onDepot: noop,
    invalid: false,
    pending: true,
    rows: EMPTY,
    total: 0,
    stale: false,
  });
  return (
    <RequisitionListSkeleton
      cards={cards}
      actions={0}
      rowCount={toPaginationState(search, 10).pageSize}
      table={table}
    />
  );
}
