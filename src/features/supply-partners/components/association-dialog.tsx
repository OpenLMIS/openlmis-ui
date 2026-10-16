import { revalidateLogic, useStore } from '@tanstack/react-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ParseKeys } from 'i18next';
import { BuildingIcon } from 'lucide-react';
import { type RefObject, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { DialogNotFound, ErrorAlert, serverMessage } from '@/components/dialog-parts';
import { useAppForm } from '@/components/form/form';
import { FieldAbout } from '@/components/form/form-fields';
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
import { ListError } from '@/components/list-error';
import { PickerAdd, PickerAddButton, PickerAddField, PickerAddIcon } from '@/components/picker-add';
import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { FieldGroup } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';
import {
  facilitiesByIdsOptions,
  facilityTypeApprovedOrderablesOptions,
  programsOptions,
  supervisedFacilitiesOptions,
  supervisoryNodesOptions,
} from '@/features/reference-data/api/queries';
import { programName } from '@/features/reference-data/lib/programs';
import type { Facility } from '@/features/reference-data/lib/types';
import { removeSupplyPartnerFacility } from '@/features/supply-partners/api/api';
import { AssociationMembersTable } from '@/features/supply-partners/components/association-members-table';
import { AssociationProductsDialog } from '@/features/supply-partners/components/association-products-dialog';
import {
  ReferenceStatus,
  usePartnerReferences,
} from '@/features/supply-partners/components/supply-partner-references';
import {
  associationKey,
  availablePartnerNodes,
  availablePrograms,
} from '@/features/supply-partners/lib/association';
import type { AssociationDraft } from '@/features/supply-partners/lib/types';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { isRefused } from '@/lib/http';

const EMPTY: AssociationDraft = {
  programId: '',
  supervisoryNodeId: '',
  facilityIds: [],
  orderableIds: [],
};
const schema = z.object({
  programId: z.string().nullable().refine(Boolean, 'supply-partners.program-required'),
  supervisoryNodeId: z.string().nullable().refine(Boolean, 'supply-partners.node-required'),
  facilityIds: z.array(z.string()).min(1, 'supply-partners.facilities-required'),
  orderableIds: z.array(z.string()).min(1, 'supply-partners.products-required'),
});
const toAssociationDraft = (
  value: Omit<AssociationDraft, 'programId' | 'supervisoryNodeId'> & {
    programId: string | null;
    supervisoryNodeId: string | null;
  },
): AssociationDraft => ({
  ...value,
  programId: value.programId ?? '',
  supervisoryNodeId: value.supervisoryNodeId ?? '',
});
const snapshot = (draft: AssociationDraft) =>
  JSON.stringify({
    ...draft,
    facilityIds: draft.facilityIds.toSorted(),
    orderableIds: draft.orderableIds.toSorted(),
  });
type Props = {
  returnFocus?: RefObject<HTMLButtonElement | null>;
  target: string | undefined;
  associations: AssociationDraft[];
  canManageNodes: boolean;
  productsOpen: boolean;
  onOpenProducts: () => void;
  onCloseProducts: () => void;
  onInvalidProducts: () => void;
  onClose: () => void;
  onCommit: (draft: AssociationDraft) => void;
  onDirtyChange: (dirty: boolean) => void;
  onProductsDirtyChange: (dirty: boolean) => void;
  onPendingChange: (pending: boolean) => void;
};
export function AssociationDialog({ target, onClose, returnFocus, ...props }: Props) {
  const { t } = useTranslation();
  const { shown, dialogProps } = useDialogTarget(target, onClose);
  const [pending, setPending] = useState(false);
  const reportPending = useCallback(
    (value: boolean) => {
      setPending(value);
      props.onPendingChange(value);
    },
    [props.onPendingChange],
  );
  const row = props.associations.find((item) => associationKey(item) === shown);
  return (
    <FormDialog
      {...dialogProps(pending)}
      onOpenChangeComplete={(open) => {
        dialogProps(pending).onOpenChangeComplete(open);
        if (!open) returnFocus?.current?.focus();
      }}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
      closeButton={!pending}
      size="table"
    >
      {shown &&
        (shown === 'new' || row ? (
          <AssociationForm
            key={shown}
            {...props}
            initial={row ?? EMPTY}
            editingKey={row ? shown : undefined}
            onPendingChange={reportPending}
          />
        ) : (
          <DialogNotFound
            title={t('supply-partners.edit-association')}
            description={t('supply-partners.unavailable')}
          />
        ))}
    </FormDialog>
  );
}
function AssociationForm({
  initial,
  editingKey,
  associations,
  canManageNodes,
  productsOpen,
  onOpenProducts,
  onCloseProducts,
  onInvalidProducts,
  onCommit,
  onDirtyChange,
  onProductsDirtyChange,
  onPendingChange,
}: Omit<Props, 'target' | 'onClose' | 'returnFocus'> & {
  initial: AssociationDraft;
  editingKey?: string;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [opening] = useState(() => structuredClone(initial));
  const [initialValues] = useState(() => ({
    ...opening,
    programId: opening.programId || null,
    supervisoryNodeId: opening.supervisoryNodeId || null,
  }));
  const [error, setError] = useState<ParseKeys | null>(null);
  const [pruned, setPruned] = useState<string[]>([]);
  const programs = useQuery(programsOptions());
  const nodes = useQuery(supervisoryNodesOptions());
  const form = useAppForm({
    defaultValues: { association: initialValues },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: z.object({ association: schema }) },
    onSubmitInvalid: () => {
      const value = form.state.values.association;
      setError(
        !value.programId
          ? 'supply-partners.program-required'
          : !value.supervisoryNodeId
            ? 'supply-partners.node-required'
            : !value.facilityIds.length
              ? 'supply-partners.facilities-required'
              : 'supply-partners.products-required',
      );
    },
    onSubmit: ({ value }) => {
      const association = toAssociationDraft(value.association);
      if (
        associations.some(
          (item) =>
            associationKey(item) !== editingKey &&
            associationKey(item) === associationKey(association),
        )
      ) {
        setError('supply-partners.duplicate-pair');
        return;
      }
      onCommit(association);
    },
  });
  const values = useStore(form.store, (state) => state.values.association);
  const draft = toAssociationDraft(values);
  const invalidProducts = productsOpen && !draft.facilityIds.length;
  useLayoutEffect(() => {
    if (invalidProducts) onInvalidProducts();
  }, [invalidProducts, onInvalidProducts]);
  const paired = Boolean(draft.programId && draft.supervisoryNodeId);
  const refs = usePartnerReferences(paired ? [draft] : []);
  const program = programs.data?.find(({ id }) => id === draft.programId);
  const node = nodes.data?.find(({ id }) => id === draft.supervisoryNodeId);
  const supervision = useQuery({
    ...supervisedFacilitiesOptions({
      parentNodeId: node?.partnerNodeOf?.id ?? '',
      programId: draft.programId,
    }),
    enabled: canManageNodes && Boolean(node?.partnerNodeOf && program),
  });
  const facilityRecords = draft.facilityIds.flatMap((id) => {
    const record = refs.facilities.data?.find((item) => item.id === id);
    return record ? [record] : [];
  });
  const options = useQuery({
    ...facilityTypeApprovedOrderablesOptions({
      facilityTypeCodes: facilityRecords.map((item) => item.type.code),
      programCode: program?.code ?? '',
    }),
    enabled: Boolean(
      program && draft.facilityIds.length && facilityRecords.length === draft.facilityIds.length,
    ),
  });
  const facilityLookupReady = refs.facilities.isSuccess && refs.facilities.fetchStatus === 'idle';
  const removal = useSessionMutation({
    mutationFn: (id: string) => {
      const association = toAssociationDraft(form.state.values.association);
      const lookup = queryClient.getQueryState<Facility[]>(
        facilitiesByIdsOptions([...new Set(association.facilityIds)].sort()).queryKey,
      );
      return removeSupplyPartnerFacility(
        queryClient,
        association,
        id,
        lookup?.data ?? [],
        program?.code ?? '',
        lookup?.status === 'success' && lookup.fetchStatus === 'idle',
      );
    },
    onMutate: () => setPruned([]),
    onSuccess: (result) => {
      form.setFieldValue('association', result.association);
      setPruned(
        result.removedOrderableIds.map(
          (id) =>
            refs.products.data?.find((item) => item.id === id)?.fullProductName ??
            refs.products.data?.find((item) => item.id === id)?.productCode ??
            t('supply-partners.unavailable'),
        ),
      );
    },
  });
  const busy = removal.isPending;
  const dirty = snapshot(draft) !== snapshot(opening);
  useLayoutEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  useLayoutEffect(() => {
    onPendingChange(busy);
    return () => onPendingChange(false);
  }, [busy, onPendingChange]);
  const clearMembers = () => {
    form.setFieldValue('association', {
      ...form.state.values.association,
      facilityIds: [],
      orderableIds: [],
    });
    setPruned([]);
    removal.reset();
    setError(null);
  };
  const lookupError = programs.error ?? nodes.error;
  const refused = !canManageNodes || isRefused(supervision.error);
  const canPickProducts = Boolean(
    draft.facilityIds.length &&
      facilityRecords.length === draft.facilityIds.length &&
      options.isSuccess,
  );
  const missingMembers = paired && !refs.complete;
  return (
    <FormDialogForm
      onSubmit={() => {
        if (!busy && !missingMembers) void form.handleSubmit();
      }}
    >
      <FormDialogHeader>
        <FormDialogTitle>
          {t(editingKey ? 'supply-partners.edit-association' : 'supply-partners.add-association')}
        </FormDialogTitle>
        <FormDialogDescription>
          {t('supply-partners.association-description')}
        </FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody layout="table">
        <FieldGroup>
          {error && (
            <ErrorAlert title={t('supply-partners.association-invalid')} description={t(error)} />
          )}
          {lookupError && (
            <ListError
              error={lookupError}
              reset={() => {
                void programs.refetch();
                void nodes.refetch();
              }}
              title={t('supply-partners.lookup-error-title')}
              description={t('supply-partners.load-error')}
            />
          )}
          <div className="grid gap-4 @3xl/main:grid-cols-2">
            <form.AppField name="association.programId" listeners={{ onChange: clearMembers }}>
              {(field) => (
                <field.ComboboxField
                  label={t('supply-partners.program')}
                  required
                  disabled={Boolean(editingKey) || busy || !programs.isSuccess}
                  clearLabel={t('data-table.clear-selection')}
                  placeholder={t('supply-partners.pick-program')}
                  emptyMessage={t('supply-partners.no-options')}
                  items={availablePrograms(
                    programs.data ?? [],
                    draft.supervisoryNodeId,
                    associations,
                    editingKey,
                  ).map((item) => ({
                    value: item.id,
                    label: programName(item),
                    description: item.code,
                  }))}
                />
              )}
            </form.AppField>
            <form.AppField
              name="association.supervisoryNodeId"
              listeners={{ onChange: clearMembers }}
            >
              {(field) => (
                <field.ComboboxField
                  label={t('supply-partners.node')}
                  labelAction={
                    <FieldAbout
                      label={t('supply-partners.node')}
                      description={t('supply-partners.program-node-note')}
                    />
                  }
                  required
                  disabled={Boolean(editingKey) || busy || !nodes.isSuccess}
                  clearLabel={t('data-table.clear-selection')}
                  placeholder={t('supply-partners.pick-node')}
                  emptyMessage={t('supply-partners.no-options')}
                  items={availablePartnerNodes(
                    nodes.data ?? [],
                    draft.programId,
                    associations,
                    editingKey,
                  ).map((item) => ({ value: item.id, label: item.name, description: item.code }))}
                />
              )}
            </form.AppField>
          </div>
          {paired && <ReferenceStatus associations={[draft]} />}
          <section className="flex flex-col gap-3" aria-labelledby="association-facilities">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <h3 className="font-medium" id="association-facilities">
                  {t('supply-partners.facilities')}
                </h3>
                <FieldAbout
                  label={t('supply-partners.facilities')}
                  description={t('supply-partners.removal-warning')}
                />
              </div>
              <p className="text-muted-foreground text-sm">
                {t('supply-partners.facilities-note')}
              </p>
            </div>
            {refused && (
              <ErrorAlert
                title={t('no-access.title')}
                description={t('supply-partners.facility-right-required')}
              />
            )}
            <div className="flex gap-2 @3xl/main:max-w-xl">
              <FacilityPicker
                key={associationKey(draft)}
                items={(supervision.data ?? []).filter(
                  (item) => !draft.facilityIds.includes(item.id),
                )}
                disabled={busy || refused || !supervision.isSuccess}
                onAdd={(id) => {
                  form.setFieldValue('association.facilityIds', [
                    ...form.state.values.association.facilityIds,
                    id,
                  ]);
                  setError(null);
                }}
              />
            </div>
            {!refused && supervision.isError && (
              <ListError
                error={supervision.error}
                reset={() => void supervision.refetch()}
                title={t('supply-partners.lookup-error-title')}
                description={t('supply-partners.load-error')}
              />
            )}
            <Separator />
            {removal.isError && (
              <ErrorAlert
                title={t('supply-partners.lookup-error-title')}
                description={serverMessage(removal.error) ?? t('supply-partners.prune-error')}
              />
            )}
            {pruned.length > 0 && (
              <p role="status" className="text-sm">
                {t('supply-partners.pruned', {
                  count: pruned.length,
                  products: new Intl.ListFormat(i18n.language).format(pruned),
                })}
              </p>
            )}
            <AssociationMembersTable
              kind="facilities"
              pending={busy || refs.products.isPending || !facilityLookupReady}
              rows={draft.facilityIds.map((id) => {
                const item = refs.facilities.data?.find((record) => record.id === id);
                return {
                  id,
                  name: item
                    ? item.name
                    : refs.facilities.isPending
                      ? null
                      : t('supply-partners.unavailable'),
                  loading: !item && refs.facilities.isPending,
                  removeDisabled:
                    draft.facilityIds.length > 1 &&
                    (!program ||
                      (Boolean(item) &&
                        draft.facilityIds.some(
                          (remainingId) =>
                            remainingId !== id &&
                            !facilityRecords.some((facility) => facility.id === remainingId),
                        ))),
                  code: item?.code ?? '',
                  note:
                    canManageNodes &&
                    supervision.isSuccess &&
                    !supervision.data.some((record) => record.id === id)
                      ? t('supply-partners.no-longer-supervised')
                      : undefined,
                };
              })}
              onRemove={(id) => {
                if (draft.facilityIds.length > 1 && !program) return;
                void removal.mutateAsync(id).catch(() => undefined);
              }}
            />
          </section>
          <section className="flex flex-col gap-3" aria-labelledby="association-products">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <h3 className="font-medium" id="association-products">
                    {t('supply-partners.products')}
                  </h3>
                  <FieldAbout
                    label={t('supply-partners.products')}
                    description={t('supply-partners.add-facility-first')}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !canPickProducts}
                  onClick={onOpenProducts}
                >
                  {t('supply-partners.add-products')}
                </Button>
              </div>
              <p className="text-muted-foreground text-sm">{t('supply-partners.products-note')}</p>
            </div>
            {options.isError && (
              <ListError
                error={options.error}
                reset={() => void options.refetch()}
                title={t('supply-partners.lookup-error-title')}
                description={t('supply-partners.load-error')}
              />
            )}
            <AssociationMembersTable
              kind="products"
              pending={busy}
              rows={draft.orderableIds.map((id) => {
                const item = refs.products.data?.find((record) => record.id === id);
                return {
                  id,
                  name: item
                    ? item.fullProductName
                    : refs.products.isPending
                      ? null
                      : t('supply-partners.unavailable'),
                  loading: !item && refs.products.isPending,
                  code: item?.productCode ?? '',
                  note:
                    options.isSuccess && !options.data.some((record) => record.id === id)
                      ? t('supply-partners.unavailable-for-add')
                      : undefined,
                };
              })}
              onRemove={(id) =>
                form.setFieldValue(
                  'association.orderableIds',
                  form.state.values.association.orderableIds.filter((item) => item !== id),
                )
              }
            />
          </section>
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel disabled={busy}>{t('dialog.cancel')}</FormDialogCancel>
        <FormDialogSubmit pending={busy} disabled={missingMembers || Boolean(lookupError)}>
          {t(editingKey ? 'supply-partners.save-association' : 'supply-partners.add-association')}
        </FormDialogSubmit>
      </FormDialogFooter>
      <AssociationProductsDialog
        open={
          productsOpen &&
          Boolean(
            draft.facilityIds.length &&
              facilityRecords.length === draft.facilityIds.length &&
              options.data !== undefined,
          )
        }
        selectedIds={draft.orderableIds}
        selectedProducts={refs.products.data ?? []}
        options={options.data ?? []}
        onClose={onCloseProducts}
        onDirtyChange={onProductsDirtyChange}
        onCommit={(ids) => {
          form.setFieldValue('association.orderableIds', ids);
          setError(null);
        }}
      />
    </FormDialogForm>
  );
}
function FacilityPicker({
  items,
  disabled,
  onAdd,
}: {
  items: Facility[];
  disabled: boolean;
  onAdd: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const picked = items.find((item) => item.id === pickedId) ?? null;
  return (
    <PickerAdd>
      <Combobox
        items={items}
        value={picked}
        disabled={disabled}
        itemToStringLabel={(item) => item.name ?? item.code}
        onValueChange={(item) => setPickedId(item?.id ?? null)}
      >
        <PickerAddField ref={anchor}>
          <ComboboxInput
            width="full"
            placeholder={t('supply-partners.pick-facility')}
            aria-label={t('supply-partners.pick-facility')}
            disabled={disabled}
          >
            <PickerAddIcon>
              <BuildingIcon />
            </PickerAddIcon>
          </ComboboxInput>
        </PickerAddField>
        <ComboboxContent anchor={anchor}>
          <ComboboxEmpty>{t('supply-partners.no-options')}</ComboboxEmpty>
          <ComboboxList>
            {(item: Facility) => (
              <ComboboxItem key={item.id} value={item}>
                <span dir="auto">{item.name ?? item.code}</span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <PickerAddButton
        disabled={disabled || !picked}
        onClick={() => {
          if (picked) {
            onAdd(picked.id);
            setPickedId(null);
          }
        }}
      >
        {t('supply-partners.add-facility')}
      </PickerAddButton>
    </PickerAdd>
  );
}
