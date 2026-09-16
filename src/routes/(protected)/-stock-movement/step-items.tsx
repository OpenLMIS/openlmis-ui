import { PackageIcon, PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldError, FieldGroup } from '@/components/ui/field';
import { ItemRow } from '@/routes/(protected)/-stock-movement/item-row';
import type { WizardFormApi } from '@/routes/(protected)/-stock-movement/stock-movement-wizard';

export type StepItemsProps = {
  form: WizardFormApi;
};

const BLANK_ITEM = { skuId: '', quantity: 1 } as const;

export function StepItems({ form }: StepItemsProps) {
  return (
    <FieldGroup>
      <div className="flex flex-col gap-1">
        <h2 id="wizard-step-2-label" className="text-lg font-semibold">
          Items to move
        </h2>
        <p className="text-xs/relaxed text-muted-foreground">
          Add at least one SKU with its quantity. Each SKU can only appear once.
        </p>
      </div>

      <form.Field name="items" mode="array">
        {(field) => {
          /*
            Array-level errors (min-1, unique-SKU) land on the array
            root at path ['items']. Render them below the row list and
            above the add button so they're visible regardless of how
            many rows are currently mounted.
          */
          const arrayErrors = field.state.meta.errors;
          return (
            <div className="flex flex-col gap-3">
              {field.state.value.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border p-6 text-center">
                  <PackageIcon className="size-8 text-muted-foreground/60" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">
                    No items yet - use the button below to add your first SKU.
                  </p>
                </div>
              ) : (
                field.state.value.map((_, index) => (
                  <ItemRow
                    // biome-ignore lint/suspicious/noArrayIndexKey: row identity matches its array slot
                    key={index}
                    form={form}
                    index={index}
                    onRemove={() => field.removeValue(index)}
                  />
                ))
              )}

              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full @sm/main:w-fit"
                  onClick={() => field.pushValue({ ...BLANK_ITEM })}
                >
                  <PlusIcon data-icon="inline-start" />
                  Add item
                </Button>
                {arrayErrors.length > 0 && <FieldError errors={arrayErrors} />}
              </div>
            </div>
          );
        }}
      </form.Field>
    </FieldGroup>
  );
}
