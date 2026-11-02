import { Building2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PickerAddIcon } from '@/components/pickers/picker-add';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { Field, FieldLabel } from '@/components/ui/field';

type Option = { id: string; name: string };
export function OrderSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
  disabled,
  compact = false,
}: {
  label: string;
  placeholder: string;
  options: Option[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const selected = options.find((item) => item.id === value) ?? null;
  return (
    <Field>
      <FieldLabel>{compact ? <span className="sr-only">{label}</span> : label}</FieldLabel>
      <Combobox
        items={options}
        value={selected}
        disabled={disabled}
        itemToStringLabel={(item) => item.name}
        isItemEqualToValue={(a, b) => a.id === b.id}
        onValueChange={(item, details) => {
          if (details.reason === 'escape-key' && !item) return details.allowPropagation();
          onChange(item?.id ?? '');
        }}
      >
        <ComboboxInput
          aria-label={label}
          placeholder={placeholder}
          size="lg"
          width="full"
          clearLabel={t('orders.clear-selection')}
        >
          {compact && (
            <PickerAddIcon>
              <Building2Icon />
            </PickerAddIcon>
          )}
        </ComboboxInput>
        <ComboboxContent>
          <ComboboxEmpty>{t('orders.no-options')}</ComboboxEmpty>
          <ComboboxList>
            {(item: Option) => (
              <ComboboxItem key={item.id} value={item}>
                {item.name}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </Field>
  );
}
