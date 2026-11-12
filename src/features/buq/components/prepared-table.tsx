import { useQueryClient } from '@tanstack/react-query';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { CalculatorIcon, DownloadIcon, Loader2Icon, Trash2Icon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  DataTable,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableHeaderLabel,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { RowActions } from '@/components/display/card-actions';
import { ErrorAlert, serverMessage } from '@/components/display/dialog-parts';
import { CellText, TableCards, TableCardsSkeleton } from '@/components/display/table-cards';
import { useDialogTarget } from '@/components/form-dialog/use-dialog-target';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BUQ_CSV_FILENAME, deleteBuq, downloadBuq } from '@/features/buq/api/api';
import { BUQ_STATUS } from '@/features/buq/lib/buq-status';
import { DEFAULT_PREPARED_SORT, type PrepareSearch } from '@/features/buq/lib/search';
import type { Buq, BuqPeriod, NamedItem } from '@/features/buq/lib/types';
import { usePagedTableSearch } from '@/hooks/use-page-start';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { downloadFile } from '@/lib/download-file';
import { queryKeys } from '@/lib/key-factory';
import { type SearchChange, toPaginationState } from '@/lib/table-search';

type BuqRow = Buq & { periodName: string };

type RowHandlers = {
  downloading: string | undefined;
  onDownload: (buq: BuqRow) => void;
  onDelete: (buq: BuqRow) => void;
};

const columnHelper = createColumnHelper<DataTableFeatures, BuqRow>();

function createColumns(t: TFunction, facility: NamedItem, handlers: RowHandlers) {
  return columnHelper.columns([
    columnHelper.display({
      id: 'facility',
      header: t('buq.prepare.facility-name'),
      cell: () => <CellText overflow="clamp">{facility.name}</CellText>,
      meta: { label: t('buq.prepare.facility-name') },
    }),
    columnHelper.accessor('targetYear', {
      header: t('buq.prepare.forecasted-period'),
      meta: { label: t('buq.prepare.forecasted-period') },
    }),
    columnHelper.accessor('periodName', {
      header: t('buq.prepare.quantification-period'),
      cell: ({ getValue }) => <CellText overflow="clamp">{getValue()}</CellText>,
      meta: { label: t('buq.prepare.quantification-period') },
    }),
    columnHelper.accessor('status', {
      header: t('buq.prepare.status'),
      cell: ({ getValue }) => {
        const { labelKey, tone, icon: Icon } = BUQ_STATUS[getValue()];
        return (
          <Badge variant={tone}>
            <Icon data-icon="inline-start" />
            {t(labelKey)}
          </Badge>
        );
      },
      meta: { label: t('buq.prepare.status') },
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <DataTableHeaderLabel>{t('buq.prepare.actions')}</DataTableHeaderLabel>,
      meta: { className: 'w-24', skeleton: 'control' },
      cell: ({ row }) => (
        <RowActions
          actions={[
            {
              id: 'download',
              icon:
                handlers.downloading === row.original.id ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <DownloadIcon />
                ),
              label: t('buq.prepare.download'),
              disabled: handlers.downloading !== undefined,
              focusableWhenDisabled: handlers.downloading === row.original.id,
              onSelect: () => handlers.onDownload(row.original),
            },
            {
              id: 'delete',
              icon: <Trash2Icon />,
              label: t('buq.prepare.delete'),
              destructive: true,
              onSelect: () => handlers.onDelete(row.original),
            },
          ]}
          label={t('buq.prepare.actions-for', {
            period: row.original.periodName,
            year: row.original.targetYear,
          })}
        />
      ),
    }),
  ]);
}

const getRowId = (row: BuqRow) => row.id;
const NO_ROWS: BuqRow[] = [];
const IDLE: RowHandlers = { downloading: undefined, onDownload: () => {}, onDelete: () => {} };
const SKELETON_FACILITY: NamedItem = { id: '', name: '' };
const noop = () => {};

type PagedTableProps = {
  search: PrepareSearch;
  onSearchChange: SearchChange<PrepareSearch>;
  cards: boolean;
};

function useBuqTable(
  rows: readonly BuqRow[],
  facility: NamedItem,
  handlers: RowHandlers,
  { search, onSearchChange, cards }: PagedTableProps,
) {
  const { t } = useTranslation();
  const columns = useMemo(() => createColumns(t, facility, handlers), [t, facility, handlers]);
  const { pageIndex, pageSize } = toPaginationState(search);
  const data = useMemo(
    () => rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [rows, pageIndex, pageSize],
  );
  const { pageStart, searchState } = usePagedTableSearch({
    search,
    defaultSort: DEFAULT_PREPARED_SORT,
    onSearchChange,
    cards,
  });
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId,
    rowCount: rows.length,
    manualPagination: true,
    manualSorting: true,
    enableSorting: false,
    ...searchState,
  });
  return { table, pageStart };
}

export function PreparedTableSkeleton({
  cards,
  search,
}: {
  cards: boolean;
  search: PrepareSearch;
}) {
  const { table } = useBuqTable(NO_ROWS, SKELETON_FACILITY, IDLE, {
    search,
    onSearchChange: noop,
    cards: false,
  });
  if (cards) {
    return <TableCardsSkeleton actions={2} rowCount={1} table={table} title="periodName" />;
  }
  return <DataTableSkeleton rowCount={1} table={table} />;
}

export function PreparedTable({
  buqs,
  periods,
  facility,
  cards,
  search,
  onSearchChange,
}: PagedTableProps & {
  buqs: readonly Buq[];
  periods: readonly BuqPeriod[];
  facility: NamedItem;
}) {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState<BuqRow>();
  const rows = useMemo(() => {
    const byId = new Map(periods.map((period) => [period.id, period]));
    return buqs
      .map((buq) => ({ ...buq, period: byId.get(buq.processingPeriodId) }))
      .toSorted(
        (a, b) =>
          a.targetYear - b.targetYear ||
          (a.period?.startDate ?? '').localeCompare(b.period?.startDate ?? ''),
      )
      .map(({ period, ...buq }) => ({ ...buq, periodName: period?.name ?? '' }));
  }, [buqs, periods]);
  const download = useSessionMutation({
    mutationFn: downloadBuq,
    onSuccess: (blob, id) => {
      downloadFile(blob, BUQ_CSV_FILENAME);
      toast.success(t('buq.prepare.downloaded-title'), {
        description: t('buq.prepare.downloaded', {
          period: rows.find((row) => row.id === id)?.periodName ?? '',
        }),
      });
    },
    onError: (error) =>
      toast.error(t('buq.prepare.download-error-title'), {
        description: serverMessage(error) ?? t('buq.prepare.download-error'),
      }),
  });
  const handlers = useMemo<RowHandlers>(
    () => ({
      downloading: download.isPending ? download.variables : undefined,
      onDownload: (buq) => download.mutate(buq.id),
      onDelete: setDeleting,
    }),
    [download.isPending, download.variables, download.mutate],
  );
  const { table, pageStart } = useBuqTable(rows, facility, handlers, {
    search,
    onSearchChange,
    cards,
  });
  const pageCount = table.getPageCount();
  const isPastLastPage = rows.length > 0 && toPaginationState(search).pageIndex >= pageCount;

  useEffect(() => {
    if (isPastLastPage) onSearchChange({ page: pageCount > 1 ? pageCount : undefined }, true);
  }, [isPastLastPage, pageCount, onSearchChange]);

  const footer = !isPastLastPage && rows.length > 0 && <DataTablePagination table={table} />;
  const empty = !isPastLastPage && (
    <DataTableEmpty
      description={t('buq.prepare.empty-description')}
      icon={<CalculatorIcon />}
      title={t('buq.prepare.empty')}
    />
  );

  return (
    <>
      {cards ? (
        <TableCards
          empty={empty}
          footer={footer}
          listRef={pageStart.ref}
          table={table}
          title="periodName"
        />
      ) : (
        <DataTable empty={empty} footer={footer} table={table} />
      )}
      <DeleteBuqDialog buq={deleting} onClose={() => setDeleting(undefined)} />
    </>
  );
}

function DeleteBuqDialog({ buq, onClose }: { buq: BuqRow | undefined; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { shown, close, dialogProps } = useDialogTarget(buq, onClose);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const remove = useSessionMutation({
    mutationFn: deleteBuq,
    onSuccess: () => {
      toast.success(t('buq.prepare.deleted-title'), {
        description: t('buq.prepare.deleted', { period: shown?.periodName ?? '' }),
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: [...queryKeys.buq.all, 'list'] }),
  });
  const props = dialogProps(remove.isPending);

  return (
    <AlertDialog
      {...props}
      onOpenChangeComplete={(next) => {
        props.onOpenChangeComplete(next);
        if (!next) remove.reset();
      }}
    >
      <AlertDialogContent initialFocus={cancelRef}>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2Icon />
          </AlertDialogMedia>
          <AlertDialogTitle>{t('buq.prepare.delete-title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('buq.prepare.delete-description', { period: shown?.periodName ?? '' })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {remove.isError && (
          <ErrorAlert
            description={serverMessage(remove.error) ?? t('buq.prepare.delete-error')}
            title={t('buq.prepare.delete-error-title')}
          />
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending} ref={cancelRef}>
            {t('dialog.cancel')}
          </AlertDialogCancel>
          <Button
            disabled={remove.isPending}
            focusableWhenDisabled
            onClick={() => shown && remove.mutate(shown.id, { onSuccess: close })}
            variant="destructive"
          >
            {remove.isPending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
            {t('buq.prepare.delete')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
