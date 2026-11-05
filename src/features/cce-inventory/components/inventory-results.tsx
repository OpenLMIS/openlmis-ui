import { hashKey, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { ParseKeys, TFunction } from 'i18next';
import { EyeIcon, RefrigeratorIcon, SearchXIcon } from 'lucide-react';
import { use, useDeferredValue, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableColumnHeader,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableHeaderLabel,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import type { ResponsiveColumn } from '@/components/data-table/responsive-columns';
import { CardActions, useInCards } from '@/components/display/card-actions';
import { CellText, TableCards, TableCardsSkeleton } from '@/components/display/table-cards';
import { formatTimestamp } from '@/components/form/date-value';
import { Button } from '@/components/ui/button';
import {
  inventoryAlertsOptions,
  inventoryItemsOptions,
} from '@/features/cce-inventory/api/queries';
import { FunctionalStatusCell } from '@/features/cce-inventory/components/functional-status-cell';
import {
  type InventoryRowActions,
  InventoryRowsContext,
} from '@/features/cce-inventory/components/inventory-rows-context';
import { activeAlertsByDevice } from '@/features/cce-inventory/lib/alerts';
import {
  CLEARED_INVENTORY_FILTERS,
  hasInventoryFilters,
  INVENTORY_PAGE_SIZE,
  INVENTORY_SORT,
  type InventorySearch,
  type InventorySortField,
  isInventorySortField,
  legacyInventoryHash,
  toInventoryQuery,
} from '@/features/cce-inventory/lib/search';
import type { InventoryItem } from '@/features/cce-inventory/lib/types';
import { legacyAvailable, openLegacy } from '@/hooks/use-back-to-legacy';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { usePagedTableSearch } from '@/hooks/use-page-start';
import type { CompleteSelection } from '@/lib/facility-program-selection';
import { type SearchChange, toPaginationState } from '@/lib/table-search';
import { fullName } from '@/lib/text';

type ColumnId = 'facility' | 'makeModel' | InventorySortField;

type InventoryColumn = ResponsiveColumn & {
  id: ColumnId;
  labelKey: ParseKeys;
  hideable: boolean;
};

const COLUMNS: InventoryColumn[] = [
  { id: 'facility', labelKey: 'cce-inventory.facility', hideable: false },
  { id: 'equipmentTrackingId', labelKey: 'cce-inventory.serial-no', hideable: true },
  { id: 'referenceName', labelKey: 'cce-inventory.reference-name', hideable: false },
  { id: 'makeModel', labelKey: 'cce-inventory.make-model', hideable: true },
  { id: 'type', labelKey: 'cce-inventory.type', hideable: true, hideBelow: 896 },
  { id: 'functionalStatus', labelKey: 'cce-inventory.functional-status', hideable: false },
  { id: 'modifiedDate', labelKey: 'cce-inventory.last-updated', hideable: true, hideBelow: 1024 },
  {
    id: 'yearOfInstallation',
    labelKey: 'cce-inventory.year-installed',
    hideable: true,
    hideBelow: 768,
  },
];

export const INVENTORY_HIDEABLE_COLUMNS = COLUMNS.filter((column) => column.hideable);

export const INVENTORY_SORT_COLUMNS = COLUMNS.filter((column) => isInventorySortField(column.id));

const helper = createColumnHelper<DataTableFeatures, InventoryItem>();
const getRowId = (item: InventoryItem) => item.id;
const NO_ITEMS: InventoryItem[] = [];
const noop = () => {};

type CellContext = {
  facilityName: string;
  language: string;
  timeZone: string | undefined;
};

function lastUpdated(item: InventoryItem, { language, timeZone }: CellContext, t: TFunction) {
  const name = item.lastModifier ? fullName(item.lastModifier) : '';
  const date = formatTimestamp(item.modifiedDate, language, { time: 'short', timeZone });
  return name && date ? t('cce-inventory.last-updated-by', { name, date }) : name || date;
}

function cellText(id: ColumnId, item: InventoryItem, context: CellContext, t: TFunction) {
  switch (id) {
    case 'functionalStatus':
      return item.functionalStatus;
    case 'facility':
      return context.facilityName;
    case 'equipmentTrackingId':
      return item.equipmentTrackingId;
    case 'referenceName':
      return item.referenceName;
    case 'makeModel':
      return `${item.catalogItem.manufacturer} ${item.catalogItem.model}`;
    case 'type':
      return item.catalogItem.type;
    case 'modifiedDate':
      return lastUpdated(item, context, t);
    case 'yearOfInstallation':
      return String(item.yearOfInstallation);
  }
}

function ViewItem({ item }: { item: InventoryItem }) {
  const { t } = useTranslation();
  const { actions, stale } = use(InventoryRowsContext);
  const inCards = useInCards();
  if (!actions) return null;
  const name = t('cce-inventory.view-label', { name: item.referenceName });
  if (inCards) {
    return (
      <CardActions
        label={t('card-actions.actions-for', { name: item.referenceName })}
        actions={[
          {
            id: 'view',
            icon: <EyeIcon />,
            label: t('cce-inventory.view'),
            name,
            disabled: stale,
            onSelect: () => actions.details(item),
          },
        ]}
      />
    );
  }
  return (
    <Button aria-label={name} disabled={stale} onClick={() => actions.details(item)} size="sm">
      {t('cce-inventory.view')}
    </Button>
  );
}

function useInventoryColumns({
  facilityName,
  language,
  timeZone,
  withActions,
}: CellContext & { withActions: boolean }) {
  const { t } = useTranslation();
  return useMemo(() => {
    const cellContext = { facilityName, language, timeZone };
    return helper.columns([
      ...COLUMNS.map(({ id, labelKey }) =>
        helper.accessor((item) => cellText(id, item, cellContext, t), {
          id,
          enableSorting: isInventorySortField(id),
          meta: { label: t(labelKey) },
          header: ({ column }) => <DataTableColumnHeader column={column} title={t(labelKey)} />,
          cell: ({ row: { original: item }, getValue }) =>
            id === 'functionalStatus' ? (
              <FunctionalStatusCell item={item} timeZone={timeZone} />
            ) : getValue() ? (
              <CellText overflow="clamp">{getValue()}</CellText>
            ) : null,
        }),
      ),
      ...(withActions
        ? [
            helper.display({
              id: 'actions',
              meta: { label: t('cce-inventory.actions'), skeleton: 'control' },
              header: () => (
                <DataTableHeaderLabel>{t('cce-inventory.actions')}</DataTableHeaderLabel>
              ),
              cell: ({ row }) => <ViewItem item={row.original} />,
            }),
          ]
        : []),
    ]);
  }, [t, facilityName, language, timeZone, withActions]);
}

type ResultsProps = {
  cards: boolean;
  search: InventorySearch;
  selection: CompleteSelection;
  facilityName: string;
  canEdit: boolean;
  columns: ColumnVisibilityState;
  onSearchChange: SearchChange<InventorySearch>;
};

function useInventoryTable({
  cards,
  data,
  rowCount,
  search,
  columns,
  onSearchChange,
  ...columnsOptions
}: Pick<ResultsProps, 'cards' | 'search' | 'columns' | 'onSearchChange'> &
  CellContext & { withActions: boolean; data: InventoryItem[]; rowCount: number }) {
  const columnDefs = useInventoryColumns(columnsOptions);
  const { pageStart, searchState } = usePagedTableSearch({
    cards,
    search,
    defaultSort: INVENTORY_SORT,
    defaultPageSize: INVENTORY_PAGE_SIZE,
    onSearchChange,
  });
  const table = useTable({
    features: dataTableFeatures,
    columns: columnDefs,
    data,
    getRowId,
    rowCount,
    manualPagination: true,
    manualSorting: true,
    ...searchState,
    state: { ...searchState.state, columnVisibility: columns },
  });
  return { table, pageStart };
}

function useRowActions(
  search: InventorySearch,
  { mode, facilityId, programId }: CompleteSelection,
  canEdit: boolean,
) {
  return useMemo<InventoryRowActions | undefined>(() => {
    if (!legacyAvailable()) return undefined;
    const open = (path: string) =>
      openLegacy(legacyInventoryHash(path, search, { mode, facilityId, programId }));
    return {
      details: (item) => open(`${item.id}/details`),
      statusUpdate: canEdit ? (item) => open(`${item.id}/statusUpdate`) : undefined,
    };
  }, [search, mode, facilityId, programId, canEdit]);
}

export function InventoryResults({
  cards,
  search,
  selection,
  facilityName,
  canEdit,
  columns,
  onSearchChange,
}: ResultsProps) {
  const { t, i18n } = useTranslation();
  const deferredSearch = useDeferredValue(search);
  const query = toInventoryQuery(deferredSearch, selection);
  const { data: page } = useSuspenseQuery(inventoryItemsOptions(query));
  const ids = useMemo(() => page.content.map((item) => item.id), [page.content]);
  const { data: alertList } = useQuery(inventoryAlertsOptions(ids));
  const actions = useRowActions(deferredSearch, selection, canEdit);
  const stale = hashKey([toInventoryQuery(search, selection)]) !== hashKey([query]);
  const rows = useMemo(
    () => ({ activeAlerts: activeAlertsByDevice(alertList ?? []), actions, stale }),
    [alertList, actions, stale],
  );
  const { table, pageStart } = useInventoryTable({
    cards,
    data: page.content,
    rowCount: page.totalElements,
    search: deferredSearch,
    columns,
    onSearchChange,
    withActions: actions !== undefined,
    facilityName,
    language: i18n.language,
    timeZone: useDeploymentTimeZone(),
  });
  const pastEnd = page.content.length === 0 && page.totalElements > 0;

  useEffect(() => {
    if (pastEnd) onSearchChange({ page: page.totalPages > 1 ? page.totalPages : undefined }, true);
  }, [pastEnd, page.totalPages, onSearchChange]);

  const empty = hasInventoryFilters(deferredSearch) ? (
    <DataTableEmpty
      action={
        <Button onClick={() => onSearchChange(CLEARED_INVENTORY_FILTERS)} variant="destructive">
          {t('cce-inventory.clear-filters')}
        </Button>
      }
      description={t('cce-inventory.no-matches-description')}
      icon={<SearchXIcon />}
      title={t('cce-inventory.no-matches')}
    />
  ) : (
    <DataTableEmpty
      description={t('cce-inventory.empty-description')}
      icon={<RefrigeratorIcon />}
      title={t('cce-inventory.empty')}
    />
  );
  const footer = !pastEnd && page.totalElements > 0 && <DataTablePagination table={table} />;

  return (
    <InventoryRowsContext value={rows}>
      {cards ? (
        <TableCards
          busy={stale}
          empty={!pastEnd && empty}
          footer={footer}
          listRef={pageStart.ref}
          table={table}
          title="referenceName"
        />
      ) : (
        <DataTable
          density="default"
          empty={!pastEnd && empty}
          footer={footer}
          isStale={stale}
          layout="auto"
          table={table}
        />
      )}
    </InventoryRowsContext>
  );
}

export function InventoryResultsSkeleton({
  cards,
  search,
  columns,
}: Pick<ResultsProps, 'cards' | 'search' | 'columns'>) {
  const { table } = useInventoryTable({
    cards,
    data: NO_ITEMS,
    rowCount: 0,
    search,
    columns,
    onSearchChange: noop,
    withActions: legacyAvailable(),
    facilityName: '',
    language: '',
    timeZone: undefined,
  });
  const rowCount = toPaginationState(search, INVENTORY_PAGE_SIZE).pageSize;
  return cards ? (
    <TableCardsSkeleton actions={1} rowCount={rowCount} table={table} title="referenceName" />
  ) : (
    <DataTableSkeleton density="default" layout="auto" rowCount={rowCount} table={table} />
  );
}
