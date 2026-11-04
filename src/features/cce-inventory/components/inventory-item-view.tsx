import { useStore } from '@tanstack/react-form';
import { useIsMutating, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import type { ParseKeys } from 'i18next';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import {
  DialogLoadError,
  DialogNotFound,
  ErrorAlert,
  SkeletonLine,
  serverMessage,
} from '@/components/display/dialog-parts';
import { DiscardChangesDialog } from '@/components/display/discard-changes-dialog';
import { formatDateValue, formatTimestamp } from '@/components/form/date-value';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchInventoryItem, updateInventoryItem } from '@/features/cce-inventory/api/api';
import { inventoryItemOptions } from '@/features/cce-inventory/api/queries';
import {
  SAVE_KEY,
  StatusItem,
  TransferItem,
  useItemSave,
} from '@/features/cce-inventory/components/inventory-item-actions';
import {
  DetailsFields,
  GAUGE_KEYS,
  MONITOR_KEYS,
  POWER_KEYS,
  type ReadOnlyRow,
  ReadOnlySection,
  UTILIZATION_KEYS,
} from '@/features/cce-inventory/components/inventory-item-sections';
import { useCloseOnce } from '@/features/cce-inventory/components/use-close-once';
import { useInventoryItemForm } from '@/features/cce-inventory/components/use-inventory-item-form';
import { useItemDialogGuard } from '@/features/cce-inventory/components/use-item-dialog-guard';
import { makeModelLabel } from '@/features/cce-inventory/lib/catalog';
import {
  inventoryItemSchema,
  solarPower,
  toEditValues,
  toInventoryItemUpdate,
  type ValidInventoryItemDetails,
} from '@/features/cce-inventory/lib/inventory-item-form';
import type { InventorySearch } from '@/features/cce-inventory/lib/search';
import type { InventoryItemRecord, PowerStatus } from '@/features/cce-inventory/lib/types';
import { facilityOptions, programLookupOptions } from '@/features/reference-data/api/queries';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { useOpening } from '@/hooks/use-opening';
import { EQUIPMENT_REASON_KEYS, EQUIPMENT_STATUS } from '@/lib/cce-equipment-status';
import { isNotFound, isRefused } from '@/lib/http';
import type { ProgramGrant } from '@/lib/permissions';
import { fullName } from '@/lib/text';

export type ItemAction = NonNullable<InventorySearch['action']>;

type InventoryItemViewProps = {
  itemId: string | undefined;
  action: ItemAction | undefined;
  userId: string;
  grants: readonly ProgramGrant[];
  transferGrants: readonly ProgramGrant[];
  onClose: () => void;
  onAction: (action: ItemAction | undefined) => void;
};

export function InventoryItemView({ itemId, onClose, ...content }: InventoryItemViewProps) {
  const { shown, dialogProps } = useDialogTarget(itemId, onClose);
  const pending = useIsMutating({ mutationKey: SAVE_KEY }) > 0;
  const { opening, requestClose, cancelClose } = useCloseOnce(itemId !== undefined, onClose);

  return (
    <FormDialog
      {...dialogProps(pending)}
      onOpenChange={(next) => {
        if (!next && !pending) requestClose();
      }}
      size="2xl"
    >
      {shown && (
        <ItemBoundary
          {...content}
          id={shown}
          key={opening}
          onCloseCancelled={cancelClose}
          onDone={requestClose}
        />
      )}
    </FormDialog>
  );
}

function ItemBoundary(props: ItemContentProps) {
  const { t } = useTranslation();
  const opening = useOpening();
  return (
    <QueryBoundary
      errorComponent={({ error, reset }) =>
        isNotFound(error) || isRefused(error) ? (
          <DialogNotFound
            description={t(
              isRefused(error) ? 'no-access.description' : 'cce-inventory.details.not-found',
            )}
            title={t('cce-inventory.details.title')}
          />
        ) : (
          <DialogLoadError
            error={error}
            errorTitle={t('cce-inventory.details.load-error-title')}
            onRetry={reset}
            title={t('cce-inventory.details.title')}
          />
        )
      }
      pendingFallback={<ViewSkeleton />}
      resetKey={props.id}
    >
      <ItemContent {...props} opening={opening} />
    </QueryBoundary>
  );
}

type ItemContentProps = Omit<InventoryItemViewProps, 'itemId' | 'onClose'> & {
  id: string;
  onCloseCancelled: () => void;
  onDone: () => void;
};

const grantsPair = (grants: readonly ProgramGrant[], item: InventoryItemRecord) =>
  grants.some(
    (grant) => grant.facilityId === item.facility.id && grant.programId === item.program.id,
  );

function ItemContent({
  id,
  opening,
  action,
  userId,
  grants,
  transferGrants,
  onAction,
  onDone,
  onCloseCancelled,
}: ItemContentProps & { opening: number }) {
  const { data: item } = useSuspenseQuery(inventoryItemOptions(id, opening));
  const [{ data: facility }, { data: program }] = useSuspenseQueries({
    queries: [facilityOptions(item.facility.id), programLookupOptions(item.program.id)],
  });
  const canEdit = grantsPair(grants, item);
  const canTransfer = grantsPair(transferGrants, item);
  const header: ReadOnlyRow[] = [
    ['cce-inventory.details.district', facility.geographicZone.name],
    ['facility-program.facility', facility.name],
    ['facility-program.program', program.name],
    ['cce-inventory.form.equipment-type', item.catalogItem.type],
  ];
  const actionProps = { item, userId, onDone, onCloseCancelled, onBack: () => onAction(undefined) };
  if (action === 'edit' && canEdit) return <EditItem {...actionProps} header={header} />;
  if (action === 'status' && canEdit)
    return <StatusItem {...actionProps} facilityName={facility.name} />;
  if (action === 'transfer' && canTransfer)
    return <TransferItem {...actionProps} grants={transferGrants} />;
  return (
    <ItemDetails
      canEdit={canEdit}
      canTransfer={canTransfer}
      header={header}
      item={item}
      onAction={onAction}
    />
  );
}

const optional = (label: ParseKeys, value: string | number | undefined): ReadOnlyRow[] =>
  value === undefined || value === '' ? [] : [[label, value]];

function ItemDetails({
  item,
  header,
  canEdit,
  canTransfer,
  onAction,
}: {
  item: InventoryItemRecord;
  header: ReadOnlyRow[];
  canEdit: boolean;
  canTransfer: boolean;
  onAction: (action: ItemAction) => void;
}) {
  const { t, i18n } = useTranslation();
  const timeZone = useDeploymentTimeZone();
  const { labelKey, tone, icon: Icon } = EQUIPMENT_STATUS[item.functionalStatus];
  const modifier = fullName(item.lastModifier ?? {});
  const modified = formatTimestamp(item.modifiedDate, i18n.language, { time: true, timeZone });
  const reason = item.reasonNotWorkingOrNotInUse;
  const power = (value: PowerStatus) =>
    t(POWER_KEYS[solarPower(item.catalogItem.energySource, value)]);
  const volume = item.catalogItem.netVolume;

  return (
    <>
      <FormDialogHeader>
        <FormDialogTitle>
          <bdi>{item.referenceName}</bdi>
        </FormDialogTitle>
        <FormDialogDescription>{t('cce-inventory.details.description')}</FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col items-start gap-1 text-sm">
              <Badge variant={tone}>
                <Icon data-icon="inline-start" />
                {t(labelKey)}
              </Badge>
              {reason && <span>{t(EQUIPMENT_REASON_KEYS[reason])}</span>}
              {item.decommissionDate && (
                <span>
                  {t('cce-inventory.details.decommissioned', {
                    date: formatDateValue(item.decommissionDate, i18n.language),
                  })}
                </span>
              )}
              {(modifier || modified) && (
                <span className="text-muted-foreground">
                  <bdi>{modifier}</bdi> {modified}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {canEdit && (
                <Button onClick={() => onAction('status')} variant="outline">
                  {t('cce-inventory.details.update-status')}
                </Button>
              )}
              {canTransfer && (
                <Button onClick={() => onAction('transfer')} variant="outline">
                  {t('cce-inventory.transfer.open')}
                </Button>
              )}
            </div>
          </div>
          <ReadOnlySection
            rows={[
              ...header,
              [
                'cce-inventory.details.net-volume',
                volume === undefined ? '' : t('cce-inventory.details.liters', { volume }),
              ],
            ]}
          />
          <ReadOnlySection
            legend={t('cce-inventory.form.identification')}
            rows={[
              ['cce-inventory.make-model', makeModelLabel(item.catalogItem)],
              ['cce-inventory.form.serial-number', item.equipmentTrackingId],
            ]}
          />
          <ReadOnlySection
            legend={t('cce-inventory.form.history')}
            rows={[
              ['cce-inventory.form.utilization', t(UTILIZATION_KEYS[item.utilization])],
              ['cce-inventory.form.year-of-installation', item.yearOfInstallation],
              ...optional('cce-inventory.form.source', item.source),
              ...optional('cce-inventory.form.year-of-warranty-expiry', item.yearOfWarrantyExpiry),
            ]}
          />
          <ReadOnlySection
            legend={t('cce-inventory.form.installation')}
            rows={[
              ['cce-inventory.form.voltage-stabilizer', power(item.voltageStabilizer)],
              ['cce-inventory.form.backup-generator', power(item.backupGenerator)],
              ['cce-inventory.form.voltage-regulator', power(item.voltageRegulator)],
              [
                'cce-inventory.form.manual-temperature-gauge',
                t(GAUGE_KEYS[item.manualTemperatureGauge]),
              ],
              [
                'cce-inventory.form.remote-temperature-monitor',
                t(MONITOR_KEYS[item.remoteTemperatureMonitor]),
              ],
            ]}
          />
          {item.additionalNotes && (
            <ReadOnlySection
              rows={[['cce-inventory.form.additional-notes', item.additionalNotes]]}
            />
          )}
        </div>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('dialog.close')}</FormDialogCancel>
        {canEdit && (
          <Button autoFocus onClick={() => onAction('edit')}>
            {t('cce-inventory.details.edit')}
          </Button>
        )}
      </FormDialogFooter>
    </>
  );
}

function EditItem({
  item,
  header,
  onBack,
  onCloseCancelled,
}: {
  item: InventoryItemRecord;
  header: ReadOnlyRow[];
  onBack: () => void;
  onCloseCancelled: () => void;
}) {
  const { t } = useTranslation();
  const fields = useRef<HTMLDivElement>(null);
  const {
    mutation: save,
    leaving,
    allowLeave,
  } = useItemSave(
    async (details: ValidInventoryItemDetails) =>
      updateInventoryItem(toInventoryItemUpdate(await fetchInventoryItem(item.id), details)),
    (details) => {
      toast.success(t('cce-inventory.details.saved-title'), {
        description: t('cce-inventory.details.saved', { name: details.referenceName.trim() }),
      });
      onBack();
    },
  );

  const form = useInventoryItemForm(
    toEditValues(item),
    (values) => save.mutateAsync(inventoryItemSchema.parse(values).details).catch(() => undefined),
    () =>
      requestAnimationFrame(() =>
        fields.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      ),
  );
  const dirty = useStore(form.store, (state) => !state.isDefaultValue);
  const guard = useItemDialogGuard({ dirty, pending: save.isPending, allowLeave });

  return (
    <>
      <FormDialogForm
        onSubmit={() => {
          if (!form.state.isSubmitting && !leaving.current) void form.handleSubmit();
        }}
      >
        <FormDialogHeader>
          <FormDialogTitle>{t('cce-inventory.details.edit-title')}</FormDialogTitle>
          <FormDialogDescription>
            {t('cce-inventory.details.edit-description')}
          </FormDialogDescription>
        </FormDialogHeader>
        <FormDialogBody>
          <div className="@container/item flex flex-col gap-8" inert={save.isPending} ref={fields}>
            {save.isError && (
              <ErrorAlert
                description={serverMessage(save.error) ?? t('cce-inventory.form.save-error')}
                title={t('cce-inventory.form.save-error-title')}
              />
            )}
            <ReadOnlySection
              legend={t('cce-inventory.form.equipment')}
              rows={[...header, ['cce-inventory.make-model', makeModelLabel(item.catalogItem)]]}
            />
            <DetailsFields catalog={[item.catalogItem]} form={form} />
          </div>
        </FormDialogBody>
        <FormDialogFooter>
          <Button disabled={save.isPending} onClick={onBack} type="button" variant="outline">
            {t('dialog.cancel')}
          </Button>
          <FormDialogSubmit pending={save.isPending}>
            {t('cce-inventory.form.save')}
          </FormDialogSubmit>
        </FormDialogFooter>
      </FormDialogForm>
      <DiscardChangesDialog
        description={t('cce-inventory.details.discard-description')}
        {...guard}
        onKeepEditing={() => {
          guard.onKeepEditing();
          onCloseCancelled();
        }}
      />
    </>
  );
}

function ViewSkeleton() {
  const { t } = useTranslation();
  return (
    <>
      <FormDialogHeader>
        <FormDialogTitle>{t('cce-inventory.details.title')}</FormDialogTitle>
        <FormDialogDescription>{t('cce-inventory.details.description')}</FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <div aria-busy>
          <ReadOnlySection
            rows={HEADER_SKELETON.map((label) => [
              label,
              <SkeletonLine key={label} width="short" />,
            ])}
          />
        </div>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('dialog.close')}</FormDialogCancel>
      </FormDialogFooter>
    </>
  );
}

const HEADER_SKELETON: readonly ParseKeys[] = [
  'cce-inventory.details.district',
  'facility-program.facility',
  'facility-program.program',
  'cce-inventory.form.equipment-type',
  'cce-inventory.details.net-volume',
];
