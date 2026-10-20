import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { CardBand, CardList, CardListItem, CardRows } from '@/components/card-list';
import { DataTableCard, DataTableHeaderLabel } from '@/components/data-table/data-table';
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
    'device-events.lots',
    'device-events.quantity',
    ...(config.reasons ? (['device-events.reason', 'stock-events.reason-comments'] as const) : []),
    ...(counterparty ? [counterparty.column, counterparty.comments] : []),
    'device-events.occurred-date',
    'stock-events.vvm-status',
  ];
  const lines = event.payload.lineItems.map((item, index) => {
    const line = event.lines[index];
    const values: Partial<Record<ParseKeys, string | null | undefined>> = {
      'device-events.lots': line?.lot?.lotCode,
      'device-events.quantity': new Intl.NumberFormat(i18n.language).format(item.quantity),
      'device-events.reason': event.reasons?.find((reason) => reason.id === item.reasonId)?.name,
      'stock-events.reason-comments': item.reasonFreeText,
      'device-events.occurred-date': item.occurredDate
        ? formatDateValue(item.occurredDate, i18n.language)
        : undefined,
      'stock-events.vvm-status': item.extraData?.vvmStatus
        ? vvmItems(t).find((entry) => entry.value === item.extraData?.vvmStatus)?.label
        : undefined,
    };
    if (counterparty) {
      const destination = config.counterparty === 'destination';
      values[counterparty.column] = (destination ? event.destinations : event.sources)?.find(
        (entry) => entry.id === (destination ? item.destinationId : item.sourceId),
      )?.name;
      values[counterparty.comments] = destination ? item.destinationFreeText : item.sourceFreeText;
    }
    return {
      key: line?.key ?? index,
      product: line?.orderable.fullProductName || item.orderableId,
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
                  <SettingsItem key={header} label={t(header)}>
                    <span
                      className={header === 'device-events.lots' ? 'break-all' : undefined}
                      dir="auto"
                    >
                      {orEmpty(line.values[index])}
                    </span>
                  </SettingsItem>
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
                  ['device-events.products', ...visibleHeaders.map(({ header }) => header)] as const
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
                          header === 'device-events.lots'
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
