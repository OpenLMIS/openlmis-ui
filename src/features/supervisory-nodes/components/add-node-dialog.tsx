import { revalidateLogic } from '@tanstack/react-form';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { DialogLoadError, FieldSkeleton } from '@/components/dialog-parts';
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
import { useDialogTarget } from '@/components/form-dialog/use-dialog-target';
import { QueryBoundary } from '@/components/query-boundary';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FieldGroup } from '@/components/ui/field';
import {
  minimalFacilitiesOptions,
  supervisoryNodesOptions,
} from '@/features/reference-data/api/queries';
import type { NodeLinkKind } from '@/features/supervisory-nodes/lib/edit-search';
import { facilityNames } from '@/features/supervisory-nodes/lib/facility-names';
import {
  childOptions,
  type DraftNode,
  partnerOptions,
} from '@/features/supervisory-nodes/lib/node-form';

type AddNodeDialogProps = {
  kind: NodeLinkKind;
  open: boolean;
  selfId: string;
  rows: DraftNode[];
  parentId: string | null;
  disabled: boolean;
  onAdd: (node: DraftNode) => void;
  onClose: () => void;
  onClosed: () => void;
};

export function AddNodeDialog({ open, onClose, onClosed, ...props }: AddNodeDialogProps) {
  const { t } = useTranslation();
  const { shown, close, dialogProps } = useDialogTarget(open ? props.kind : undefined, onClose);
  const dialog = dialogProps(props.disabled);
  return (
    <FormDialog
      {...dialog}
      onOpenChangeComplete={(next) => {
        dialog.onOpenChangeComplete(next);
        if (!next) onClosed();
      }}
    >
      {shown && (
        <QueryBoundary
          errorComponent={({ error, reset }) => (
            <DialogLoadError
              error={error}
              errorTitle={t('supervisory-nodes.form.lookup-error')}
              onRetry={reset}
              title={t(`supervisory-nodes.form.add-${props.kind}`)}
            />
          )}
          pendingFallback={
            <>
              <AddNodeHeader kind={props.kind} />
              <FormDialogBody>
                <FieldSkeleton label={t('supervisory-nodes.form.node')} required />
              </FormDialogBody>
            </>
          }
          resetKey={props.kind}
        >
          <AddNodeForm
            {...props}
            onAdd={(node) => {
              if (!props.disabled && close()) props.onAdd(node);
            }}
          />
        </QueryBoundary>
      )}
    </FormDialog>
  );
}

function AddNodeHeader({ kind }: { kind: NodeLinkKind }) {
  const { t } = useTranslation();
  return (
    <FormDialogHeader>
      <FormDialogTitle>{t(`supervisory-nodes.form.add-${kind}`)}</FormDialogTitle>
      <FormDialogDescription>{t(`supervisory-nodes.form.moves-${kind}`)}</FormDialogDescription>
    </FormDialogHeader>
  );
}

const addNodeSchema = z.object({
  nodeId: z
    .string()
    .nullable()
    .refine((value) => !!value, 'supervisory-nodes.form.required'),
});

function AddNodeForm({
  kind,
  selfId,
  rows,
  parentId,
  disabled,
  onAdd,
}: Omit<AddNodeDialogProps, 'open' | 'onClose' | 'onClosed'>) {
  const { t } = useTranslation();
  const { data: nodes } = useSuspenseQuery(supervisoryNodesOptions());
  const { data: facilities } = useSuspenseQuery(minimalFacilitiesOptions());
  const names = facilityNames(facilities);
  const items =
    kind === 'child'
      ? childOptions(nodes, selfId, rows, parentId, names)
      : partnerOptions(nodes, selfId, rows, names);
  const [invalid, setInvalid] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const form = useAppForm({
    defaultValues: { nodeId: null as string | null },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: addNodeSchema },
    onSubmitInvalid: () => setInvalid(true),
    onSubmit: ({ value }) => {
      if (disabled || !items.some(({ value: id }) => id === value.nodeId)) return;
      const node = nodes.find(({ id }) => id === value.nodeId);
      if (node) {
        onAdd({ id: node.id, name: node.name, code: node.code, facilityId: node.facility?.id });
      }
    },
  });
  return (
    <>
      <FormDialogForm onSubmit={form.handleSubmit}>
        <AddNodeHeader kind={kind} />
        <FormDialogBody>
          <div ref={container} inert={disabled}>
            <FieldGroup>
              <form.AppField name="nodeId">
                {(field) => (
                  <field.ComboboxField
                    label={t('supervisory-nodes.form.node')}
                    clearLabel={t('supervisory-nodes.form.clear')}
                    items={items}
                    emptyMessage={t('supervisory-nodes.form.no-options')}
                    required
                  />
                )}
              </form.AppField>
            </FieldGroup>
          </div>
        </FormDialogBody>
        <FormDialogFooter>
          <FormDialogCancel disabled={disabled}>{t('dialog.cancel')}</FormDialogCancel>
          <FormDialogSubmit disabled={disabled}>
            {t(`supervisory-nodes.form.add-${kind}`)}
          </FormDialogSubmit>
        </FormDialogFooter>
      </FormDialogForm>
      <AlertDialog
        open={invalid}
        onOpenChange={setInvalid}
        onOpenChangeComplete={(next) => {
          if (!next)
            container.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
        }}
      >
        <AlertDialogContent finalFocus={false}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('supervisory-nodes.form.invalid-title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('supervisory-nodes.form.invalid-add-description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('dialog.close')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
