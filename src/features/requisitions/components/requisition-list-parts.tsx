import type { HistoryState } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import type { RowData } from '@tanstack/react-table';
import type { ParseKeys, TFunction } from 'i18next';
import { EyeIcon } from 'lucide-react';
import type { ReactNode, Ref } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTable,
  type DataTableInstance,
  DataTableSkeleton,
} from '@/components/data-table/data-table';
import { CardActions, useInCards } from '@/components/display/card-actions';
import { TableCards, TableCardsSkeleton } from '@/components/display/table-cards';
import { WrappingCell } from '@/components/display/wrapping-cell';
import { formatDateValue, formatTimestamp } from '@/components/form/date-value';
import { FlagBadge } from '@/components/shared/flag-badge';
import { Button } from '@/components/ui/button';
import type { RequisitionSearch } from '@/features/requisitions/lib/search-facilities';
import type { ApprovalListRow, RequisitionSearchResult } from '@/features/requisitions/lib/types';
import { tableValue } from '@/lib/empty-value';

type ListRecord = ApprovalListRow | RequisitionSearchResult;
export const REQUISITION_LIST_COLUMNS = [
  ['program', 'requisitions.columns.program'],
  ['facility', 'requisitions.columns.facility'],
  ['period', 'requisitions.columns.period'],
  ['startDate', 'requisitions.columns.start-date'],
  ['endDate', 'requisitions.columns.end-date'],
] as const;
export const EMERGENCY_COLUMN = ['emergency', 'requisitions.columns.emergency'] as const;

export function hideableColumns<T extends readonly (readonly [string, ParseKeys])[]>(columns: T) {
  return columns
    .filter(([id]) => id !== 'program')
    .map(([id, labelKey]) => ({
      id,
      labelKey,
      ...((id === 'startDate' || id === 'endDate') && { hideBelow: 1024 }),
    }));
}
export function cardColumns<T extends readonly (readonly [string, ParseKeys])[]>(columns: T) {
  const ordered = [...columns];
  const facility = ordered.findIndex(([id]) => id === 'facility');
  const period = ordered.findIndex(([id]) => id === 'period');
  [ordered[facility], ordered[period]] = [ordered[period], ordered[facility]];
  return ordered;
}

export function requisitionListCell(
  id: string,
  record: ListRecord,
  language: string,
  timeZone: string,
  t: TFunction,
) {
  switch (id) {
    case 'program':
      return tableValue(record.program?.name) ? (
        <WrappingCell width="bounded">{record.program?.name}</WrappingCell>
      ) : null;
    case 'facility':
      return record.facility ? (
        <WrappingCell width="bounded">
          {[record.facility.code, record.facility.name].filter(Boolean).join(' - ')}
        </WrappingCell>
      ) : null;
    case 'period':
      return tableValue(record.processingPeriod?.name);
    case 'startDate':
    case 'endDate':
      return tableValue(formatDateValue(record.processingPeriod?.[id] ?? '', language));
    case 'createdDate':
      return tableValue(
        formatTimestamp('createdDate' in record ? record.createdDate : undefined, language, {
          timeZone,
        }),
      );
    case 'submittedDate':
    case 'authorizedDate':
      return 'extraData' in record && record.extraData?.originalRequisition
        ? t('requisitions.approve.not-applicable')
        : tableValue(
            formatTimestamp(
              'statusChanges' in record
                ? record.statusChanges?.[id === 'submittedDate' ? 'SUBMITTED' : 'AUTHORIZED']
                    ?.changeDate
                : undefined,
              language,
              { timeZone },
            ),
          );
    case 'emergency':
      return (
        <FlagBadge
          value={record.emergency}
          trueLabel={t('requisitions.yes')}
          falseLabel={t('requisitions.no')}
        />
      );
  }
}

export function ViewRequisition({
  record,
  linkProps,
  disabled,
  includeFacility = false,
}: {
  record: ListRecord;
  linkProps: { search: RequisitionSearch } | { state: HistoryState };
  disabled: boolean;
  includeFacility?: boolean;
}) {
  const { t } = useTranslation();
  const cards = useInCards();
  const name = t('requisitions.view.action-name', {
    program: record.program?.name ?? '',
    period: includeFacility
      ? [record.processingPeriod?.name, record.facility?.code, record.facility?.name]
          .filter(Boolean)
          .join(' - ')
      : (record.processingPeriod?.name ?? ''),
  });
  const link = (
    <Link
      aria-label={name}
      to="/requisitions/view/$requisitionId"
      params={{ requisitionId: record.id }}
      {...linkProps}
    />
  );
  if (cards)
    return (
      <CardActions
        label={t('card-actions.actions-for', {
          name: [record.program?.name, record.processingPeriod?.name].filter(Boolean).join(' - '),
        })}
        actions={[
          {
            id: 'view',
            icon: <EyeIcon />,
            label: t('requisitions.view.action'),
            name,
            link,
            disabled,
          },
        ]}
      />
    );
  return (
    <Button aria-label={name} disabled={disabled} nativeButton={false} render={link} size="sm">
      {t('requisitions.view.action')}
    </Button>
  );
}

export function RequisitionListTable<TData extends RowData>({
  cards,
  table,
  stale,
  empty,
  footer,
  listRef,
}: {
  cards: boolean;
  table: DataTableInstance<TData>;
  stale: boolean;
  empty: ReactNode;
  footer: ReactNode;
  listRef: Ref<HTMLUListElement>;
}) {
  return cards ? (
    <TableCards
      busy={stale}
      empty={empty}
      footer={footer}
      listRef={listRef}
      table={table}
      title="program"
    />
  ) : (
    <DataTable
      density="default"
      empty={empty}
      footer={footer}
      isStale={stale}
      layout="auto"
      table={table}
    />
  );
}

export function RequisitionListSkeleton<TData extends RowData>({
  cards,
  rowCount,
  table,
}: {
  cards: boolean;
  rowCount: number;
  table: DataTableInstance<TData>;
}) {
  return cards ? (
    <TableCardsSkeleton actions={1} rowCount={rowCount} table={table} title="program" />
  ) : (
    <DataTableSkeleton density="default" layout="auto" rowCount={rowCount} table={table} />
  );
}
