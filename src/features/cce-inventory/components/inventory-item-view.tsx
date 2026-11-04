import { useStore } from '@tanstack/react-form';
import {
  useIsMutating,
  useQueryClient,
  useSuspenseQueries,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { ParseKeys } from 'i18next';
import { useCallback, useRef } from 'react';
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
  toEditValues,
  toInventoryItemUpdate,
  type ValidInventoryItemDetails,
} from '@/features/cce-inventory/lib/inventory-item-form';
import type { InventoryItemRecord } from '@/features/cce-inventory/lib/types';
import { facilityOptions, programLookupOptions } from '@/features/reference-data/api/queries';
import { useDeploymentTimeZone } from '@/hooks/use-deployment-time-zone';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { EQUIPMENT_REASON_KEYS, EQUIPMENT_STATUS } from '@/lib/cce-equipment-status';
import { isNotFound } from '@/lib/http';
import { queryKeys } from '@/lib/key-factory';
import type { ProgramGrant } from '@/lib/permissions';

const SAVE_KEY = ['cce-inventory', 'edit'];

type InventoryItemViewProps = {
  itemId: string | undefined;
  editing: boolean;
  grants: readonly ProgramGrant[];
  onClose: () => void;
  onEdit: () => void;
  onDetails: () => void;
  onStatusUpdate: ((item: InventoryItemRecord) => void) | undefined;
};

export function InventoryItemView({ itemId, onClose, ...content }: InventoryItemViewProps) {
  const { t } = useTranslation();
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
        <QueryBoundary
          errorComponent={({ error, reset }) =>
            isNotFound(error) ? (
              <DialogNotFound
                description={t('cce-inventory.details.not-found')}
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
          resetKey={shown}
        >
          <ItemContent
            {...content}
            id={shown}
            key={opening}
            onCloseCancelled={cancelClose}
            opening={opening}
          />
        </QueryBoundary>
      )}
    </FormDialog>
  );
}

type ItemContentProps = Omit<InventoryItemViewProps, 'itemId' | 'onClose'> & {
  id: string;
  opening: number;
  onCloseCancelled: () => void;
};

function ItemContent({ id, opening, editing, grants, ...actions }: ItemContentProps) {
  const { data: item } = useSuspenseQuery(inventoryItemOptions(id, opening));
  const [{ data: facility }, { data: program }] = useSuspenseQueries({
    queries: [facilityOptions(item.facility.id), programLookupOptions(item.program.id)],
  });
  const canEdit = grants.some(
    (grant) => grant.facilityId === item.facility.id && grant.programId === item.program.id,
  );
  const header: ReadOnlyRow[] = [
    ['cce-inventory.details.district', facility.geographicZone.name],
    ['facility-program.facility', facility.name],
    ['facility-program.program', program.name],
    ['cce-inventory.form.equipment-type', item.catalogItem.type],
  ];
  return editing && canEdit ? (
    <EditItem {...actions} header={header} item={item} />
  ) : (
    <ItemDetails {...actions} canEdit={canEdit} header={header} item={item} />
  );
}

type ItemProps = Pick<
  ItemContentProps,
  'onEdit' | 'onDetails' | 'onStatusUpdate' | 'onCloseCancelled'
> & { item: InventoryItemRecord; header: ReadOnlyRow[] };

const optional = (label: ParseKeys, value: string | number | undefined): ReadOnlyRow[] =>
  value === undefined || value === '' ? [] : [[label, value]];

function ItemDetails({
  item,
  header,
  canEdit,
  onEdit,
  onStatusUpdate,
}: ItemProps & { canEdit: boolean }) {
  const { t, i18n } = useTranslation();
  const timeZone = useDeploymentTimeZone();
  const { labelKey, tone, icon: Icon } = EQUIPMENT_STATUS[item.functionalStatus];
  const modifier = [item.lastModifier?.firstName, item.lastModifier?.lastName]
    .filter(Boolean)
    .join(' ');
  const modified = formatTimestamp(item.modifiedDate, i18n.language, { time: true, timeZone });
  const reason = item.reasonNotWorkingOrNotInUse;
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
              <span className="text-muted-foreground">
                <bdi>{modifier}</bdi> {modified}
              </span>
            </div>
            {canEdit && onStatusUpdate && (
              <Button onClick={() => onStatusUpdate(item)} variant="outline">
                {t('cce-inventory.details.update-status')}
              </Button>
            )}
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
              ['cce-inventory.form.serial-number', item.equipmentTrackingId ?? ''],
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
              ['cce-inventory.form.voltage-stabilizer', t(POWER_KEYS[item.voltageStabilizer])],
              ['cce-inventory.form.backup-generator', t(POWER_KEYS[item.backupGenerator])],
              ['cce-inventory.form.voltage-regulator', t(POWER_KEYS[item.voltageRegulator])],
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
        {canEdit && <Button onClick={onEdit}>{t('cce-inventory.details.edit')}</Button>}
      </FormDialogFooter>
    </>
  );
}

function EditItem({ item, header, onDetails, onCloseCancelled }: ItemProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fields = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);

  const save = useSessionMutation({
    mutationKey: SAVE_KEY,
    mutationFn: async (details: ValidInventoryItemDetails) =>
      updateInventoryItem(toInventoryItemUpdate(await fetchInventoryItem(item.id), details)),
    onSuccess: (_, details) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.inventoryItems.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.home.all });
      toast.success(t('cce-inventory.details.saved-title'), {
        description: t('cce-inventory.details.saved', { name: details.referenceName.trim() }),
      });
      leaving.current = true;
      onDetails();
    },
  });

  const form = useInventoryItemForm(
    toEditValues(item),
    (values) => save.mutateAsync(inventoryItemSchema.parse(values).details).catch(() => undefined),
    () =>
      requestAnimationFrame(() =>
        fields.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      ),
  );
  const dirty = useStore(form.store, (state) => !state.isDefaultValue);
  const allowLeave = useCallback(() => leaving.current, []);
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
          <Button disabled={save.isPending} onClick={onDetails} type="button" variant="outline">
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
        <FormDialogTitle>
          <SkeletonLine width="medium" />
        </FormDialogTitle>
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
