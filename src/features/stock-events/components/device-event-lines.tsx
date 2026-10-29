import type { ParseKeys } from 'i18next';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableCard, DataTableHeaderLabel } from '@/components/data-table/data-table';
import { CardBand, CardList, CardListItem, CardRows } from '@/components/display/card-list';
import { formatDateValue } from '@/components/form/date-value';
import { SettingsItem } from '@/components/form/settings-list';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { deviceEventDetails } from '@/features/stock-events/lib/device-event-details';
import {
  COUNTERPARTY,
  EVENT_KINDS,
  type EventKindConfig,
} from '@/features/stock-events/lib/event-kinds';
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';
import { vvmItems } from '@/features/stock-events/lib/vvm-items';
import { useCardLayout } from '@/hooks/use-card-view';
import { orEmpty, tableValue } from '@/lib/empty-value';

export function DeviceEventLines({ event }: { event: DeviceEvent }) {
  const { t, i18n } = useTranslation();
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  const config: EventKindConfig = EVENT_KINDS[event.kind];
  const counterparty = config.counterparty === 'none' ? null : COUNTERPARTY[config.counterparty];
  const headers: ParseKeys[] = [
    'offline-events.lot',
    'offline-events.quantity',
    ...(config.reasons ? (['offline-events.reason', 'stock-events.reason-comments'] as const) : []),
    ...(counterparty ? [counterparty.column, counterparty.comments] : []),
    'offline-events.occurred-date',
    'stock-events.vvm-status',
  ];
  const lines = deviceEventDetails(event).map((line) => {
    const { item } = line;
    const values: Partial<Record<ParseKeys, string | null | undefined>> = {
      'offline-events.lot':
        line.lotCode ??
        t(line.productHasLots ? 'stock-events.no-lot-defined' : 'stock-events.product-has-no-lots'),
      'offline-events.quantity': new Intl.NumberFormat(i18n.language).format(item.quantity),
      'offline-events.reason': line.reason,
      'stock-events.reason-comments': item.reasonFreeText,
      'offline-events.occurred-date': item.occurredDate
        ? formatDateValue(item.occurredDate, i18n.language)
        : undefined,
      'stock-events.vvm-status': item.extraData?.vvmStatus
        ? vvmItems(t).find((entry) => entry.value === item.extraData?.vvmStatus)?.label
        : undefined,
    };
    if (counterparty) {
      values[counterparty.column] = line.counterparty;
      values[counterparty.comments] =
        config.counterparty === 'destination' ? item.destinationFreeText : item.sourceFreeText;
    }
    return {
      key: line.key,
      product: line.product,
      values: headers.map((header) => values[header]),
    };
  });
  const visibleHeaders = headers
    .map((header, index) => ({ header, index }))
    .filter(
      ({ header, index }) =>
        ![
          'stock-events.reason-comments',
          'stock-events.vvm-status',
          ...(counterparty ? [counterparty.comments] : []),
        ].includes(header) ||
        lines.some((line) => line.values[index] != null && line.values[index] !== ''),
    );
  return (
    <div className="min-w-0 shrink-0" ref={measure}>
      {cards ? (
        <CardList>
          {lines.map((line) => (
            <CardListItem key={line.key} surface="flat">
              <CardBand>
                <span dir="auto">{line.product}</span>
              </CardBand>
              <CardRows>
                {visibleHeaders.map(({ header, index }) => (
                  <EventDetailItem key={header} label={t(header)}>
                    <span
                      className={header === 'offline-events.lot' ? 'break-all' : undefined}
                      dir="auto"
                    >
                      {orEmpty(line.values[index])}
                    </span>
                  </EventDetailItem>
                ))}
              </CardRows>
            </CardListItem>
          ))}
        </CardList>
      ) : (
        <DataTableCard>
          <Table layout="auto" density="compact">
            <TableHeader>
              <TableRow>
                {(
                  ['offline-events.product', ...visibleHeaders.map(({ header }) => header)] as const
                ).map((header) => (
                  <TableHead key={header}>
                    <DataTableHeaderLabel>{t(header)}</DataTableHeaderLabel>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.key}>
                  <TableCell>
                    <span dir="auto">{line.product}</span>
                  </TableCell>
                  {visibleHeaders.map(({ header, index }) => (
                    <TableCell key={header}>
                      <span
                        className={
                          header === 'offline-events.lot'
                            ? 'whitespace-nowrap'
                            : 'whitespace-pre-wrap'
                        }
                        dir="auto"
                      >
                        {tableValue(line.values[index])}
                      </span>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableCard>
      )}
    </div>
  );
}

export function EventDetailItem({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <SettingsItem label={<span className="text-muted-foreground">{label}</span>}>
      {children}
    </SettingsItem>
  );
}
