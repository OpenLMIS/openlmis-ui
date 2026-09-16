import { useStore } from '@tanstack/react-form';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { WizardFormApi } from '@/routes/(protected)/-stock-movement/stock-movement-wizard';
import { WarehouseCombobox } from '@/routes/(protected)/-stock-movement/warehouse-combobox';

export type StepLocationsProps = {
  form: WizardFormApi;
};

const NOTES_MAX = 500;

export function StepLocations({ form }: StepLocationsProps) {
  /*
    Read the source warehouse via useStore so the destination combobox
    can hide it from its list. useStore re-renders only this component
    when the selector's primitive result changes.
  */
  const sourceWarehouseId = useStore(form.store, (state) => state.values.sourceWarehouseId);

  return (
    <FieldGroup>
      <h2 id="wizard-step-1-label" className="text-lg font-semibold">
        Source and destination
      </h2>

      <form.Field name="sourceWarehouseId">
        {(field) => {
          const isInvalid = field.state.meta.errors.length > 0;
          return (
            <Field data-invalid={isInvalid}>
              <FieldLabel htmlFor={field.name}>Source warehouse</FieldLabel>
              <WarehouseCombobox
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

      <form.Field name="destinationWarehouseId">
        {(field) => {
          const isInvalid = field.state.meta.errors.length > 0;
          return (
            <Field data-invalid={isInvalid}>
              <FieldLabel htmlFor={field.name}>Destination warehouse</FieldLabel>
              <WarehouseCombobox
                id={field.name}
                value={field.state.value}
                onChange={field.handleChange}
                excludeIds={sourceWarehouseId ? [sourceWarehouseId] : undefined}
                placeholder="Search destinations..."
                ariaInvalid={isInvalid}
              />
              {isInvalid && <FieldError errors={field.state.meta.errors} />}
            </Field>
          );
        }}
      </form.Field>

      <form.Field name="notes">
        {(field) => {
          const isInvalid = field.state.meta.errors.length > 0;
          const remaining = NOTES_MAX - field.state.value.length;
          return (
            <Field data-invalid={isInvalid}>
              <FieldLabel htmlFor={field.name}>Notes</FieldLabel>
              <Textarea
                id={field.name}
                name={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                rows={3}
                placeholder="Optional context, e.g. PO number or reason."
                aria-invalid={isInvalid}
              />
              {isInvalid ? (
                <FieldError errors={field.state.meta.errors} />
              ) : (
                <FieldDescription>
                  Optional. {remaining} character{remaining === 1 ? '' : 's'} remaining.
                </FieldDescription>
              )}
            </Field>
          );
        }}
      </form.Field>

      <form.Field name="signatureRequired">
        {(field) => (
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor={field.name}>Require signature on delivery</FieldLabel>
              <FieldDescription>
                The receiving location must sign off before the movement is marked complete.
              </FieldDescription>
            </FieldContent>
            <Switch
              id={field.name}
              checked={field.state.value}
              onCheckedChange={(next: boolean) => field.handleChange(next)}
            />
          </Field>
        )}
      </form.Field>
    </FieldGroup>
  );
}
