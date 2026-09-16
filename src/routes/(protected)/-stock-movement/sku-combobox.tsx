import { SearchXIcon } from 'lucide-react';
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { MOCK_SKUS, type Sku } from '@/features/stock-movement/lib/types';

export type SkuComboboxProps = {
  id: string;
  value: string;
  onChange: (next: string) => void;
  ariaInvalid?: boolean;
};

export function SkuCombobox({ id, value, onChange, ariaInvalid }: SkuComboboxProps) {
  const selected = value ? (MOCK_SKUS.find((s) => s.id === value) ?? null) : null;

  return (
    <Combobox
      items={MOCK_SKUS}
      value={selected}
      onValueChange={(next: Sku | null) => onChange(next?.id ?? '')}
      itemToStringLabel={(item: Sku) => `${item.name} · ${item.sku}`}
      itemToStringValue={(item: Sku) => item.id}
    >
      <ComboboxInput
        id={id}
        placeholder="Search SKUs..."
        aria-invalid={ariaInvalid}
        showClear={Boolean(value)}
      />
      <ComboboxContent>
        <ComboboxList>
          <ComboboxCollection>
            {(item: Sku) => (
              <ComboboxItem key={item.id} value={item}>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-xs font-medium text-foreground">{item.name}</span>
                  <span className="truncate text-2xs text-muted-foreground">
                    {item.sku} · {item.unit}
                  </span>
                </div>
              </ComboboxItem>
            )}
          </ComboboxCollection>
          <ComboboxEmpty>
            <div className="flex flex-col items-center gap-1 py-3 text-muted-foreground">
              <SearchXIcon className="size-5" aria-hidden="true" />
              <span className="text-xs">No SKUs match</span>
            </div>
          </ComboboxEmpty>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
