import { useStore } from '@tanstack/react-form';
import { Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { MOCK_SKUS } from '@/features/stock-movement/lib/types';
import { SkuCombobox } from '@/routes/(protected)/-stock-movement/sku-combobox';
import type { WizardFormApi } from '@/routes/(protected)/-stock-movement/stock-movement-wizard';

export type ItemRowProps = {
  form: WizardFormApi;
  index: number;
  onRemove: () => void;
};

/*
  Responsive layout - the remove button sits in a mini-header on narrow
  containers and inline at the end on wider ones. Keeps the destructive
  action reachable without crowding it under the quantity input.
*/
export function ItemRow({ form, index, onRemove }: ItemRowProps) {
  const label = `Item ${index + 1}`;

  /*
    Read the row's SKU so the quantity InputGroup can render its unit
    (pcs / kit / m / box) as a trailing addon. useStore re-renders only
    this row when its own SKU id changes.
  */
  const skuId = useStore(form.store, (state) => state.values.items[index]?.skuId ?? '');
  const unit = MOCK_SKUS.find((sku) => sku.id === skuId)?.unit ?? 'qty';

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-3 @md/field-group:flex-row @md/field-group:items-start @md/field-group:gap-3">
      <div className="flex items-center justify-between @md/field-group:hidden">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
        >
          <Trash2Icon />
        </Button>
      </div>

      <form.Field name={`items[${index}].skuId`}>
        {(field) => {
          const isInvalid = field.state.meta.errors.length > 0;
          return (
            <Field data-invalid={isInvalid} className="@md/field-group:flex-1">
              <FieldLabel htmlFor={field.name} className="sr-only">
                {label} SKU
              </FieldLabel>
              <SkuCombobox
                id={field.name}
                value={field.state.value}
                onChange={field.handleChange}
                ariaInvalid={isInvalid}
              />
              {isInvalid && <FieldError errors={field.state.meta.errors} />}
            </Field>
          );
        }}
      </form.Field>

      <form.Field name={`items[${index}].quantity`}>
        {(field) => {
          const isInvalid = field.state.meta.errors.length > 0;
          return (
            <Field
              data-invalid={isInvalid}
              className="@md/field-group:w-40 @md/field-group:flex-none"
            >
              <FieldLabel htmlFor={field.name} className="sr-only">
                {label} quantity
              </FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id={field.name}
                  name={field.name}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={field.state.value}
                  onChange={(e) => {
                    const next = e.target.value;
                    field.handleChange(next === '' ? 0 : Number(next));
                  }}
                  onBlur={field.handleBlur}
                  placeholder="Qty"
                  aria-invalid={isInvalid}
                />
                <InputGroupAddon align="inline-end">{unit}</InputGroupAddon>
              </InputGroup>
              {isInvalid && <FieldError errors={field.state.meta.errors} />}
            </Field>
          );
        }}
      </form.Field>

      <div className="hidden @md/field-group:block">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
        >
          <Trash2Icon />
        </Button>
      </div>
    </div>
  );
}
