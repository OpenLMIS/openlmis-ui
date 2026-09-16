import { useStore } from '@tanstack/react-form';
import { format, parseISO } from 'date-fns';
import { PencilIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  MOCK_SKUS,
  MOCK_WAREHOUSES,
  type StockMovementInput,
} from '@/features/stock-movement/lib/types';
import type { WizardFormApi } from '@/routes/(protected)/-stock-movement/stock-movement-wizard';

export type StepReviewProps = {
  form: WizardFormApi;
  onEditStep: (index: number) => void;
};

export function StepReview({ form, onEditStep }: StepReviewProps) {
  const values = useStore(form.store, (state) => state.values);

  return (
    <FieldGroup>
      <div className="flex flex-col gap-1">
        <h2 id="wizard-step-3-label" className="text-lg font-semibold">
          Review and submit
        </h2>
        <p className="text-xs/relaxed text-muted-foreground">
          Confirm the details below. Use the edit buttons to go back to any step.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <ReviewSection
          title="Movement details"
          onEdit={() => onEditStep(0)}
          rows={buildTypeRows(values)}
        />
        <ReviewSection
          title="Source and destination"
          onEdit={() => onEditStep(1)}
          rows={buildLocationsRows(values)}
        />
        <ReviewSection title="Items" onEdit={() => onEditStep(2)} rows={buildItemsRows(values)} />
      </div>

      <form.Field name="acceptTerms">
        {(field) => {
          const isInvalid = field.state.meta.errors.length > 0;
          return (
            <Field orientation="horizontal" data-invalid={isInvalid}>
              <Checkbox
                id={field.name}
                checked={field.state.value}
                onCheckedChange={(checked) => field.handleChange(checked === true)}
                aria-invalid={isInvalid}
              />
              <FieldContent>
                <FieldLabel
                  htmlFor={field.name}
                  weight="normal"
                  leading="relaxed"
                  className="!block"
                >
                  I confirm the movement details above are correct.
                </FieldLabel>
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </FieldContent>
            </Field>
          );
        }}
      </form.Field>
    </FieldGroup>
  );
}

type ReviewRow = {
  label: string;
  value: string;
};

type ReviewSectionProps = {
  title: string;
  rows: ReviewRow[];
  onEdit: () => void;
};

function ReviewSection({ title, rows, onEdit }: ReviewSectionProps) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-2xs font-semibold uppercase tracking-label text-muted-foreground">
          {title}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onEdit}
          aria-label={`Edit ${title.toLowerCase()}`}
        >
          <PencilIcon data-icon="inline-start" />
          Edit
        </Button>
      </div>
      <dl className="grid grid-cols-label-value gap-x-4 gap-y-1.5 text-xs">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="font-medium text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const EMPTY = '-';

function buildTypeRows(values: StockMovementInput): ReviewRow[] {
  return [
    { label: 'Type', value: values.type || EMPTY },
    { label: 'Reference', value: values.referenceCode || EMPTY },
    {
      label: 'Occurred at',
      value: values.occurredAt ? format(parseISO(values.occurredAt), 'PPP') : EMPTY,
    },
    {
      label: 'Handling',
      value: values.handlingTags.length > 0 ? values.handlingTags.join(', ') : 'None',
    },
  ];
}

function buildLocationsRows(values: StockMovementInput): ReviewRow[] {
  const source = MOCK_WAREHOUSES.find((w) => w.id === values.sourceWarehouseId);
  const destination = MOCK_WAREHOUSES.find((w) => w.id === values.destinationWarehouseId);
  return [
    { label: 'Source', value: source ? `${source.name} (${source.code})` : EMPTY },
    {
      label: 'Destination',
      value: destination ? `${destination.name} (${destination.code})` : EMPTY,
    },
    { label: 'Notes', value: values.notes.trim() || EMPTY },
    {
      label: 'Signature',
      value: values.signatureRequired ? 'Required on delivery' : 'Not required',
    },
  ];
}

function buildItemsRows(values: StockMovementInput): ReviewRow[] {
  if (values.items.length === 0) {
    return [{ label: 'Items', value: 'No items added yet.' }];
  }
  return values.items.map((item, index) => {
    const sku = MOCK_SKUS.find((s) => s.id === item.skuId);
    const label = sku ? `${sku.name} (${sku.sku})` : 'SKU not selected';
    return {
      label: `Item ${index + 1}`,
      value: `${label} · ${item.quantity} ${sku?.unit ?? ''}`.trim(),
    };
  });
}
