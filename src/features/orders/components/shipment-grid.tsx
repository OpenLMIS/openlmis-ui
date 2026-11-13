import { useStore } from '@tanstack/react-form';
import { InfoIcon } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableCard, DataTableHeaderLabel } from '@/components/data-table/data-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ShipmentCards } from '@/features/orders/components/shipment-cards';
import {
  SHIPMENT_COLUMNS,
  type ShipmentDisplayRow,
  ShipmentFill,
  type ShipmentGridProps,
  shipmentDisplayRows,
  useShipmentRow,
} from '@/features/orders/components/shipment-row';
import { ShipmentStockNotice } from '@/features/orders/components/shipment-stock-notice';
import { shipmentFieldKey } from '@/features/orders/lib/shipment-form';
import { shipmentGroups, validateShipmentFill } from '@/features/orders/lib/shipment-lines';
import { availableShipmentPacks } from '@/features/orders/lib/shipment-quantities';
import { useCardLayout } from '@/hooks/use-card-view';

export function ShipmentGrid(props: ShipmentGridProps) {
  const { t } = useTranslation();
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  const retained = useStore(props.form.store, (state) =>
    props.lines
      .filter(
        (line) =>
          availableShipmentPacks(line.stockOnHand, line.product.netContent) === 0 &&
          validateShipmentFill(
            line,
            state.values.lines[shipmentFieldKey(line.key)]?.fill ?? line.fill,
          ) !== null,
      )
      .map((line) => line.key)
      .join('|'),
  );
  const groups = useMemo(() => {
    const kept = new Set(retained.split('|'));
    return shipmentGroups(props.order.orderLineItems, props.lines, kept);
  }, [props.order.orderLineItems, props.lines, retained]);
  const rows = shipmentDisplayRows(groups);
  return (
    <div ref={measure}>
      {cards ? (
        <ShipmentCards {...props} groups={groups} />
      ) : (
        <DataTableCard>
          <Table density="compact">
            <TableHeader surface="muted">
              <TableRow>
                {SHIPMENT_COLUMNS.map((column) => (
                  <TableHead key={column}>
                    <DataTableHeaderLabel>
                      <span className="inline-flex items-center gap-1">
                        {t(`orders.shipment.${column}`)}
                        {['ordered', 'available', 'remaining'].includes(column) && (
                          <Tooltip>
                            <TooltipTrigger
                              render={<button type="button" className="text-muted-foreground" />}
                              aria-label={t('orders.shipment.unit-info', {
                                unit: t(
                                  props.unit === 'PACKS'
                                    ? 'quantity-unit.packs'
                                    : 'quantity-unit.doses',
                                ),
                              })}
                            >
                              <InfoIcon className="size-3.5" />
                            </TooltipTrigger>
                            <TooltipContent>
                              {t('orders.shipment.unit-info', {
                                unit: t(
                                  props.unit === 'PACKS'
                                    ? 'quantity-unit.packs'
                                    : 'quantity-unit.doses',
                                ),
                              })}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                    </DataTableHeaderLabel>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <ShipmentTableRow key={row.key} {...props} row={row} />
              ))}
            </TableBody>
          </Table>
        </DataTableCard>
      )}
    </div>
  );
}
const ShipmentTableRow = memo(function ShipmentTableRow(
  props: ShipmentGridProps & { row: ShipmentDisplayRow },
) {
  const { display, error, touched } = useShipmentRow(props, props.row);
  if (props.row.noStock)
    return (
      <TableRow tone="shortfall">
        <TableCell colSpan={SHIPMENT_COLUMNS.length}>
          <ShipmentStockNotice />
        </TableCell>
      </TableRow>
    );
  return (
    <TableRow
      surface={props.row.group ? 'muted' : 'default'}
      data-invalid={error && (touched || props.attempted) ? '' : undefined}
    >
      {SHIPMENT_COLUMNS.map((column) => (
        <TableCell key={column}>
          {column === 'fill' && props.row.line && props.canEdit ? (
            <ShipmentFill {...props} line={props.row.line} />
          ) : column === 'product' ? (
            <span className="block min-w-40 whitespace-normal">{display[column]}</span>
          ) : (
            display[column]
          )}
        </TableCell>
      ))}
    </TableRow>
  );
});
