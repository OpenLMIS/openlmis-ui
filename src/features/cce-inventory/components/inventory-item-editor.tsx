import { useStore } from '@tanstack/react-form';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Loader2Icon } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadError } from '@/components/app-shell/load-error';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import { ErrorAlert, serverMessage } from '@/components/display/dialog-parts';
import { DiscardChangesDialog } from '@/components/display/discard-changes-dialog';
import { useFacilityProgramOptions } from '@/components/pickers/facility-program-selector/use-facility-program-options';
import { Button } from '@/components/ui/button';
import { Workspace, WorkspaceContent, WorkspaceFooter } from '@/components/workspace/workspace';
import { createInventoryItem } from '@/features/cce-inventory/api/api';
import { catalogItemsOptions } from '@/features/cce-inventory/api/queries';
import {
  EditorHeader,
  FormSkeleton,
} from '@/features/cce-inventory/components/inventory-item-editor-skeleton';
import {
  HistorySection,
  IdentificationSection,
  InstallationSection,
  Section,
  StatusSection,
} from '@/features/cce-inventory/components/inventory-item-sections';
import { ModelFields } from '@/features/cce-inventory/components/inventory-model-fields';
import { PairFields } from '@/features/cce-inventory/components/inventory-pair-fields';
import { useInventoryItemForm } from '@/features/cce-inventory/components/use-inventory-item-form';
import { equipmentTypes, modelsOfType, soleItem } from '@/features/cce-inventory/lib/catalog';
import {
  EMPTY_INVENTORY_ITEM_DETAILS,
  hasFixedPowerModel,
  type InventoryItemValues,
  inventoryItemSchema,
  toInventoryItemBody,
} from '@/features/cce-inventory/lib/inventory-item-form';
import type { CatalogItem, InventoryItemBody } from '@/features/cce-inventory/lib/types';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import type { EquipmentStatus } from '@/lib/cce-equipment-status';
import {
  type CompleteSelection,
  changeMode,
  type FacilityProgramOptions,
  type FacilityProgramSelection,
  initialSelection,
} from '@/lib/facility-program-selection';
import { queryKeys } from '@/lib/key-factory';
import type { ProgramGrant } from '@/lib/permissions';

const FORM_ID = 'inventory-item-form';

export type SavedInventoryItem = {
  selection: CompleteSelection;
  status: EquipmentStatus;
  name: string;
};

type SaveRequest = { body: InventoryItemBody; saved: SavedInventoryItem };

type InventoryItemEditorProps = {
  userId: string;
  grants: readonly ProgramGrant[];
  initial: FacilityProgramSelection;
  onCancel: () => void;
  onSaved: (saved: SavedInventoryItem) => void;
};

function focusFirstError(container: HTMLElement | null) {
  requestAnimationFrame(() =>
    container?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
  );
}

export function InventoryItemEditor({
  userId,
  grants,
  initial,
  onCancel,
  onSaved,
}: InventoryItemEditorProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const leaving = useRef(false);
  const errorAlert = useRef<HTMLDivElement>(null);
  const mutation = useSessionMutation({
    mutationFn: ({ body }: SaveRequest) => createInventoryItem(body),
    onSuccess: (_, { saved }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventoryItems.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.home.all });
      leaving.current = true;
      onSaved(saved);
    },
    onError: () =>
      requestAnimationFrame(() => errorAlert.current?.scrollIntoView({ block: 'center' })),
  });

  return (
    <>
      <Workspace width="narrow">
        <EditorHeader />
        <WorkspaceContent>
          <div className="flex flex-col gap-8" inert={mutation.isPending}>
            {mutation.isError && (
              <div ref={errorAlert}>
                <ErrorAlert
                  description={serverMessage(mutation.error) ?? t('cce-inventory.form.save-error')}
                  title={t('cce-inventory.form.save-error-title')}
                />
              </div>
            )}
            <QueryBoundary
              errorComponent={({ error, reset }) => (
                <LoadError
                  description={t('cce-inventory.form.load-error')}
                  error={error}
                  reset={reset}
                  title={t('cce-inventory.form.load-error-title')}
                />
              )}
              pendingFallback={<FormSkeleton />}
              resetKey={userId}
            >
              <InventoryItemForm
                allowLeave={() => leaving.current}
                grants={grants}
                initial={initial}
                onSave={(request) => mutation.mutateAsync(request).catch(() => undefined)}
                saving={mutation.isPending}
                userId={userId}
              />
            </QueryBoundary>
          </div>
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter width="narrow">
        <Button disabled={mutation.isPending} onClick={onCancel} size="lg" variant="outline">
          {t('cce-inventory.form.cancel')}
        </Button>
        <Button
          disabled={mutation.isPending}
          focusableWhenDisabled
          form={FORM_ID}
          size="lg"
          type="submit"
        >
          {mutation.isPending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
          {t('cce-inventory.form.save')}
        </Button>
      </WorkspaceFooter>
    </>
  );
}

function startSelection(initial: FacilityProgramSelection, options: FacilityProgramOptions) {
  const start = initialSelection(initial, options);
  const homeOffersNothing =
    start.mode === 'my' && options.myPrograms.length === 0 && options.supervisedPrograms.length > 0;
  return homeOffersNothing ? changeMode('supervised', options) : start;
}

function startValues(
  selection: FacilityProgramSelection,
  catalog: readonly CatalogItem[],
): InventoryItemValues {
  const equipmentType = soleItem(equipmentTypes(catalog));
  const catalogItemId = equipmentType
    ? (soleItem(modelsOfType(catalog, equipmentType))?.id ?? null)
    : null;
  const power = hasFixedPowerModel(catalog, catalogItemId) ? 'NOT_APPLICABLE' : '';
  return {
    mode: selection.mode ?? 'supervised',
    programId: selection.programId ?? null,
    facilityId: selection.facilityId ?? null,
    equipmentType,
    catalogItemId,
    details: {
      ...EMPTY_INVENTORY_ITEM_DETAILS,
      voltageStabilizer: power,
      voltageRegulator: power,
      backupGenerator: power,
    },
  };
}

type InventoryItemFormProps = Omit<InventoryItemEditorProps, 'onCancel' | 'onSaved'> & {
  saving: boolean;
  allowLeave: () => boolean;
  onSave: (request: SaveRequest) => Promise<unknown>;
};

function InventoryItemForm({
  userId,
  grants,
  initial,
  saving,
  allowLeave,
  onSave,
}: InventoryItemFormProps) {
  const { t } = useTranslation();
  const options = useFacilityProgramOptions(userId, grants);
  const { data: catalog } = useSuspenseQuery(catalogItemsOptions());
  const [defaultValues] = useState(() => startValues(startSelection(initial, options), catalog));
  const formRef = useRef<HTMLFormElement>(null);

  const form = useInventoryItemForm(
    defaultValues,
    async (values) => {
      const { mode, programId, facilityId, catalogItemId, details } =
        inventoryItemSchema.parse(values);
      const catalogItem = catalog.find((item) => item.id === catalogItemId);
      if (!catalogItem) {
        form.setFieldValue('catalogItemId', null);
        focusFirstError(formRef.current);
        return;
      }
      const selection = { mode, programId, facilityId };
      const body = toInventoryItemBody(details, selection, catalogItem);
      await onSave({
        body,
        saved: { selection, status: body.functionalStatus, name: body.referenceName },
      });
    },
    () => focusFirstError(formRef.current),
  );

  const changed = useStore(form.store, (state) => !state.isDefaultValue);
  const guard = useDiscardGuard(changed, { allowLeave, pending: saving });

  return (
    <form
      className="flex flex-col gap-8"
      id={FORM_ID}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!form.state.isSubmitting && !allowLeave()) void form.handleSubmit();
      }}
      ref={formRef}
    >
      <Section legend={t('cce-inventory.form.equipment')}>
        <PairFields form={form} options={options} />
        <ModelFields catalog={catalog} form={form} />
      </Section>
      <IdentificationSection form={form} />
      <HistorySection form={form} />
      <InstallationSection catalog={catalog} form={form} />
      <StatusSection form={form} />
      <form.AppField name="details.additionalNotes">
        {(field) => (
          <field.TextareaField dir="auto" label={t('cce-inventory.form.additional-notes')} />
        )}
      </form.AppField>
      <DiscardChangesDialog
        description={t('cce-inventory.form.discard-description')}
        {...guard.dialog}
      />
    </form>
  );
}
