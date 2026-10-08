import { useSuspenseQuery } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateValue } from '@/components/form/date-value';
import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
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
  disabled: boolean;
  onAdd: (card: EventStockCard) => void;
};

export function ProductLotPicker({ facilityId, programId, onAdd, disabled }: Props) {
  const { t, i18n } = useTranslation();
  const { data: cards } = useSuspenseQuery(eventStockCardsOptions({ facilityId, programId }));
  const products = useMemo(() => eventProductOptions(cards), [cards]);
  const [productId, setProductId] = useState<string | null>(null);
  const [lotId, setLotId] = useState<string | null>(null);
  const product = products.find((item) => item.value === productId);
  const lots = eventLotOptions(product?.cards ?? []);
  const selectedLot = lotId ?? lots[0]?.value;
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
  const pickedLot = lots.find((item) => item.value === selectedLot);
  const pickedCard = pickedLot?.card;
  return (
    <>
      <div className="min-w-0 basis-60 grow @3xl/main:basis-72">
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
      </div>
      <div className="min-w-0 basis-44 grow @3xl/main:basis-52">
        <Select
          items={lotItems}
          value={selectedLot ?? null}
          disabled={disabled || !product}
          onValueChange={setLotId}
        >
          <SelectTrigger aria-label={t('stock-events.lot-code')} width="full">
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
      </div>
      <Button
        data-add-product=""
        disabled={disabled || !pickedCard}
        onClick={() => pickedCard && onAdd(pickedCard)}
        type="button"
      >
        <PlusIcon data-icon="inline-start" />
        {t('stock-events.add')}
      </Button>
    </>
  );
}

export function ProductLotPickerSkeleton() {
  return (
    <>
      <div className="h-9 min-w-0 basis-60 grow">
        <Skeleton fill />
      </div>
      <div className="h-9 min-w-0 basis-44 grow">
        <Skeleton fill />
      </div>
      <div className="h-9 w-20">
        <Skeleton fill />
      </div>
    </>
  );
}
