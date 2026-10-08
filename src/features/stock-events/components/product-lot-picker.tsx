import { useSuspenseQuery } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { type ReactNode, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateValue } from '@/components/form/date-value';
import { FieldLabelText } from '@/components/form/form-fields';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { eventStockCardsOptions } from '@/features/stock-events/api/queries';
import {
  type EventLotOption,
  eventLotOptions,
  eventProductOptions,
} from '@/features/stock-events/lib/products';
import type { EventStockCard, EventStockCardsFilter } from '@/features/stock-events/lib/types';

type Props = EventStockCardsFilter & {
  children?: ReactNode;
  disabled: boolean;
  onAdd: (card: EventStockCard) => void;
};

export function ProductLotPicker({ facilityId, programId, onAdd, disabled, children }: Props) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const { data: cards } = useSuspenseQuery(eventStockCardsOptions({ facilityId, programId }));
  const products = useMemo(() => eventProductOptions(cards), [cards]);
  const [productId, setProductId] = useState<string | null>(null);
  const [lotId, setLotId] = useState<string | null>(null);
  const product = products.find((item) => item.value === productId);
  const lots = eventLotOptions(product?.cards ?? []);
  const lotItems = lots.map((item) => ({
    value: item.value,
    label: item.labelKey
      ? t(item.labelKey)
      : item.lot?.expirationDate
        ? `${item.label} / ${formatDateValue(item.lot.expirationDate, i18n.language)}`
        : item.label,
  }));
  const lotLabel = (item: EventLotOption) => (
    <span className="flex min-w-0 items-center gap-1">
      <bdi>{item.labelKey ? t(item.labelKey) : item.label}</bdi>
      {item.lot?.expirationDate && (
        <>
          <span>/</span>
          <bdi>{formatDateValue(item.lot.expirationDate, i18n.language)}</bdi>
        </>
      )}
    </span>
  );
  const pickedLot = lots.find((item) => item.value === lotId);
  const pickedCard = pickedLot?.card;
  return (
    <PickerPanel status={children}>
      <div className="min-w-0 flex-1">
        <Field spacing="tight">
          <FieldLabel htmlFor={`${id}-product`}>
            <FieldLabelText label={t('stock-events.product')} required />
          </FieldLabel>
          <Combobox
            items={products}
            itemToStringLabel={(item) => item.label}
            value={product ?? null}
            onValueChange={(item) => {
              setProductId(item?.value ?? null);
              setLotId(null);
            }}
            disabled={disabled}
          >
            <ComboboxInput
              id={`${id}-product`}
              aria-required="true"
              aria-label={t('stock-events.product')}
              dir="auto"
              placeholder={t('stock-events.product')}
              width="full"
            />
            <ComboboxContent>
              <ComboboxEmpty>{t('stock-events.no-matches-title')}</ComboboxEmpty>
              <ComboboxList>
                {(item) => (
                  <ComboboxItem key={item.value} value={item}>
                    <bdi>{item.label}</bdi>
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </Field>
      </div>
      <div className="min-w-0 flex-1">
        <Field spacing="tight">
          <FieldLabel htmlFor={`${id}-lot`}>
            <FieldLabelText label={t('stock-events.lot-code')} required />
          </FieldLabel>
          <Select
            items={lotItems}
            value={lotId}
            disabled={disabled || !product}
            onValueChange={setLotId}
          >
            <SelectTrigger
              id={`${id}-lot`}
              aria-required="true"
              aria-label={t('stock-events.lot-code')}
              width="full"
            >
              <SelectValue placeholder={t('stock-events.lot-code')}>
                {pickedLot ? lotLabel(pickedLot) : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {lots.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {lotLabel(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="@3xl/main:w-auto">
        <Button
          width="full"
          data-add-product=""
          disabled={disabled || !pickedCard}
          onClick={() => pickedCard && onAdd(pickedCard)}
          type="button"
        >
          <PlusIcon data-icon="inline-start" />
          {t('stock-events.add')}
        </Button>
      </div>
    </PickerPanel>
  );
}

function PickerPanel({ children, status }: { children: ReactNode; status?: ReactNode }) {
  return (
    <Card>
      <CardContent>
        <div className="flex flex-col gap-4 @3xl/main:flex-row @3xl/main:items-end">
          {children}
          {status && <div className="@3xl/main:max-w-56 @3xl/main:pb-1.5">{status}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

export function ProductLotPickerSkeleton() {
  const { t } = useTranslation();
  return (
    <PickerPanel>
      {[t('stock-events.product'), t('stock-events.lot-code')].map((label) => (
        <div className="min-w-0 flex-1" key={label}>
          <Field spacing="tight">
            <FieldLabel>
              <FieldLabelText label={label} required />
            </FieldLabel>
            <div className="h-8">
              <Skeleton fill />
            </div>
          </Field>
        </div>
      ))}
      <div className="h-8 @3xl/main:w-20">
        <Skeleton fill />
      </div>
    </PickerPanel>
  );
}
