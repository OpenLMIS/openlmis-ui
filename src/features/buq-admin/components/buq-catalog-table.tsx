import { useSuspenseQuery } from '@tanstack/react-query';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { CoinsIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo } from 'react';
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
import { RowActions } from '@/components/display/card-actions';
import { CellText, TableCards, TableCardsSkeleton } from '@/components/display/table-cards';
import { Button } from '@/components/ui/button';
import { buqCatalogOptions } from '@/features/buq-admin/api/queries';
import { DEFAULT_BUQ_CATALOG_SORT } from '@/features/buq-admin/lib/search';
import {
  BUQ_CATALOGS,
  type BuqCatalogRowAction,
  type BuqCatalogTab,
} from '@/features/buq-admin/lib/types';
import type { BuqCatalogRecord } from '@/features/reference-data/lib/types';
import { usePagedTableSearch } from '@/hooks/use-page-start';
import {
  pageLocally,
  type SearchChange,
  type TableSearch,
  toPaginationState,
  toSortingState,
} from '@/lib/table-search';

const columnHelper = createColumnHelper<DataTableFeatures, BuqCatalogRecord>();
const NO_RECORDS: BuqCatalogRecord[] = [];
const getRowId = (record: BuqCatalogRecord) => record.id;
const noop = () => {};

type TableLayout = { tab: BuqCatalogTab; cards: boolean; search: TableSearch };
type TableActions = {
  onSearchChange: SearchChange<TableSearch>;
  onEdit: BuqCatalogRowAction;
  onDelete: BuqCatalogRowAction;
};

function createColumns(
  t: TFunction,
  tab: BuqCatalogTab,
  onEdit: BuqCatalogRowAction,
  onDelete: BuqCatalogRowAction,
) {
  const name = t(BUQ_CATALOGS[tab].label);
  const description = t('manage-buq.description-column');
  return columnHelper.columns([
    columnHelper.accessor('name', {
      header: ({ column }) => <DataTableColumnHeader column={column} title={name} />,
      cell: ({ getValue }) => <CellText title={getValue()}>{getValue()}</CellText>,
      meta: { label: name },
    }),
    columnHelper.accessor('description', {
      enableSorting: false,
      header: () => <DataTableHeaderLabel>{description}</DataTableHeaderLabel>,
      cell: ({ getValue }) => {
        const text = getValue();
        return text ? (
          <CellText overflow="clamp" title={text}>
            {text}
          </CellText>
        ) : null;
      },
      meta: { label: description },
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <DataTableHeaderLabel>{t('manage-buq.actions')}</DataTableHeaderLabel>,
      meta: { className: 'w-24', skeleton: 'control' },
      cell: ({ row: { original: record } }) => {
        const disabled = record.editable === false;
        const reason = disabled ? t('manage-buq.read-only-reason') : undefined;
        return (
          <RowActions
            label={t('manage-buq.actions-for', { name: record.name })}
            actions={[
              {
                id: 'edit',
                icon: <PencilIcon />,
                label: t('manage-buq.edit'),
                disabled,
                reason,
                onSelect: (opener) => onEdit(record, opener),
              },
              {
                id: 'delete',
                icon: <Trash2Icon />,
                label: t('manage-buq.delete'),
                destructive: true,
                disabled,
                reason,
                onSelect: (opener) => onDelete(record, opener),
              },
            ]}
          />
        );
      },
    }),
  ]);
}

function useBuqCatalogTable({
  cards,
  tab,
  data,
  rowCount,
  search,
  onSearchChange,
  onEdit,
  onDelete,
}: TableLayout & TableActions & { data: BuqCatalogRecord[]; rowCount: number }) {
  const { t } = useTranslation();
  const columns = useMemo(
    () => createColumns(t, tab, onEdit, onDelete),
    [t, tab, onEdit, onDelete],
  );
  const { pageStart, searchState } = usePagedTableSearch({
    search,
    defaultSort: DEFAULT_BUQ_CATALOG_SORT,
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
  });
  return { table, pageStart };
}

export function BuqCatalogTableSkeleton({ tab, cards, search }: TableLayout) {
  const { table } = useBuqCatalogTable({
    tab,
    cards: false,
    data: NO_RECORDS,
    rowCount: 0,
    search,
    onSearchChange: noop,
    onEdit: noop,
    onDelete: noop,
  });
  const rowCount = toPaginationState(search).pageSize;
  if (cards)
    return <TableCardsSkeleton rowCount={rowCount} table={table} title="name" actions={2} />;
  return <DataTableSkeleton rowCount={rowCount} table={table} />;
}

export function BuqCatalogTable({
  search,
  dialogOpen,
  onAdd,
  ...props
}: TableLayout &
  TableActions & {
    dialogOpen: boolean;
    onAdd: (opener: HTMLButtonElement) => void;
  }) {
  const { t, i18n } = useTranslation();
  const { tab, cards, onSearchChange } = props;
  const { data: records } = useSuspenseQuery(buqCatalogOptions(tab));
  const deferredSearch = useDeferredValue(search);
  const { language } = i18n;
  const { desc } = toSortingState(deferredSearch, DEFAULT_BUQ_CATALOG_SORT)[0];
  const sorted = useMemo(() => {
    const { compare } = new Intl.Collator(language, { sensitivity: 'base' });
    return records.toSorted((a, b) => (desc ? compare(b.name, a.name) : compare(a.name, b.name)));
  }, [records, language, desc]);
  const { pageIndex, pageSize } = toPaginationState(deferredSearch);
  const data = useMemo(
    () => pageLocally(sorted, pageIndex, pageSize),
    [sorted, pageIndex, pageSize],
  );
  const { table, pageStart } = useBuqCatalogTable({
    ...props,
    data: data.content,
    rowCount: data.totalElements,
    search: deferredSearch,
  });
  const isStale = deferredSearch !== search;
  const lastPage = Math.max(1, data.totalPages);
  const isPastLastPage = pageIndex >= lastPage;
  useEffect(() => {
    if (isPastLastPage && !isStale && !dialogOpen) {
      onSearchChange({ page: lastPage > 1 ? lastPage : undefined }, true, { resetScroll: false });
    }
  }, [dialogOpen, isPastLastPage, isStale, lastPage, onSearchChange]);

  const remarks = tab === 'remarks';
  const empty = !isPastLastPage && (
    <DataTableEmpty
      action={
        <Button onClick={(event) => onAdd(event.currentTarget)} size="lg">
          <PlusIcon data-icon="inline-start" />
          {t(remarks ? 'manage-buq.add-remark' : 'manage-buq.add-source')}
        </Button>
      }
      description={t(
        remarks ? 'manage-buq.empty-description-remarks' : 'manage-buq.empty-description-sources',
      )}
      icon={<CoinsIcon />}
      title={t(remarks ? 'manage-buq.empty-title-remarks' : 'manage-buq.empty-title-sources')}
    />
  );
  const footer = !isPastLastPage && data.totalElements > 0 && <DataTablePagination table={table} />;
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
