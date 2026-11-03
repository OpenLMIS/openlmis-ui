import { useStore } from '@tanstack/react-form';
import { useIsMutating, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import type { ParseKeys } from 'i18next';
import { type Ref, useCallback, useRef, useState } from 'react';
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
  DetailsFields,
  Section,
} from '@/features/cce-inventory/components/inventory-item-sections';
import { ModelFields } from '@/features/cce-inventory/components/inventory-model-fields';
import { PairFields } from '@/features/cce-inventory/components/inventory-pair-fields';
import { useInventoryItemForm } from '@/features/cce-inventory/components/use-inventory-item-form';
import { useItemDialogGuard } from '@/features/cce-inventory/components/use-item-dialog-guard';
import { equipmentTypes, soleItem, soleModelId } from '@/features/cce-inventory/lib/catalog';
import {
  EMPTY_INVENTORY_ITEM_DETAILS,
  type InventoryItemValues,
  inventoryItemSchema,
  powerFor,
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
  type SelectionMode,
} from '@/lib/facility-program-selection';
import { queryKeys } from '@/lib/key-factory';
import type { ProgramGrant } from '@/lib/permissions';

const ADD_KEY = ['cce-inventory', 'add'];

export type SavedInventoryItem = {
  selection: CompleteSelection;
  status: EquipmentStatus;
  name: string;
};

type SaveRequest = { body: InventoryItemBody; selection: CompleteSelection };

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

function offers(mode: SelectionMode, options: FacilityProgramOptions) {
  return mode === 'my'
    ? Boolean(options.home) && options.myPrograms.length > 0
    : options.supervisedPrograms.length > 0;
}

function startSelection(initial: FacilityProgramSelection, options: FacilityProgramOptions) {
  const start = initialSelection(initial, options);
  const mode = start.mode ?? 'supervised';
  const other = mode === 'my' ? 'supervised' : 'my';
  return !offers(mode, options) && offers(other, options) ? changeMode(other, options) : start;
}

function startValues(
  selection: FacilityProgramSelection,
  catalog: readonly CatalogItem[],
): InventoryItemValues {
  const equipmentType = soleItem(equipmentTypes(catalog));
  const catalogItemId = soleModelId(catalog, equipmentType);
  const power = powerFor(catalog, catalogItemId);
  return {
    pair: {
      mode: selection.mode ?? 'supervised',
      programId: selection.programId ?? null,
      facilityId: selection.facilityId ?? null,
    },
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
  const { data } = useSuspenseQuery({ ...catalogItemsOptions(), staleTime: 0 });
  const [catalog] = useState(data);
  const [defaultValues] = useState(() => startValues(startSelection(initial, options), catalog));
  const [step, setStep] = useState<Step>('equipment');
  const fields = useRef<HTMLDivElement>(null);
  const stepHeading = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);

  const showStep = (next: Step) => {
    setStep(next);
    requestAnimationFrame(() => stepHeading.current?.focus());
  };

  const mutation = useSessionMutation({
    mutationKey: ADD_KEY,
    mutationFn: ({ body }: SaveRequest) => createInventoryItem(body),
    onSuccess: (_, { body, selection }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventoryItems.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.home.all });
      leaving.current = true;
      onSaved({ selection, status: body.functionalStatus, name: body.referenceName });
    },
  });

  const form = useInventoryItemForm(
    defaultValues,
    async (values) => {
      const { pair, catalogItemId, details } = inventoryItemSchema.parse(values);
      const catalogItem = catalog.find((item) => item.id === catalogItemId);
      if (!catalogItem) return;
      await mutation
        .mutateAsync({ body: toInventoryItemBody(details, pair, catalogItem), selection: pair })
        .catch(() => undefined);
    },
    () =>
      requestAnimationFrame(() =>
        fields.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      ),
  );

  const chosen = useStore(form.store, (state) =>
    Boolean(
      state.values.pair.programId && state.values.pair.facilityId && state.values.catalogItemId,
    ),
  );
  const dirty = useStore(form.store, (state) => !state.isDefaultValue);
  const allowLeave = useCallback(() => leaving.current, []);
  const guard = useItemDialogGuard({ dirty, pending: mutation.isPending, allowLeave });

  const submit = () => {
    if (step === 'equipment') {
      if (chosen) showStep('details');
    } else if (!form.state.isSubmitting && !leaving.current) void form.handleSubmit();
  };

  return (
    <>
      <FormDialogForm onSubmit={submit}>
        <AddEquipmentHeader step={step} stepRef={stepHeading} />
        <FormDialogBody>
          <div
            className="@container/item flex flex-col gap-8"
            inert={mutation.isPending}
            ref={fields}
          >
            {step === 'equipment' ? (
              <Section legend={t('cce-inventory.form.equipment')}>
                <PairFields form={form} options={options} />
                <ModelFields catalog={catalog} form={form} />
              </Section>
            ) : (
              <>
                {mutation.isError && (
                  <ErrorAlert
                    description={
                      serverMessage(mutation.error) ?? t('cce-inventory.form.save-error')
                    }
                    title={t('cce-inventory.form.save-error-title')}
                  />
                )}
                <ChosenEquipment catalog={catalog} form={form} options={options} />
                <DetailsFields catalog={catalog} form={form} />
              </>
            )}
          </div>
        </FormDialogBody>
        <FormDialogFooter>
          <FormDialogCancel disabled={mutation.isPending}>{t('dialog.cancel')}</FormDialogCancel>
          {step === 'equipment' ? (
            <FormDialogSubmit disabled={!chosen} key="next">
              {t('cce-inventory.form.next')}
            </FormDialogSubmit>
          ) : (
            <>
              <Button
                disabled={mutation.isPending}
                onClick={() => {
                  mutation.reset();
                  showStep('equipment');
                }}
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

function AddEquipmentHeader({ step, stepRef }: { step: Step; stepRef?: Ref<HTMLDivElement> }) {
  const { t } = useTranslation();
  return (
    <FormDialogHeader>
      <FormDialogTitle>{t('cce-inventory.form.title')}</FormDialogTitle>
      <div className="outline-none" ref={stepRef} tabIndex={-1}>
        <FormDialogDescription>
          {t(
            step === 'equipment'
              ? 'cce-inventory.form.description'
              : 'cce-inventory.form.details-description',
          )}
        </FormDialogDescription>
      </div>
    </FormDialogHeader>
  );
}

const SKELETON_FIELDS: readonly ParseKeys[] = [
  'facility-program.facility',
  'facility-program.program',
  'cce-inventory.form.equipment-type',
  'cce-inventory.make-model',
];

function AddEquipmentSkeleton() {
  const { t } = useTranslation();
  return (
    <>
      <AddEquipmentHeader step="equipment" />
      <FormDialogBody>
        <div aria-busy className="@container/item">
          <Section legend={t('cce-inventory.form.equipment')}>
            <div className="@3xl/item:col-span-2">
              <FieldSkeleton label={t('facility-program.mode')} />
            </div>
            {SKELETON_FIELDS.map((label) => (
              <FieldSkeleton key={label} label={t(label)} required />
            ))}
          </Section>
        </div>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('dialog.cancel')}</FormDialogCancel>
        <Button disabled>{t('cce-inventory.form.next')}</Button>
      </FormDialogFooter>
    </>
  );
}
