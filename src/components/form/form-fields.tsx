import { type ReactNode, useMemo } from 'react';
import { useFieldContext } from '@/components/form/form-context';
import { useFormatError } from '@/components/form/form-messages';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldTitle,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';

type FieldProps = {
  label: ReactNode;
  description?: ReactNode;
  required?: boolean;
  disabled?: boolean;
};

/** The field's errors as display text, and whether there are any. */
function useFieldErrors() {
  const field = useFieldContext<unknown>();
  const formatError = useFormatError();
  const errors = field.state.meta.errors.map((error: unknown) => ({
    message:
      typeof error === 'string'
        ? formatError(error)
        : error && typeof error === 'object' && 'message' in error
          ? formatError(String(error.message))
          : undefined,
  }));
  return { errors, isInvalid: errors.length > 0 };
}

/** A label's text with the required mark, for any label, including a skeleton's. */
export function FieldLabelText({ label, required }: Pick<FieldProps, 'label' | 'required'>) {
  return (
    <span>
      {label}
      {required && (
        <span aria-hidden="true" className="ms-0.5 text-destructive">
          *
        </span>
      )}
    </span>
  );
}

function RequiredLabel({ label, required }: Pick<FieldProps, 'label' | 'required'>) {
  const field = useFieldContext<unknown>();
  return (
    <FieldLabel htmlFor={field.name}>
      <FieldLabelText label={label} required={required} />
    </FieldLabel>
  );
}

type TextFieldProps = FieldProps & {
  type?: 'text' | 'email' | 'tel';
  autoComplete?: string;
  placeholder?: string;
};

export function TextField({
  label,
  description,
  required,
  disabled,
  type = 'text',
  autoComplete,
  placeholder,
}: TextFieldProps) {
  const field = useFieldContext<string>();
  const { errors, isInvalid } = useFieldErrors();

  return (
    <Field data-disabled={disabled} data-invalid={isInvalid} spacing="tight">
      <RequiredLabel label={label} required={required} />
      <Input
        aria-invalid={isInvalid}
        aria-required={required}
        autoComplete={autoComplete}
        disabled={disabled}
        id={field.name}
        name={field.name}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={field.state.value}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
      {isInvalid && <FieldError errors={errors} />}
    </Field>
  );
}

/** A yes/no setting as a card: label and description at the start, the checkbox at the end, all one click target. */
export function CheckboxField({ label, description, disabled }: Omit<FieldProps, 'required'>) {
  const field = useFieldContext<boolean>();

  return (
    <FieldLabel htmlFor={field.name}>
      <Field data-disabled={disabled} orientation="horizontal">
        <FieldContent>
          <FieldTitle>{label}</FieldTitle>
          {description && <FieldDescription size="sm">{description}</FieldDescription>}
        </FieldContent>
        <Checkbox
          checked={field.state.value}
          disabled={disabled}
          id={field.name}
          name={field.name}
          onCheckedChange={(checked) => field.handleChange(checked)}
        />
      </Field>
    </FieldLabel>
  );
}

export type ComboboxFieldItem = {
  value: string;
  label: string;
};

type ComboboxFieldProps = FieldProps & {
  items: readonly ComboboxFieldItem[];
  placeholder?: string;
  emptyMessage: ReactNode;
  /** Names the button that empties the field, for screen readers. */
  clearLabel: string;
  /** Most matches rendered at once, so a list of thousands stays quick to type into. */
  limit?: number;
};

/** Picks one item by typing to filter; the field's value is the item's `value`, or null for none. */
export function ComboboxField({
  label,
  description,
  required,
  disabled,
  items,
  placeholder,
  emptyMessage,
  clearLabel,
  limit = 50,
}: ComboboxFieldProps) {
  const field = useFieldContext<string | null>();
  const { errors, isInvalid } = useFieldErrors();
  const selected = useMemo(
    () => items.find((item) => item.value === field.state.value) ?? null,
    [items, field.state.value],
  );

  return (
    <Field data-disabled={disabled} data-invalid={isInvalid} spacing="tight">
      <RequiredLabel label={label} required={required} />
      <Combobox
        disabled={disabled}
        isItemEqualToValue={(item, value) => item.value === value.value}
        itemToStringLabel={(item) => item.label}
        items={items}
        limit={limit}
        onValueChange={(item) => field.handleChange(item?.value ?? null)}
        value={selected}
      >
        <ComboboxInput
          aria-invalid={isInvalid}
          aria-required={required}
          clearLabel={clearLabel}
          disabled={disabled}
          id={field.name}
          onBlur={field.handleBlur}
          placeholder={placeholder}
          showClear={selected !== null}
          width="full"
        />
        <ComboboxContent>
          <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
          <ComboboxList>
            {(item: ComboboxFieldItem) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {description && <FieldDescription>{description}</FieldDescription>}
      {isInvalid && <FieldError errors={errors} />}
    </Field>
  );
}
