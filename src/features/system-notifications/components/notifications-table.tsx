import { useSuspenseQuery } from '@tanstack/react-query';
import { type ColumnVisibilityState, createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { BellIcon, PencilIcon, SearchXIcon } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableHeaderLabel,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { RowActions, useInCards } from '@/components/display/card-actions';
import { CellText, TableCards, TableCardsSkeleton } from '@/components/display/table-cards';
import { formatTimestamp } from '@/components/form/date-value';
import { FlagBadge } from '@/components/shared/flag-badge';
import { Button } from '@/components/ui/button';
import { notificationsPageOptions } from '@/features/system-notifications/api/queries';
import { isDisplayed } from '@/features/system-notifications/lib/displayed';
import {
  CLEARED_NOTIFICATION_FILTERS,
  type NotificationsSearch,
  toNotificationsQuery,
} from '@/features/system-notifications/lib/search';
import type { SystemNotification } from '@/features/system-notifications/lib/types';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { usePagedTableSearch } from '@/hooks/use-page-start';
import { type SearchChange, toPaginationState } from '@/lib/table-search';
import { fullName } from '@/lib/text';

const columnHelper = createColumnHelper<DataTableFeatures, SystemNotification>();
const NO_NOTIFICATIONS: SystemNotification[] = [];
const NO_SORT = { id: 'title', desc: false };
const noop = () => {};
const getRowId = (notification: SystemNotification) => notification.id;

function notificationLabel({ title, message }: SystemNotification) {
  return title?.trim() || message.trim().split('\n', 1)[0].slice(0, 80);
}

function NotificationTitle({ notice }: { notice: SystemNotification }) {
  const inCards = useInCards();
  return <CellText strong>{inCards ? notificationLabel(notice) : notice.title}</CellText>;
}

function createColumns(
  t: TFunction,
  language: string,
  timeZone: string,
  onEdit: (id: string) => void,
) {
  const labeled = (label: string, className?: string) => ({
    header: () => <DataTableHeaderLabel>{label}</DataTableHeaderLabel>,
    enableSorting: false,
    meta: { label, className },
  });

  return columnHelper.columns([
    columnHelper.accessor('title', {
      ...labeled(t('system-notifications.admin.title'), 'w-1/5'),
      cell: ({ row }) => <NotificationTitle notice={row.original} />,
    }),
    columnHelper.accessor((notice) => (notice.author ? fullName(notice.author) : ''), {
      ...labeled(t('system-notifications.admin.author'), 'w-1/6'),
      id: 'author',
      cell: ({ getValue }) => (getValue() ? <CellText>{getValue()}</CellText> : null),
    }),
    columnHelper.accessor('createdDate', {
      ...labeled(t('system-notifications.admin.created-date'), 'w-28 @4xl/main:w-36'),
      cell: ({ getValue }) => formatTimestamp(getValue(), language, { timeZone }),
    }),
    columnHelper.accessor('active', {
      ...labeled(t('system-notifications.admin.active'), 'w-24'),
      cell: ({ getValue }) => (
        <FlagBadge
          falseLabel={t('system-notifications.admin.inactive')}
          trueLabel={t('system-notifications.admin.active')}
          value={getValue()}
        />
      ),
    }),
    columnHelper.display({
      ...labeled(t('system-notifications.admin.is-displayed'), 'w-32'),
      id: 'displayed',
      cell: ({ row }) => (
        <FlagBadge
          falseLabel={t('system-notifications.admin.not-displayed')}
          trueLabel={t('system-notifications.admin.displayed')}
          value={isDisplayed(row.original, Date.now())}
        />
      ),
    }),
    columnHelper.accessor('message', {
      ...labeled(t('system-notifications.admin.message')),
      cell: ({ getValue }) => <CellText overflow="wrap">{getValue()}</CellText>,
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <DataTableHeaderLabel>{t('data-table.actions')}</DataTableHeaderLabel>,
      meta: { className: 'w-24', skeleton: 'control' },
      cell: ({ row }) => {
        const notification = notificationLabel(row.original);
        return (
          <RowActions
            actions={[
              {
                id: 'edit',
                icon: <PencilIcon />,
                label: t('system-notifications.admin.edit'),
                name: t('system-notifications.admin.edit-name', { notification }),
                onSelect: () => onEdit(row.original.id),
              },
            ]}
            label={t('system-notifications.admin.actions-for', { notification })}
          />
        );
      },
    }),
  ]);
}

type NotificationsTableProps = {
  cards: boolean;
  search: NotificationsSearch;
  onSearchChange: SearchChange<NotificationsSearch>;
  columnVisibility: ColumnVisibilityState;
  onEdit: (id: string) => void;
};

function useNotificationsTable({
  cards,
  search,
  onSearchChange,
  columnVisibility,
  onEdit,
  data,
  rowCount,
  timeZone,
}: NotificationsTableProps & {
  data: SystemNotification[];
  rowCount: number;
  timeZone: string;
}) {
  const { t, i18n } = useTranslation();
  const columns = useMemo(
    () => createColumns(t, i18n.language, timeZone, onEdit),
    [t, i18n.language, timeZone, onEdit],
  );
  const { pageStart, searchState } = usePagedTableSearch({
    search,
    defaultSort: NO_SORT,
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
    enableSorting: false,
    ...searchState,
    state: { ...searchState.state, columnVisibility },
  });
  return { table, pageStart };
}

export function NotificationsTableSkeleton({
  cards,
  search,
  columnVisibility,
}: Pick<NotificationsTableProps, 'cards' | 'search' | 'columnVisibility'>) {
  const { table } = useNotificationsTable({
    cards: false,
    data: NO_NOTIFICATIONS,
    rowCount: 0,
    search,
    columnVisibility,
    onSearchChange: noop,
    onEdit: noop,
    timeZone: 'UTC',
  });
  const rowCount = toPaginationState(search).pageSize;
  if (cards) return <TableCardsSkeleton rowCount={rowCount} table={table} title="title" />;
  return <DataTableSkeleton rowCount={rowCount} table={table} />;
}

export function NotificationsTable({
  cards,
  search,
  onSearchChange,
  columnVisibility,
  onEdit,
}: NotificationsTableProps) {
  const { t } = useTranslation();
  const deferredSearch = useDeferredValue(search);
  const { data } = useSuspenseQuery(notificationsPageOptions(toNotificationsQuery(deferredSearch)));
  const timeZone = useDeploymentTimeZone();
  const { table, pageStart } = useNotificationsTable({
    cards,
    data: data.content,
    rowCount: data.totalElements,
    search: deferredSearch,
    onSearchChange,
    columnVisibility,
    onEdit,
    timeZone,
  });
  const isStale = search !== deferredSearch;
  const isPastLastPage = (deferredSearch.page ?? 1) > Math.max(1, data.totalPages);

  useEffect(() => {
    if (!isStale && isPastLastPage) {
      onSearchChange({ page: data.totalPages > 1 ? data.totalPages : undefined }, true);
    }
  }, [isStale, isPastLastPage, data.totalPages, onSearchChange]);

  const empty =
    deferredSearch.authorId || deferredSearch.displayed ? (
      <DataTableEmpty
        action={
          <Button
            onClick={() => onSearchChange(CLEARED_NOTIFICATION_FILTERS, true)}
            variant="destructive"
          >
            {t('data-table.clear-filters')}
          </Button>
        }
        description={t('system-notifications.admin.no-results-description')}
        icon={<SearchXIcon />}
        title={t('system-notifications.admin.no-results-title')}
      />
    ) : (
      <DataTableEmpty icon={<BellIcon />} title={t('system-notifications.admin.empty-title')} />
    );

  const footer = !isPastLastPage && data.totalElements > 0 && <DataTablePagination table={table} />;
  if (cards) {
    return (
      <TableCards
        busy={isStale}
        empty={!isPastLastPage && empty}
        footer={footer}
        listRef={pageStart.ref}
        table={table}
        title="title"
      />
    );
  }
  return (
    <DataTable empty={!isPastLastPage && empty} footer={footer} isStale={isStale} table={table} />
  );
}
