import { useTranslation } from 'react-i18next';
import {
  CardBand,
  CardControlRow,
  CardList,
  CardListItem,
  CardRows,
} from '@/components/display/card-list';
import { SettingsItem } from '@/components/form/settings-list';
import {
  SHIPMENT_COLUMNS,
  ShipmentFill,
  type ShipmentGridProps,
  shipmentDisplayRows,
  useShipmentRow,
} from '@/features/orders/components/shipment-row';
import { ShipmentStockNotice } from '@/features/orders/components/shipment-stock-notice';
import type { ShipmentGroup } from '@/features/orders/lib/shipment-lines';
import { orEmpty } from '@/lib/empty-value';

export function ShipmentCards(props: ShipmentGridProps & { groups: ShipmentGroup[] }) {
  return (
    <CardList>
      {props.groups.map((group) => (
        <CardListItem key={group.product.id}>
          <CardBand>
            <span className="min-w-0 break-words">
              {group.product.fullProductName} ({group.product.productCode})
            </span>
          </CardBand>
          {shipmentDisplayRows([group]).map((row) => (
            <ShipmentCardRow key={row.key} {...props} row={row} />
          ))}
        </CardListItem>
      ))}
    </CardList>
  );
}
function ShipmentCardRow(
  props: ShipmentGridProps & { row: ReturnType<typeof shipmentDisplayRows>[number] },
) {
  const { t } = useTranslation();
  const { display, error, touched } = useShipmentRow(props, props.row);
  if (props.row.noStock)
    return (
      <div className="bg-warning/10 px-4 py-2">
        <ShipmentStockNotice />
      </div>
    );
  return (
    <div className={error && (touched || props.attempted) ? 'bg-destructive/10' : undefined}>
      {props.row.group?.kind === 'subgroup' && (
        <CardBand>
          {props.row.group.product.fullProductName} ({props.row.group.product.productCode})
        </CardBand>
      )}
      {props.row.line &&
        !props.row.hideProduct &&
        props.row.line.product.id !== props.row.line.orderedProductId && (
          <CardBand>
            {props.row.line.product.fullProductName} ({props.row.line.product.productCode})
          </CardBand>
        )}
      {props.row.line && <CardBand>{display['lot-code']}</CardBand>}
      <CardRows>
        {cardColumns(props.row).map((column) =>
          column === 'fill' && props.row.line && props.canEdit ? (
            <CardControlRow key={column} label={t('orders.shipment.fill')}>
              <ShipmentFill {...props} line={props.row.line} />
            </CardControlRow>
          ) : (
            <SettingsItem key={column} label={t(`orders.shipment.${column}`)}>
              {orEmpty(display[column])}
            </SettingsItem>
          ),
        )}
      </CardRows>
    </div>
  );
}
function cardColumns(row: ReturnType<typeof shipmentDisplayRows>[number]) {
  const shown = new Set<(typeof SHIPMENT_COLUMNS)[number]>(['fill', 'available', 'remaining']);
  if (row.ordered != null) shown.add('ordered');
  if (row.line) {
    shown.add('vvm');
    shown.add('expiry');
  }
  return SHIPMENT_COLUMNS.filter((column) => shown.has(column));
}
