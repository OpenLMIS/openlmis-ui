import { useStore } from '@tanstack/react-form';
import { useIsMutating, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import type { ParseKeys } from 'i18next';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import {
  DialogLoadError,
  ErrorAlert,
  FieldSkeleton,
  serverMessage,
} from '@/components/display/dialog-parts';
import { DiscardChangesDialog } from '@/components/display/discard-changes-dialog';
import {
  FormDialog,
  FormDialogBody,
  FormDialogCancel,
  FormDialogDescription,
  FormDialogFooter,
  FormDialogForm,
  FormDialogHeader,
  FormDialogSubmit,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import { useDialogTarget } from '@/components/form-dialog/use-dialog-target';
import { useFacilityProgramOptions } from '@/components/pickers/facility-program-selector/use-facility-program-options';
import { Button } from '@/components/ui/button';
import { createInventoryItem } from '@/features/cce-inventory/api/api';
import { catalogItemsOptions } from '@/features/cce-inventory/api/queries';
import {
  ChosenEquipment,
  type ChosenEquipmentLabels,
  DetailsFields,
  Section,
} from '@/features/cce-inventory/components/inventory-item-sections';
import { ModelFields } from '@/features/cce-inventory/components/inventory-model-fields';
import { PairFields } from '@/features/cce-inventory/components/inventory-pair-fields';
import { useInventoryItemForm } from '@/features/cce-inventory/components/use-inventory-item-form';
import { useItemDialogGuard } from '@/features/cce-inventory/components/use-item-dialog-guard';
import {
  equipmentTypes,
  makeModelLabel,
  modelsOfType,
  soleItem,
} from '@/features/cce-inventory/lib/catalog';
import {
  EMPTY_INVENTORY_ITEM_DETAILS,
  hasFixedPowerModel,
  type InventoryItemValues,
  inventoryItemSchema,
  POWER_FIELDS,
  toInventoryItemBody,
} from '@/features/cce-inventory/lib/inventory-item-form';
import type { CatalogItem, InventoryItemBody } from '@/features/cce-inventory/lib/types';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import type { EquipmentStatus } from '@/lib/cce-equipment-status';
import {
  type CompleteSelection,
  changeMode,
  type FacilityProgramOptions,
  type FacilityProgramSelection,
  initialSelection,
  recordLabel,
} from '@/lib/facility-program-selection';
import { queryKeys } from '@/lib/key-factory';
import type { ProgramGrant } from '@/lib/permissions';

const ADD_KEY = ['cce-inventory', 'add'];

export type SavedInventoryItem = {
  selection: CompleteSelection;
  status: EquipmentStatus;
  name: string;
};

type SaveRequest = { body: InventoryItemBody; saved: SavedInventoryItem };

type InventoryItemDialogProps = {
  open: boolean;
  userId: string;
  grants: readonly ProgramGrant[];
  initial: FacilityProgramSelection;
  onClose: () => void;
  onSaved: (saved: SavedInventoryItem) => void;
};

export function InventoryItemDialog({
  open,
  userId,
  grants,
  initial,
  onClose,
  onSaved,
}: InventoryItemDialogProps) {
  const { t } = useTranslation();
  const { shown, dialogProps } = useDialogTarget(open ? userId : undefined, onClose);
  const pending = useIsMutating({ mutationKey: ADD_KEY }) > 0;
  const openingKey = useOpeningKey(open);
  const closedOpening = useRef<number | null>(null);
  const requestClose = () => {
    if (closedOpening.current === openingKey) return;
    closedOpening.current = openingKey;
    onClose();
  };

  return (
    <FormDialog
      {...dialogProps(pending)}
      onOpenChange={(next) => {
        if (!next && !pending) requestClose();
      }}
      size="2xl"
    >
      {shown && (
        <QueryBoundary
          errorComponent={({ error, reset }) => (
            <DialogLoadError
              error={error}
              errorTitle={t('cce-inventory.form.load-error-title')}
              onRetry={reset}
              title={t('cce-inventory.form.title')}
            />
          )}
          pendingFallback={<AddEquipmentSkeleton />}
          resetKey={userId}
        >
          <AddEquipmentForm
            grants={grants}
            initial={initial}
            key={openingKey}
            onCloseCancelled={() => {
              closedOpening.current = null;
            }}
            onSaved={onSaved}
            userId={shown}
          />
        </QueryBoundary>
      )}
    </FormDialog>
  );
}

function useOpeningKey(open: boolean) {
  const [opening, setOpening] = useState({ open, key: 0 });
  if (opening.open === open) return opening.key;
  const next = { open, key: open ? opening.key + 1 : opening.key };
  setOpening(next);
  return next.key;
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

const FIRST_FIELD = [
  '[role=radio][aria-checked=true]:not([aria-disabled=true])',
  'input:not([type=hidden]):not(:disabled):not([tabindex="-1"]):not([aria-hidden=true])',
  'textarea:not(:disabled)',
].join(', ');

function focusFirstError(container: HTMLElement | null) {
  requestAnimationFrame(() =>
    container?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
  );
}

function chosenLabels(
  values: InventoryItemValues,
  options: FacilityProgramOptions,
  catalog: readonly CatalogItem[],
): ChosenEquipmentLabels {
  const programs = values.mode === 'my' ? options.myPrograms : options.supervisedPrograms;
  const program = programs.find((record) => record.id === values.programId);
  const facility = values.programId
    ? options.facilitiesFor(values.programId).find((record) => record.id === values.facilityId)
    : undefined;
  const model = catalog.find((item) => item.id === values.catalogItemId);
  return {
    facility: facility ? recordLabel(facility) : '',
    program: program ? recordLabel(program) : '',
    type: values.equipmentType ?? '',
    model: model ? makeModelLabel(model) : '',
  };
}

type Step = 'equipment' | 'details';

type AddEquipmentFormProps = Omit<InventoryItemDialogProps, 'open' | 'onClose'> & {
  onCloseCancelled: () => void;
};

function AddEquipmentForm({
  userId,
  grants,
  initial,
  onSaved,
  onCloseCancelled,
}: AddEquipmentFormProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const options = useFacilityProgramOptions(userId, grants);
  const { data: catalog } = useSuspenseQuery({ ...catalogItemsOptions(), staleTime: 0 });
  const [defaultValues] = useState(() => startValues(startSelection(initial, options), catalog));
  const [step, setStep] = useState<Step>('equipment');
  const [modelGone, setModelGone] = useState(false);
  const fields = useRef<HTMLDivElement>(null);
  const errorAlert = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);
  const shownStep = useRef(step);

  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    requestAnimationFrame(() => fields.current?.querySelector<HTMLElement>(FIRST_FIELD)?.focus());
  }, [step]);

  const mutation = useSessionMutation({
    mutationKey: ADD_KEY,
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

  const form = useInventoryItemForm(
    defaultValues,
    async (values) => {
      const { mode, programId, facilityId, catalogItemId, details } =
        inventoryItemSchema.parse(values);
      const catalogItem = catalog.find((item) => item.id === catalogItemId);
      if (!catalogItem) {
        form.setFieldValue('catalogItemId', null);
        for (const name of POWER_FIELDS) form.setFieldValue(name, '');
        setModelGone(true);
        setStep('equipment');
        return;
      }
      const selection = { mode, programId, facilityId };
      const body = toInventoryItemBody(details, selection, catalogItem);
      await mutation
        .mutateAsync({
          body,
          saved: { selection, status: body.functionalStatus, name: body.referenceName },
        })
        .catch(() => undefined);
    },
    () => focusFirstError(fields.current),
  );

  const chosen = useStore(form.store, (state) =>
    Boolean(state.values.programId && state.values.facilityId && state.values.catalogItemId),
  );
  const dirty = useStore(form.store, (state) => !state.isDefaultValue);
  const guard = useItemDialogGuard({
    dirty,
    pending: mutation.isPending,
    allowLeave: () => leaving.current,
  });

  const toDetails = () => {
    if (!chosen) return;
    setModelGone(false);
    setStep('details');
  };
  const toEquipment = () => {
    mutation.reset();
    setStep('equipment');
  };
  const submit = () => {
    if (step === 'equipment') toDetails();
    else if (!form.state.isSubmitting && !leaving.current) void form.handleSubmit();
  };

  return (
    <>
      <FormDialogForm onSubmit={submit}>
        <AddEquipmentHeader step={step} />
        <FormDialogBody>
          <div
            className="@container/item flex flex-col gap-8"
            inert={mutation.isPending}
            ref={fields}
          >
            {step === 'equipment' ? (
              <>
                {modelGone && (
                  <ErrorAlert
                    description={t('cce-inventory.form.model-gone')}
                    title={t('cce-inventory.form.model-gone-title')}
                  />
                )}
                <Section legend={t('cce-inventory.form.equipment')}>
                  <PairFields form={form} options={options} />
                  <ModelFields catalog={catalog} form={form} />
                </Section>
              </>
            ) : (
              <>
                {mutation.isError && (
                  <div ref={errorAlert}>
                    <ErrorAlert
                      description={
                        serverMessage(mutation.error) ?? t('cce-inventory.form.save-error')
                      }
                      title={t('cce-inventory.form.save-error-title')}
                    />
                  </div>
                )}
                <ChosenEquipment {...chosenLabels(form.state.values, options, catalog)} />
                <DetailsFields catalog={catalog} form={form} />
              </>
            )}
          </div>
        </FormDialogBody>
        <FormDialogFooter>
          <FormDialogCancel disabled={mutation.isPending}>
            {t('cce-inventory.form.cancel')}
          </FormDialogCancel>
          {step === 'equipment' ? (
            <FormDialogSubmit disabled={!chosen} key="next">
              {t('cce-inventory.form.next')}
            </FormDialogSubmit>
          ) : (
            <>
              <Button
                disabled={mutation.isPending}
                onClick={toEquipment}
                type="button"
                variant="outline"
              >
                {t('cce-inventory.form.back')}
              </Button>
              <FormDialogSubmit key="save" pending={mutation.isPending}>
                {t('cce-inventory.form.save')}
              </FormDialogSubmit>
            </>
          )}
        </FormDialogFooter>
      </FormDialogForm>
      <DiscardChangesDialog
        description={t('cce-inventory.form.discard-description')}
        {...guard}
        onKeepEditing={() => {
          guard.onKeepEditing();
          onCloseCancelled();
        }}
      />
    </>
  );
}

function AddEquipmentHeader({ step }: { step: Step }) {
  const { t } = useTranslation();
  return (
    <FormDialogHeader>
      <FormDialogTitle>{t('cce-inventory.form.title')}</FormDialogTitle>
      <FormDialogDescription>
        {t(
          step === 'equipment'
            ? 'cce-inventory.form.description'
            : 'cce-inventory.form.details-description',
        )}
      </FormDialogDescription>
    </FormDialogHeader>
  );
}

const SKELETON_FIELDS: readonly { label: ParseKeys; required?: boolean }[] = [
  { label: 'facility-program.mode' },
  { label: 'facility-program.facility', required: true },
  { label: 'facility-program.program', required: true },
  { label: 'cce-inventory.form.equipment-type', required: true },
  { label: 'cce-inventory.form.make-model', required: true },
];

function AddEquipmentSkeleton() {
  const { t } = useTranslation();
  return (
    <>
      <AddEquipmentHeader step="equipment" />
      <FormDialogBody>
        <div aria-busy className="@container/item">
          <Section legend={t('cce-inventory.form.equipment')}>
            {SKELETON_FIELDS.map(({ label, required }, index) => (
              <div className={index === 0 ? '@3xl/item:col-span-2' : undefined} key={label}>
                <FieldSkeleton label={t(label)} required={required} />
              </div>
            ))}
          </Section>
        </div>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('cce-inventory.form.cancel')}</FormDialogCancel>
        <Button disabled>{t('cce-inventory.form.next')}</Button>
      </FormDialogFooter>
    </>
  );
}
