import { useStore } from '@tanstack/react-form';
import { useSuspenseQueries } from '@tanstack/react-query';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import { Trash2Icon } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import {
  DataTableEmpty,
  type DataTableFeatures,
  dataTableFeatures,
} from '@/components/data-table/data-table';
import { CardActions, useInCards } from '@/components/display/card-actions';
import { DialogLoadError } from '@/components/display/dialog-parts';
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
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (reasons: readonly RejectionReason[]) => void;
}) {
  const { t } = useTranslation();
  const [{ data: categories }, { data: reasons }] = useSuspenseQueries({
    queries: [rejectionReasonCategoriesOptions(), rejectionReasonsOptions()],
  });
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
              onRemove={(id) =>
                setSelected((current) => current.filter((reason) => reason.id !== id))
              }
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
    <FormDialog
      open
      size="table"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <FormDialogForm
        onSubmit={() => {
          if (selected.length) onConfirm(selected);
        }}
      >
        <FormDialogHeader>
          <FormDialogTitle>{t('requisitions.reject.title')}</FormDialogTitle>
          <FormDialogDescription>{t('requisitions.reject.description')}</FormDialogDescription>
        </FormDialogHeader>
        <div ref={measure} />
        <FormDialogBody layout="table">
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
          <div>
            <Button
              disabled={!reasonId}
              variant="outline"
              onClick={() => {
                const reason = available.find(
                  (reason) =>
                    reason.id === reasonId && reason.rejectionReasonCategory.id === category,
                );
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
          <FormDialogSubmit disabled={!selected.length}>
            {t('requisitions.edit.actions.reject')}
          </FormDialogSubmit>
        </FormDialogFooter>
      </FormDialogForm>
    </FormDialog>
  );
}

export function RejectReasonsDialog(props: {
  onClose: () => void;
  onConfirm: (reasons: readonly RejectionReason[]) => void;
}) {
  const { t } = useTranslation();
  const frame = (children: ReactNode) => (
    <FormDialog
      open
      size="table"
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      {children}
    </FormDialog>
  );
  return (
    <QueryBoundary
      resetKey="reject-reasons"
      pendingFallback={frame(
        <>
          <FormDialogHeader>
            <FormDialogTitle>{t('requisitions.reject.title')}</FormDialogTitle>
            <FormDialogDescription>{t('requisitions.reject.description')}</FormDialogDescription>
          </FormDialogHeader>
          <FormDialogBody>
            <Spinner />
          </FormDialogBody>
          <FormDialogFooter>
            <FormDialogCancel>{t('dialog.cancel')}</FormDialogCancel>
          </FormDialogFooter>
        </>,
      )}
      errorComponent={({ error, reset }) =>
        frame(
          <DialogLoadError
            title={t('requisitions.reject.title')}
            errorTitle={t('requisitions.requisition.section-error-title')}
            error={error}
            onRetry={reset}
          />,
        )
      }
    >
      <LoadedRejectReasonsDialog {...props} />
    </QueryBoundary>
  );
}
