import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import { Building2Icon, ChevronDownIcon } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { FieldLabelText } from '@/components/form/form-fields';
import { PickerAddIcon } from '@/components/pickers/picker-add';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxVirtualList,
} from '@/components/ui/combobox';
import { Field, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Spinner } from '@/components/ui/spinner';

type Option = { id: string; name: string; code?: string };
export function OrderSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
  disabled,
  loading,
  compact = false,
  required = false,
}: {
  label: string;
  placeholder: string;
  options: Option[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  loading?: string | undefined;
  compact?: boolean;
  required?: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  const { contains } = ComboboxPrimitive.useFilter();
  const selected = options.find((item) => item.id === value) ?? null;
  return (
    <Field>
      {!compact && (
        <FieldLabel htmlFor={id}>
          <FieldLabelText label={label} required={required} />
        </FieldLabel>
      )}
      {disabled || loading ? (
        <InputGroup size="lg">
          <InputGroupInput
            id={id}
            role="combobox"
            aria-expanded={false}
            aria-required={required}
            aria-label={label}
            aria-busy={loading ? true : undefined}
            disabled
            value={loading ? '' : (selected?.name ?? '')}
            placeholder={loading ?? placeholder}
          />
          <InputGroupAddon align="inline-end">
            {loading ? <Spinner aria-label={loading} /> : <ChevronDownIcon aria-hidden="true" />}
          </InputGroupAddon>
        </InputGroup>
      ) : (
        <Combobox
          filter={(item, query) => contains(item.name, query) || contains(item.code ?? '', query)}
          items={options}
          limit={-1}
          virtualized={options.length > 50}
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
            id={id}
            aria-label={label}
            aria-required={required}
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
            {options.length > 50 ? (
              <ComboboxVirtualList<Option> itemKey={(item) => item.id}>
                {(item: Option) => (
                  <span className="min-w-0 whitespace-normal break-words" dir="auto">
                    {item.name}
                  </span>
                )}
              </ComboboxVirtualList>
            ) : (
              <ComboboxList>
                {(item: Option) => (
                  <ComboboxItem key={item.id} value={item}>
                    {item.name}
                  </ComboboxItem>
                )}
              </ComboboxList>
            )}
          </ComboboxContent>
        </Combobox>
      )}
    </Field>
  );
}
