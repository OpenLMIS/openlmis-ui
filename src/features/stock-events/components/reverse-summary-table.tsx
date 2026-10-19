import { ArrowRightIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CardList, CardListItem, CardRows, CardToggleBand } from '@/components/card-list';
import { DataTableCard, DataTableHeaderLabel } from '@/components/data-table/data-table';
import { CONTAINER_WIDTHS, useElementWidth } from '@/components/data-table/responsive-columns';
import { SettingsItem } from '@/components/form/settings-list';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { StockEventLine } from '@/features/stock-events/lib/types';
import { EMPTY_VALUE, orEmpty, tableValue } from '@/lib/empty-value';
import { cardQuantity, type QuantityUnit } from '@/lib/quantity';
import { namedWithFreeText } from '@/lib/stock-labels';

type ReverseSummaryLine = {
  line: StockEventLine;
  reason?: { name: string } | null;
  comments?: string | null;
  current: number;
  balance?: number;
};
export function ReverseSummaryTable({
  rows,
  unit,
  confirmation = false,
  unavailable = false,
}: {
  rows: ReverseSummaryLine[];
  unit: QuantityUnit;
  confirmation?: boolean;
  unavailable?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [measure, width] = useElementWidth<HTMLDivElement>();
  const cards = width !== undefined && width < CONTAINER_WIDTHS['2xl'];
  const quantity = (value: number | undefined, line: StockEventLine) =>
    tableValue(cardQuantity(value, line.orderable.netContent, unit, i18n.language));
  const listId = useId();
  const [toggled, setToggled] = useState<ReadonlySet<number>>(new Set());
  const openByDefault = rows.length <= 3;
  const isOpen = (index: number) => toggled.has(index) !== openByDefault;
  const toggle = (index: number) =>
    setToggled((previous) => {
      const next = new Set(previous);
      if (!next.delete(index)) next.add(index);
      return next;
    });
  return (
    <div ref={measure}>
      {cards ? (
        <div className="flex flex-col gap-4">
          {unavailable && (
            <p className="text-muted-foreground text-sm">
              {t('stock-event-reverse.summary-unavailable')}
            </p>
          )}
          <CardList>
            {rows.map(({ line, reason, comments, current, balance }, index) => (
              <CardListItem key={line.stockEventLineItemId ?? index}>
                <CardToggleBand
                  controls={`${listId}-${index}`}
                  onToggle={() => toggle(index)}
                  open={isOpen(index)}
                >
                  <span className="min-w-0 flex-1 wrap-anywhere">
                    <bdi>
                      {line.orderable.fullProductName} ({line.orderable.productCode})
                    </bdi>
                  </span>
                  {confirmation ? (
                    <span className="flex shrink-0 items-center gap-1 tabular-nums">
                      <span className="sr-only">
                        {t('stock-event-reverse.current-stock-on-hand')}
                      </span>
                      <bdi>{quantity(current, line) ?? EMPTY_VALUE}</bdi>
                      <ArrowRightIcon aria-hidden className="size-3.5 rtl:rotate-180" />
                      <span className="sr-only">{t('stock-event-reverse.new-stock-on-hand')}</span>
                      <bdi>{quantity(balance, line) ?? EMPTY_VALUE}</bdi>
                    </span>
                  ) : (
                    <span className="shrink-0 tabular-nums">
                      <span className="sr-only">{t('stock-event.stock-on-hand')}</span>
                      <bdi>{quantity(current, line) ?? EMPTY_VALUE}</bdi>
                    </span>
                  )}
                </CardToggleBand>
                <div hidden={!isOpen(index)} id={`${listId}-${index}`}>
                  <CardRows>
                    <SettingsItem label={t('stock-event.lot-code')}>
                      <bdi>{orEmpty(line.lot?.lotCode ?? t('stock-event.no-lot'))}</bdi>
                    </SettingsItem>
                    <SettingsItem label={t('stock-event.reason')}>
                      <bdi>{orEmpty(namedWithFreeText(reason, comments))}</bdi>
                    </SettingsItem>
                    <SettingsItem label={t('stock-event.quantity')}>
                      <bdi>{quantity(line.quantity, line) ?? EMPTY_VALUE}</bdi>
                    </SettingsItem>
                    <SettingsItem
                      label={
                        confirmation ? (
                          t('stock-event-reverse.current-stock-on-hand')
                        ) : (
                          <strong>{t('stock-event.stock-on-hand')}</strong>
                        )
                      }
                    >
                      <bdi>
                        {confirmation ? (
                          (quantity(current, line) ?? EMPTY_VALUE)
                        ) : (
                          <strong>{quantity(current, line) ?? EMPTY_VALUE}</strong>
                        )}
                      </bdi>
                    </SettingsItem>
                    {confirmation && (
                      <SettingsItem
                        label={<strong>{t('stock-event-reverse.new-stock-on-hand')}</strong>}
                      >
                        <bdi>
                          <strong>{quantity(balance, line) ?? EMPTY_VALUE}</strong>
                        </bdi>
                      </SettingsItem>
                    )}
                  </CardRows>
                </div>
              </CardListItem>
            ))}
          </CardList>
        </div>
      ) : (
        <DataTableCard>
          <Table density="default" layout="auto">
            {unavailable && (
              <TableCaption>{t('stock-event-reverse.summary-unavailable')}</TableCaption>
            )}
            <TableHeader surface="muted">
              <TableRow>
                <TableHead>
                  <DataTableHeaderLabel>{t('stock-event.product')}</DataTableHeaderLabel>
                </TableHead>
                <TableHead>
                  <DataTableHeaderLabel>{t('stock-event.lot-code')}</DataTableHeaderLabel>
                </TableHead>
                <TableHead>
                  <DataTableHeaderLabel>{t('stock-event.reason')}</DataTableHeaderLabel>
                </TableHead>
                <TableHead>
                  <DataTableHeaderLabel>{t('stock-event.quantity')}</DataTableHeaderLabel>
                </TableHead>
                <TableHead>
                  <DataTableHeaderLabel>
                    {t(
                      confirmation
                        ? 'stock-event-reverse.current-stock-on-hand'
                        : 'stock-event.stock-on-hand',
                    )}
                  </DataTableHeaderLabel>
                </TableHead>
                {confirmation && (
                  <TableHead>
                    <DataTableHeaderLabel>
                      {t('stock-event-reverse.new-stock-on-hand')}
                    </DataTableHeaderLabel>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ line, reason, comments, current, balance }, index) => (
                <TableRow key={line.stockEventLineItemId ?? index}>
                  <TableCell>
                    <span className="whitespace-nowrap">
                      <bdi>{line.orderable.fullProductName}</bdi>{' '}
                      <bdi className="whitespace-nowrap">({line.orderable.productCode})</bdi>
                    </span>
                  </TableCell>
                  <TableCell>
                    <bdi className="whitespace-nowrap">
                      {line.lot?.lotCode ?? t('stock-event.no-lot')}
                    </bdi>
                  </TableCell>
                  <TableCell>
                    <span className="whitespace-nowrap">
                      {tableValue(namedWithFreeText(reason, comments))}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="whitespace-nowrap" dir="ltr">
                      {quantity(line.quantity, line)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="whitespace-nowrap" dir="ltr">
                      {quantity(current, line)}
                    </span>
                  </TableCell>
                  {confirmation && (
                    <TableCell>
                      <span className="whitespace-nowrap" dir="ltr">
                        {quantity(balance, line)}
                      </span>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableCard>
      )}
    </div>
  );
}
