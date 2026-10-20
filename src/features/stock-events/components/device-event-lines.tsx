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
import type { DeviceEvent } from '@/features/stock-events/lib/stock-event-sync';
import { useCardLayout } from '@/hooks/use-card-view';
import { orEmpty, tableValue } from '@/lib/empty-value';

export function DeviceEventLines({ event }: { event: DeviceEvent }) {
  const { t, i18n } = useTranslation();
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  const headers = [
    'device-events.lots',
    'device-events.quantity',
    'device-events.reason',
    'stock-events.reason-comments',
    'device-events.occurred-date',
    'stock-events.vvm-status',
  ] as const;
  const lines = event.payload.lineItems.map((item, index) => ({
    key: event.lines[index]?.key ?? index,
    product: event.lines[index]?.orderable.fullProductName || item.orderableId,
    values: [
      event.lines[index]?.lot?.lotCode,
      new Intl.NumberFormat(i18n.language).format(item.quantity),
      event.reasons?.find((reason) => reason.id === item.reasonId)?.name,
      item.reasonFreeText,
      item.occurredDate ? formatDateValue(item.occurredDate, i18n.language) : undefined,
      item.extraData?.vvmStatus,
    ],
  }));
  const visibleHeaders = headers
    .map((header, index) => ({ header, index }))
    .filter(
      ({ header, index }) =>
        !['stock-events.reason-comments', 'stock-events.vvm-status'].includes(header) ||
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
