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
import { MOCK_WAREHOUSES, type Warehouse } from '@/features/stock-movement/lib/types';

export type WarehouseComboboxProps = {
  id: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /* IDs to hide from the list (e.g. exclude the chosen source from the destination list). */
  excludeIds?: readonly string[];
  ariaInvalid?: boolean;
};

export function WarehouseCombobox({
  id,
  value,
  onChange,
  placeholder = 'Search warehouses...',
  excludeIds,
  ariaInvalid,
}: WarehouseComboboxProps) {
  const items = excludeIds?.length
    ? MOCK_WAREHOUSES.filter((warehouse) => !excludeIds.includes(warehouse.id))
    : MOCK_WAREHOUSES;
  const selected = value ? (MOCK_WAREHOUSES.find((w) => w.id === value) ?? null) : null;

  return (
    <Combobox
      items={items}
      value={selected}
      onValueChange={(next: Warehouse | null) => onChange(next?.id ?? '')}
      itemToStringLabel={(item: Warehouse) => `${item.name} · ${item.code}`}
      itemToStringValue={(item: Warehouse) => item.id}
    >
      <ComboboxInput
        id={id}
        placeholder={placeholder}
        aria-invalid={ariaInvalid}
        showClear={Boolean(value)}
      />
      <ComboboxContent>
        <ComboboxList>
          <ComboboxCollection>
            {(item: Warehouse) => (
              <ComboboxItem key={item.id} value={item}>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-xs font-medium text-foreground">{item.name}</span>
                  <span className="truncate text-2xs text-muted-foreground">
                    {item.code} · {item.region}
                  </span>
                </div>
              </ComboboxItem>
            )}
          </ComboboxCollection>
          <ComboboxEmpty>
            <div className="flex flex-col items-center gap-1 py-3 text-muted-foreground">
              <SearchXIcon className="size-5" aria-hidden="true" />
              <span className="text-xs">No warehouses match</span>
            </div>
          </ComboboxEmpty>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
