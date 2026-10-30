import { useStore } from '@tanstack/react-form';
import { useSuspenseQueries } from '@tanstack/react-query';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import { Trash2Icon } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOfflineFailure } from '@/components/app-shell/offline-notice';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import {
  DataTableEmpty,
  type DataTableFeatures,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { CardActions, useInCards } from '@/components/display/card-actions';
import { ErrorAlert, RetryButton } from '@/components/display/dialog-parts';
import { DialogTable } from '@/components/display/dialog-table';
import { useAppForm } from '@/components/form/form';
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
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import {
  rejectionReasonCategoriesOptions,
  rejectionReasonsOptions,
} from '@/features/reference-data/api/queries';
import type { RejectionReason } from '@/features/reference-data/lib/types';
import { availableRejectReasons } from '@/features/requisitions/lib/reject-reasons';
import { useDialogCardLayout } from '@/hooks/use-card-view';

const helper = createColumnHelper<DataTableFeatures, RejectionReason>();
function RemoveReason({
  reason,
  onRemove,
}: {
  reason: RejectionReason;
  onRemove: (id: string) => void;
}) {
  const { t } = useTranslation();
  const cards = useInCards();
  const name = t('requisitions.reject.remove', { name: reason.name });
  return cards ? (
    <CardActions
      label={t('card-actions.actions-for', { name: reason.name })}
      actions={[
        {
          id: 'remove',
          icon: <Trash2Icon />,
          label: name,
          destructive: true,
          onSelect: () => onRemove(reason.id),
        },
      ]}
    />
  ) : (
    <Button
      size="icon-sm"
      variant="destructive"
      aria-label={name}
      onClick={() => onRemove(reason.id)}
    >
      <Trash2Icon />
    </Button>
  );
}
function LoadedRejectReasonsDialog({
  onConfirm,
}: {
  onConfirm: (reasons: readonly RejectionReason[]) => void;
}) {
  const { t } = useTranslation();
  const [{ data: categories }, { data: reasons }] = useSuspenseQueries({
    queries: [rejectionReasonCategoriesOptions(), rejectionReasonsOptions()],
  });
  const fields = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<RejectionReason[]>([]);

  const { measure, cards } = useDialogCardLayout('table');
  const available = availableRejectReasons(reasons, categories, selected);
  const form = useAppForm({ defaultValues: { category: '', reason: '' } });
  const category = useStore(form.store, (state) => state.values.category);
  const reasonId = useStore(form.store, (state) => state.values.reason);
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('name', {
          header: t('requisitions.reject.reason'),
          meta: { label: t('requisitions.reject.reason') },
        }),
        helper.accessor((row) => row.rejectionReasonCategory.name, {
          id: 'category',
          header: t('requisitions.reject.category'),
          meta: { label: t('requisitions.reject.category') },
        }),
        helper.display({
          id: 'actions',
          header: t('requisitions.columns.actions'),
          cell: ({ row }) => (
            <RemoveReason
              reason={row.original}
              onRemove={(id) => {
                setSelected((current) => current.filter((reason) => reason.id !== id));
                fields.current?.querySelector<HTMLElement>('[role=combobox]')?.focus();
              }}
            />
          ),
        }),
      ]),
    [t],
  );
  const table = useTable({
    features: dataTableFeatures,
    data: selected,
    manualPagination: true,
    columns,
    getRowId: (reason) => reason.id,
  });
  return (
    <FormDialogForm
      onSubmit={() => {
        if (selected.length) onConfirm(selected);
      }}
    >
      <div ref={measure} />
      <FormDialogBody layout="table">
        <div ref={fields}>
          <FieldGroup>
            <form.AppField
              name="category"
              listeners={{ onChange: () => form.setFieldValue('reason', '') }}
            >
              {(field) => (
                <field.SelectField
                  label={t('requisitions.reject.category')}
                  placeholder={t('requisitions.reject.category')}
                  items={categories
                    .filter((c) => c.active)
                    .toSorted((a, b) => a.name.localeCompare(b.name))
                    .map((c) => ({ value: c.id, label: c.name }))}
                />
              )}
            </form.AppField>
            <form.AppField name="reason">
              {(field) => (
                <field.SelectField
                  label={t('requisitions.reject.reason')}
                  placeholder={t('requisitions.reject.reason')}
                  items={available
                    .filter((reason) => reason.rejectionReasonCategory.id === category)
                    .map((reason) => ({ value: reason.id, label: reason.name }))}
                />
              )}
            </form.AppField>
          </FieldGroup>
        </div>
        <div>
          <Button
            disabled={!reasonId}
            focusableWhenDisabled
            variant="outline"
            onClick={() => {
              const reason = available.find((reason) => reason.id === reasonId);
              if (reason) setSelected((current) => [...current, reason]);
              form.setFieldValue('reason', '');
            }}
          >
            {t('requisitions.reject.add')}
          </Button>
        </div>
        <DialogTable
          cards={cards}
          table={table}
          title="name"
          empty={
            <DataTableEmpty
              title={t('requisitions.reject.empty')}
              description={t('requisitions.reject.required')}
            />
          }
        />
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('dialog.cancel')}</FormDialogCancel>
        <FormDialogSubmit disabled={!selected.length} variant="destructive">
          {t('requisitions.edit.actions.reject')}
        </FormDialogSubmit>
      </FormDialogFooter>
    </FormDialogForm>
  );
}

export function RejectReasonsDialog(props: {
  onClose: () => void;
  onConfirm: (reasons: readonly RejectionReason[]) => void;
}) {
  const { t } = useTranslation();
  return (
    <FormDialog
      open
      size="table"
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <FormDialogHeader>
        <FormDialogTitle>{t('requisitions.reject.title')}</FormDialogTitle>
        <FormDialogDescription>{t('requisitions.reject.description')}</FormDialogDescription>
      </FormDialogHeader>
      <QueryBoundary
        resetKey="reject-reasons"
        pendingFallback={
          <>
            <FormDialogBody>
              <Spinner />
            </FormDialogBody>
            <FormDialogFooter>
              <FormDialogCancel>{t('dialog.cancel')}</FormDialogCancel>
            </FormDialogFooter>
          </>
        }
        errorComponent={RejectReasonsError}
      >
        <LoadedRejectReasonsDialog onConfirm={props.onConfirm} />
      </QueryBoundary>
    </FormDialog>
  );
}

function RejectReasonsError({ error, reset }: { error: unknown; reset: () => void }) {
  const { t } = useTranslation();
  const offline = useOfflineFailure(error, reset);
  return (
    <>
      <FormDialogBody>
        <ErrorAlert
          action={<RetryButton onClick={reset} />}
          description={t(offline ? 'offline.notice-description' : 'error.check-connection')}
          title={t(
            offline ? 'offline.notice-title' : 'requisitions.requisition.section-error-title',
          )}
        />
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('dialog.cancel')}</FormDialogCancel>
      </FormDialogFooter>
    </>
  );
}
