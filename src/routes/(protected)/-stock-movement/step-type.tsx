import { DateField } from '@/components/date-field';
import { RadioCardGroup, type RadioCardOption } from '@/components/radio-card-group';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import {
  HANDLING_TAGS,
  type HandlingTag,
  type MovementType,
} from '@/features/stock-movement/lib/types';
import type { WizardFormApi } from '@/routes/(protected)/-stock-movement/stock-movement-wizard';

export type StepTypeProps = {
  form: WizardFormApi;
};

const TYPE_OPTIONS: readonly RadioCardOption<MovementType>[] = [
  { value: 'Transfer', label: 'Transfer', description: 'Move stock between two warehouses.' },
  {
    value: 'Adjustment',
    label: 'Adjustment',
    description: 'Manual correction, e.g. after a count.',
  },
  { value: 'Receipt', label: 'Receipt', description: 'Stock received from a supplier.' },
  { value: 'Shipment', label: 'Shipment', description: 'Stock leaving to a customer.' },
] as const;

const HANDLING_TAG_META: Record<HandlingTag, { label: string; description: string }> = {
  Fragile: {
    label: 'Fragile',
    description: 'Handle with care; flag for cushioned transport.',
  },
  Refrigerated: {
    label: 'Refrigerated',
    description: 'Maintain cold chain throughout the move.',
  },
  Hazmat: {
    label: 'Hazmat',
    description: 'Contains regulated materials; requires documentation.',
  },
  Priority: {
    label: 'Priority',
    description: 'Expedite ahead of the standard queue.',
  },
};

export function StepType({ form }: StepTypeProps) {
  return (
    <FieldGroup>
      <h2 id="wizard-step-0-label" className="text-lg font-semibold">
        Movement details
      </h2>

      <form.Field name="type">
        {(field) => {
          const isInvalid = field.state.meta.errors.length > 0;
          return (
            <Field data-invalid={isInvalid}>
              <FieldLabel>Movement type</FieldLabel>
              <RadioCardGroup
                name={field.name}
                value={field.state.value}
                onChange={field.handleChange}
                options={TYPE_OPTIONS}
                columns={2}
                ariaInvalid={isInvalid}
              />
              {isInvalid && <FieldError errors={field.state.meta.errors} />}
            </Field>
          );
        }}
      </form.Field>

      <div className="grid gap-5 @md/field-group:grid-cols-2">
        <form.Field name="referenceCode">
          {(field) => {
            const isInvalid = field.state.meta.errors.length > 0;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Reference code</FieldLabel>
                <InputGroup>
                  <InputGroupAddon align="inline-start">REF-</InputGroupAddon>
                  <InputGroupInput
                    id={field.name}
                    name={field.name}
                    value={field.state.value.replace(/^REF-/i, '')}
                    onChange={(e) => {
                      const next = e.target.value.replace(/^REF-/i, '');
                      field.handleChange(next ? `REF-${next}` : '');
                    }}
                    onBlur={field.handleBlur}
                    placeholder="1234"
                    autoComplete="off"
                    aria-invalid={isInvalid}
                  />
                </InputGroup>
                {isInvalid ? (
                  <FieldError errors={field.state.meta.errors} />
                ) : (
                  <FieldDescription>
                    Matches the identifier in your ERP (e.g. REF-1234).
                  </FieldDescription>
                )}
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="occurredAt">
          {(field) => {
            const isInvalid = field.state.meta.errors.length > 0;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Occurred at</FieldLabel>
                <DateField
                  id={field.name}
                  value={field.state.value}
                  onChange={field.handleChange}
                  /*
                    Disallow future dates - a movement that hasn't happened
                    yet doesn't belong here. Built inline so `new Date()`
                    is evaluated on each render rather than captured at
                    module load (which would go stale across midnight).
                  */
                  disabled={(date) => date > new Date()}
                  ariaInvalid={isInvalid}
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        </form.Field>
      </div>

      <form.Field name="handlingTags" mode="array">
        {(field) => {
          const isInvalid = field.state.meta.errors.length > 0;
          return (
            <FieldSet data-invalid={isInvalid}>
              <FieldLegend variant="label">Handling instructions</FieldLegend>
              <FieldDescription>
                Optional. Flags propagate to the carrier's routing sheet.
              </FieldDescription>
              <FieldGroup
                data-slot="checkbox-group"
                gap="sm"
                className="grid @md/field-group:grid-cols-2"
              >
                {HANDLING_TAGS.map((tag) => {
                  const meta = HANDLING_TAG_META[tag];
                  const itemId = `${field.name}-${tag}`;
                  const checked = field.state.value.includes(tag);
                  return (
                    <Field key={tag} orientation="horizontal">
                      <Checkbox
                        id={itemId}
                        name={field.name}
                        checked={checked}
                        onCheckedChange={(next) => {
                          if (next === true) {
                            field.pushValue(tag);
                          } else {
                            const index = field.state.value.indexOf(tag);
                            if (index > -1) field.removeValue(index);
                          }
                        }}
                      />
                      <FieldContent>
                        <FieldLabel htmlFor={itemId} weight="normal">
                          {meta.label}
                        </FieldLabel>
                        <FieldDescription>{meta.description}</FieldDescription>
                      </FieldContent>
                    </Field>
                  );
                })}
              </FieldGroup>
              {isInvalid && <FieldError errors={field.state.meta.errors} />}
            </FieldSet>
          );
        }}
      </form.Field>
    </FieldGroup>
  );
}
