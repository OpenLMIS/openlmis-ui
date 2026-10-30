import { createColumnHelper, useTable } from '@tanstack/react-table';
import { ArrowRightIcon, ClipboardListIcon } from 'lucide-react';
import { type ReactElement, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  DataTableEmpty,
  type DataTableFeatures,
  DataTableHeaderLabel,
  DataTableSkeleton,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { CardActions, useInCards } from '@/components/display/card-actions';
import { TableCards, TableCardsSkeleton } from '@/components/display/table-cards';
import { formatDateValue } from '@/components/form/date-value';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import type { InitiateRow } from '@/features/requisitions/lib/initiate';
import { REQUISITION_STATUS } from '@/lib/requisition-status';

const helper = createColumnHelper<DataTableFeatures, InitiateRow>();
const NO_ROWS: InitiateRow[] = [];
const rowId = (row: InitiateRow) => row.requisitionId ?? row.id;
type Props = {
  rows: InitiateRow[];
  cards: boolean;
  pending?: string;
  disabled?: boolean;
  onStart: (row: InitiateRow) => void;
  openLink: (id: string) => ReactElement;
};
function Proceed({
  row,
  pending,
  disabled,
  onStart,
  openLink,
}: Omit<Props, 'rows' | 'cards'> & { row: InitiateRow }) {
  const { t } = useTranslation();
  const cards = useInCards();
  if (!row.action) return null;
  const name = t('requisitions.initiate.proceed-label', { period: row.name });
  const busy = pending === rowId(row);
  const link = row.requisitionId ? openLink(row.requisitionId) : undefined;
  if (cards)
    return (
      <CardActions
        label={t('card-actions.actions-for', { name: row.name })}
        actions={[
          {
            id: 'proceed',
            icon: busy ? <Spinner /> : <ArrowRightIcon className="rtl:rotate-180" />,
            label: t('requisitions.initiate.proceed'),
            name,
            link,
            disabled,
            onSelect: link ? undefined : () => onStart(row),
          },
        ]}
      />
    );
  return (
    <Button
      aria-label={name}
      disabled={disabled}
      nativeButton={!link}
      render={link}
      size="sm"
      onClick={link ? undefined : () => onStart(row)}
    >
      {busy && <Spinner data-icon="inline-start" />}
      {t('requisitions.initiate.proceed')}
    </Button>
  );
}
function usePeriodsTable(props: Props) {
  const { t, i18n } = useTranslation();
  const { rows, pending, disabled, onStart, openLink } = props;
  const columns = useMemo(
    () =>
      helper.columns([
        helper.display({
          id: 'period',
          meta: { label: t('requisitions.initiate.period') },
          header: () => (
            <DataTableHeaderLabel>{t('requisitions.initiate.period')}</DataTableHeaderLabel>
          ),
          cell: ({ row }) => row.original.name,
        }),
        ...(['startDate', 'endDate'] as const).map((id) => {
          const label = t(
            id === 'startDate'
              ? 'requisitions.columns.start-date'
              : 'requisitions.columns.end-date',
          );
          return helper.display({
            id,
            meta: { label },
            header: () => <DataTableHeaderLabel>{label}</DataTableHeaderLabel>,
            cell: ({ row }) => formatDateValue(row.original[id], i18n.language),
          });
        }),
        helper.display({
          id: 'status',
          meta: { label: t('requisitions.initiate.status') },
          header: () => (
            <DataTableHeaderLabel>{t('requisitions.initiate.status')}</DataTableHeaderLabel>
          ),
          cell: ({ row }) => {
            const status = row.original.status;
            if (status === 'not-started' || status === 'previous-pending')
              return (
                <span className="text-muted-foreground">
                  {t(
                    status === 'not-started'
                      ? 'requisitions.initiate.not-started'
                      : 'requisitions.initiate.previous-pending',
                  )}
                </span>
              );
            const config = REQUISITION_STATUS[status];
            if (!config) return status;
            const Icon = config.icon;
            return (
              <Badge variant={config.tone}>
                <Icon data-icon="inline-start" />
                {t(config.labelKey)}
              </Badge>
            );
          },
        }),
        helper.display({
          id: 'actions',
          meta: { label: t('requisitions.columns.actions'), skeleton: 'control' },
          header: () => (
            <DataTableHeaderLabel>{t('requisitions.columns.actions')}</DataTableHeaderLabel>
          ),
          cell: ({ row }) => (
            <Proceed
              row={row.original}
              pending={pending}
              disabled={disabled}
              onStart={onStart}
              openLink={openLink}
            />
          ),
        }),
      ]),
    [t, i18n.language, pending, disabled, onStart, openLink],
  );
  return useTable({
    features: dataTableFeatures,
    columns,
    data: rows,
    getRowId: rowId,
    manualPagination: true,
    manualSorting: true,
  });
}
export function InitiatePeriodsTable(props: Props) {
  const { t } = useTranslation();
  const table = usePeriodsTable(props);
  const empty = (
    <DataTableEmpty
      icon={<ClipboardListIcon />}
      title={t('requisitions.initiate.no-periods-title')}
      description={t('requisitions.initiate.no-periods')}
    />
  );
  return props.cards ? (
    <TableCards table={table} title="period" empty={empty} />
  ) : (
    <DataTable table={table} empty={empty} />
  );
}
const noop = () => {};
export function InitiatePeriodsSkeleton({ cards }: { cards: boolean }) {
  const table = usePeriodsTable({ rows: NO_ROWS, cards, onStart: noop, openLink: () => <span /> });
  return cards ? (
    <TableCardsSkeleton table={table} rowCount={10} pagination={false} title="period" actions={1} />
  ) : (
    <DataTableSkeleton table={table} rowCount={10} pagination="none" />
  );
}
