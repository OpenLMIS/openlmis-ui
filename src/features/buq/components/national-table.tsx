import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import {
  type ColumnVisibilityState,
  createColumnHelper,
  functionalUpdate,
} from '@tanstack/react-table';
import type { ParseKeys, TFunction } from 'i18next';
import { ClipboardCheckIcon, InfoIcon, Loader2Icon, StampIcon } from 'lucide-react';
import { type RefObject, useDeferredValue, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  DataTable,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableHeaderLabel,
  DataTableSkeleton,
} from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import {
  DataTableSelectionBar,
  SelectionBarLabel,
  selectionColumn,
} from '@/components/data-table/data-table-selection';
import type { ResponsiveColumn } from '@/components/data-table/responsive-columns';
import { ErrorAlert, serverMessage } from '@/components/display/dialog-parts';
import {
  RecordSummary,
  RecordSummaryField,
  RecordSummaryFieldSkeleton,
  RecordSummaryFields,
} from '@/components/display/record-summary';
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
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  NOTHING_PICKED,
  type Picked,
  toRowSelection,
  useFilterScoped,
  withoutIds,
} from '@/components/valid-assignments/selection';
import { type FinalApprovalSearch, finalApproveBuqs } from '@/features/buq/api/api';
import { buqsForFinalApprovalOptions } from '@/features/buq/api/queries';
import { buqStatusBadge } from '@/features/buq/components/buq-status-badge';
import { type BuqTableSelection, useBuqTable } from '@/features/buq/components/use-buq-table';
import { formatMoney } from '@/features/buq/lib/money';
import {
  COST_GROUP_IDS,
  type CostGroupId,
  type CostTotals,
  costTotals,
  type NationalRow,
  nationalFacilityIds,
  nationalRows,
} from '@/features/buq/lib/national';
import type { BuqTableProps } from '@/features/buq/lib/search';
import {
  currencySettingsOptions,
  facilitiesByIdsOptions,
} from '@/features/reference-data/api/queries';
import type { CurrencySettings } from '@/features/reference-data/lib/types';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { queryKeys } from '@/lib/key-factory';

const columnHelper = createColumnHelper<DataTableFeatures, NationalRow>();

const GROUP_LABELS: Record<CostGroupId | 'others', ParseKeys> = {
  pharmaceuticals: 'buq.national.pharmaceuticals',
  medical: 'buq.national.medical',
  radiology: 'buq.national.radiology',
  diagnostics: 'buq.national.diagnostics',
  dental: 'buq.national.dental',
  others: 'buq.national.others',
};

export const NATIONAL_HIDEABLE_COLUMNS: readonly (ResponsiveColumn & { labelKey: ParseKeys })[] = [
  { id: 'facilityType', labelKey: 'buq.approve.facility-type', hideBelow: 640 },
  { id: 'pharmaceuticals', labelKey: GROUP_LABELS.pharmaceuticals, hideBelow: 680 },
  { id: 'medical', labelKey: GROUP_LABELS.medical, hideBelow: 900 },
  { id: 'radiology', labelKey: GROUP_LABELS.radiology, hideBelow: 1150 },
  { id: 'diagnostics', labelKey: GROUP_LABELS.diagnostics, hideBelow: 1400 },
  { id: 'dental', labelKey: GROUP_LABELS.dental, hideBelow: 1610 },
];

const SUMMARY_IDS: readonly (CostGroupId | 'others')[] = [...COST_GROUP_IDS, 'others'];

const rowName = (t: TFunction, row: NationalRow) =>
  t('buq.national.row', { facility: row.facilityName, type: row.facilityType });

function StatusHeader() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1">
      <DataTableHeaderLabel>{t('buq.create.status')}</DataTableHeaderLabel>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button aria-label={t('buq.national.status-info')} size="icon-xs" variant="ghost" />
          }
        >
          <InfoIcon />
        </TooltipTrigger>
        <TooltipContent>{t('buq.national.status-info')}</TooltipContent>
      </Tooltip>
    </div>
  );
}

function createColumns(t: TFunction, currency: CurrencySettings | undefined, info: boolean) {
  const text = (id: 'facilityName' | 'facilityType', label: ParseKeys, className: string) =>
    columnHelper.accessor(id, {
      header: t(label),
      cell: ({ getValue }) =>
        getValue() && (
          <CellText overflow="clamp">
            <bdi>{getValue()}</bdi>
          </CellText>
        ),
      meta: { label: t(label), className },
    });
  return columnHelper.columns([
    selectionColumn((row: NationalRow) => rowName(t, row)),
    columnHelper.accessor('status', {
      header: () =>
        info ? (
          <StatusHeader />
        ) : (
          <DataTableHeaderLabel>{t('buq.create.status')}</DataTableHeaderLabel>
        ),
      cell: ({ getValue }) => buqStatusBadge(t, getValue()),
      meta: { label: t('buq.create.status') },
    }),
    text('facilityName', 'buq.approve.facility-name', 'min-w-48 w-64'),
    text('facilityType', 'buq.approve.facility-type', 'min-w-32 w-40'),
    ...COST_GROUP_IDS.map((id) =>
      columnHelper.accessor((row) => row.costs[id], {
        id,
        header: t(GROUP_LABELS[id]),
        cell: ({ getValue }) => {
          const value = getValue();
          return value == null || !currency ? '' : <bdi>{formatMoney(value, currency)}</bdi>;
        },
        meta: { label: t(GROUP_LABELS[id]) },
      }),
    ),
  ]);
}

type NationalTableProps = BuqTableProps & { visibility: ColumnVisibilityState };

const NO_ROWS: NationalRow[] = [];
const noop = () => {};

function useNationalTable(
  rows: readonly NationalRow[],
  { visibility, ...props }: NationalTableProps,
  currency?: CurrencySettings,
  selection?: BuqTableSelection,
) {
  const { t } = useTranslation();
  const info = !!selection;
  const columns = useMemo(() => createColumns(t, currency, info), [t, currency, info]);
  return useBuqTable(rows, columns, props, visibility, selection);
}

function NationalSummary({ totals, currency }: { totals: CostTotals; currency: CurrencySettings }) {
  const { t } = useTranslation();
  return (
    <RecordSummary aria-label={t('buq.national.summary')}>
      <RecordSummaryFields>
        {SUMMARY_IDS.map((id) => (
          <RecordSummaryField key={id} label={t(GROUP_LABELS[id])}>
            <bdi className="whitespace-nowrap">{formatMoney(totals[id], currency)}</bdi>
          </RecordSummaryField>
        ))}
      </RecordSummaryFields>
    </RecordSummary>
  );
}

export function NationalResultsSkeleton({
  cards,
  ...props
}: Pick<NationalTableProps, 'cards' | 'search' | 'visibility'>) {
  const { t } = useTranslation();
  const { table } = useNationalTable(NO_ROWS, { ...props, onSearchChange: noop, cards: false });
  return (
    <div aria-busy className="flex flex-col gap-4">
      <RecordSummary aria-busy>
        <RecordSummaryFields>
          {SUMMARY_IDS.map((id) => (
            <RecordSummaryFieldSkeleton key={id} label={t(GROUP_LABELS[id])} />
          ))}
        </RecordSummaryFields>
      </RecordSummary>
      {cards && <p className="text-muted-foreground text-sm">{t('buq.national.status-info')}</p>}
      {cards ? (
        <TableCardsSkeleton rowCount={1} table={table} title="facilityName" />
      ) : (
        <DataTableSkeleton layout="auto" rowCount={1} table={table} />
      )}
    </div>
  );
}

export function NationalResults({
  query,
  selectionSlot,
  ...props
}: NationalTableProps & { query: FinalApprovalSearch; selectionSlot: HTMLElement | null }) {
  const { t } = useTranslation();
  const listOptions = buqsForFinalApprovalOptions(query);
  const { data: items } = useSuspenseQuery(listOptions);
  const shownItems = useDeferredValue(items);
  const facilityIds = useMemo(() => nationalFacilityIds(shownItems), [shownItems]);
  const { data: facilities } = useSuspenseQuery(facilitiesByIdsOptions(facilityIds));
  const { data: currency } = useSuspenseQuery(currencySettingsOptions());
  const rows = useMemo(() => nationalRows(shownItems, facilities), [shownItems, facilities]);
  const totals = useMemo(() => costTotals(shownItems), [shownItems]);
  const scope = JSON.stringify(query);
  const [stored, setPicked] = useFilterScoped<Picked>(scope, NOTHING_PICKED);
  const [confirming, setConfirming] = useFilterScoped<Picked | undefined>(scope, undefined);
  const listRef = useRef<HTMLElement>(null);
  const names = useMemo(() => new Map(rows.map((row) => [row.id, rowName(t, row)])), [rows, t]);
  const picked = useMemo(
    () => new Map([...stored].filter(([id]) => names.has(id))),
    [stored, names],
  );
  const rowSelection = useMemo(() => toRowSelection(picked), [picked]);
  const { table, pageStart, isPastLastPage } = useNationalTable(rows, props, currency, {
    rowSelection,
    onRowSelectionChange: (updater) => {
      const next = functionalUpdate(updater, rowSelection);
      setPicked(new Map([...names].filter(([id]) => next[id])), scope);
    },
  });
  const footer = !isPastLastPage && rows.length > 0 && <DataTablePagination table={table} />;
  const empty = !isPastLastPage && (
    <DataTableEmpty
      description={t('buq.national.empty-description')}
      icon={<ClipboardCheckIcon />}
      title={t('buq.empty')}
    />
  );
  const selectAll = () => setPicked(new Map(names), scope);
  return (
    <section
      aria-label={t('buq.national.title')}
      className="flex flex-col gap-4 outline-none"
      ref={listRef}
      tabIndex={-1}
    >
      {rows.length > 0 && <NationalSummary currency={currency} totals={totals} />}
      {props.cards && rows.length > 0 && (
        <p className="text-muted-foreground text-sm">{t('buq.national.status-info')}</p>
      )}
      {props.cards ? (
        <TableCards
          empty={empty}
          footer={footer}
          listRef={pageStart.ref}
          table={table}
          title="facilityName"
        />
      ) : (
        <DataTable empty={empty} footer={footer} layout="auto" table={table} />
      )}
      {rows.length > 0 && !picked.size && (
        <div>
          <Button disabled size="lg" variant="outline">
            <StampIcon data-icon="inline-start" />
            {t('buq.national.final-approval')}
          </Button>
        </div>
      )}
      {selectionSlot &&
        createPortal(
          <DataTableSelectionBar
            count={picked.size}
            onClear={() => setPicked(NOTHING_PICKED, scope)}
            placement="footer"
          >
            <Button onClick={selectAll} size="lg" variant="outline">
              <SelectionBarLabel
                full={t('buq.national.select-all', { count: rows.length })}
                short={t('buq.national.select-all-short')}
              />
            </Button>
            <Button onClick={() => setConfirming(picked, scope)} size="lg">
              <SelectionBarLabel
                full={t('buq.national.final-approval')}
                short={t('buq.national.final-approval-short')}
              />
            </Button>
          </DataTableSelectionBar>,
          selectionSlot,
        )}
      <FinalApproveDialog
        focusAfterApproval={listRef}
        listQuery={query}
        onApproved={(ids, retry) => {
          setPicked(withoutIds(picked, ids), scope);
          if (retry && confirming) setConfirming(withoutIds(confirming, ids), scope);
        }}
        onClose={() => setConfirming(undefined, scope)}
        targets={confirming}
      />
    </section>
  );
}

function FinalApproveDialog({
  focusAfterApproval,
  listQuery,
  targets,
  onClose,
  onApproved,
}: {
  focusAfterApproval: RefObject<HTMLElement | null>;
  listQuery: FinalApprovalSearch;
  targets: Picked | undefined;
  onClose: () => void;
  onApproved: (ids: string[], retry: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { shown, close, dialogProps } = useDialogTarget(targets, onClose);
  const count = shown?.size ?? 0;
  const approve = useSessionMutation({
    mutationFn: async (ids: string[]) => {
      const fresh = await queryClient.fetchQuery({
        ...buqsForFinalApprovalOptions(listQuery),
        staleTime: 0,
      });
      const listed = new Set(fresh.map(({ bottomUpQuantification }) => bottomUpQuantification.id));
      const waiting = ids.filter((id) => listed.has(id));
      const result = await finalApproveBuqs(waiting);
      return { ...result, skipped: ids.length - waiting.length };
    },
    onSuccess: ({ approved, error, skipped }) => {
      onApproved(approved, !!error);
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.buq.all, 'detail'] });
      if (error) return;
      close();
      if (approved.length) {
        toast.success(t('buq.national.approved-title'), {
          description: t('buq.national.approved', { count: approved.length }),
        });
      }
      if (skipped) {
        toast.info(
          t(approved.length ? 'buq.national.skipped-title' : 'buq.national.none-approved-title'),
          {
            description: t(
              approved.length ? 'buq.national.skipped' : 'buq.national.none-approved',
              { count: skipped },
            ),
          },
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.buq.all, 'list'] });
    },
  });
  const failure = approve.isError ? approve.error : approve.data?.error;
  const partly = approve.data?.approved.length ?? 0;
  const reason = serverMessage(failure) ?? t('buq.national.approve-error');
  const props = dialogProps(approve.isPending);
  return (
    <AlertDialog
      {...props}
      onOpenChangeComplete={(next) => {
        props.onOpenChangeComplete(next);
        if (!next) approve.reset();
      }}
    >
      <AlertDialogContent
        finalFocus={() => {
          if (!approve.isSuccess || approve.data.error) return true;
          focusAfterApproval.current?.focus();
          return false;
        }}
        initialFocus={cancelRef}
      >
        <AlertDialogHeader>
          <AlertDialogMedia>
            <StampIcon />
          </AlertDialogMedia>
          <AlertDialogTitle>{t('buq.national.confirm-title', { count })}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('buq.national.confirm', { count, name: shown?.values().next().value ?? '' })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {failure != null && (
          <ErrorAlert
            description={
              partly ? `${t('buq.national.partly-approved', { count: partly })} ${reason}` : reason
            }
            title={
              partly
                ? t('buq.national.partly-approved-title')
                : t('buq.national.approve-error-title')
            }
          />
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={approve.isPending} ref={cancelRef}>
            {t('dialog.cancel')}
          </AlertDialogCancel>
          <Button
            disabled={approve.isPending}
            focusableWhenDisabled
            onClick={() => shown && approve.mutate([...shown.keys()])}
          >
            {approve.isPending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
            {t('buq.national.approve')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
