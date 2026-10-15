import { revalidateLogic, useStore } from '@tanstack/react-form';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Loader2Icon, NetworkIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FieldSkeleton, LookupBoundary, serverMessage } from '@/components/dialog-parts';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { useAppForm } from '@/components/form/form';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { toFacilityOption } from '@/components/valid-assignments/options';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceFooter,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace';
import {
  minimalFacilitiesOptions,
  supervisoryNodesOptions,
} from '@/features/reference-data/api/queries';
import {
  SupervisoryNodeConflictError,
  saveSupervisoryNodeChange,
} from '@/features/supervisory-nodes/api/api';
import {
  NodeLinksSectionSkeleton,
  NodeLinksTable,
} from '@/features/supervisory-nodes/components/node-links-table';
import type { NodeLinkKind } from '@/features/supervisory-nodes/lib/edit-search';
import { facilityNames } from '@/features/supervisory-nodes/lib/facility-names';
import {
  type NodeDraft,
  nodeFormSchema,
  parentOptions,
  toDraft,
  toNodeBody,
} from '@/features/supervisory-nodes/lib/node-form';
import type { SupervisoryNode } from '@/features/supervisory-nodes/lib/types';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { useSessionMutation } from '@/hooks/use-session-mutation';

const FORM_ID = 'supervisory-node-form';

function useNodeForm(
  initial: NodeDraft,
  submit: (value: NodeDraft) => Promise<unknown>,
  invalid: () => void,
) {
  return useAppForm({
    defaultValues: initial,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: nodeFormSchema },
    onSubmit: ({ value }) => submit(value),
    onSubmitInvalid: invalid,
  });
}
type NodeForm = ReturnType<typeof useNodeForm>;

export function NodeEditor({
  saved: loaded,
  onSaved,
  onCancel,
  onReload,
}: {
  saved: SupervisoryNode;
  onSaved: (saved: SupervisoryNode) => void | Promise<void>;
  onCancel: () => void;
  onReload: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const [saved] = useState(loaded);
  const [initial] = useState(() => toDraft(saved));
  const [alert, setAlert] = useState<'invalid' | 'failure' | 'conflict' | null>(null);
  const [reloading, setReloading] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const container = useRef<HTMLFormElement>(null);
  const focusInvalid = useRef(false);
  const leaving = useRef(false);
  const mutation = useSessionMutation({
    mutationFn: (draft: NodeDraft) =>
      saveSupervisoryNodeChange(saved.id, (latest) => toNodeBody(latest, saved, draft)),
    onSuccess: (node) => {
      leaving.current = true;
      return onSaved(node);
    },
    onError: (error) => {
      setFailure(error);
      setAlert(error instanceof SupervisoryNodeConflictError ? 'conflict' : 'failure');
    },
  });
  const form = useNodeForm(
    initial,
    (values) => mutation.mutateAsync(values).catch(() => undefined),
    () => {
      focusInvalid.current = true;
      setAlert('invalid');
    },
  );
  const changed = useStore(form.store, (state) => !state.isDefaultValue);
  const pending = mutation.isPending || reloading;
  const guard = useDiscardGuard(changed, { allowLeave: () => leaving.current, pending });
  return (
    <>
      <Workspace width="narrow">
        <NodeHeading />
        <WorkspaceContent>
          <form
            id={FORM_ID}
            ref={container}
            inert={pending}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
          >
            <FieldGroup>
              <div className="flex flex-col gap-10">
                <div className="grid gap-x-6 gap-y-5 @3xl/main:grid-cols-2">
                  <form.AppField name="code">
                    {(field) => (
                      <field.TextField
                        label={t('supervisory-nodes.form.code')}
                        required
                        autoComplete="off"
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="name">
                    {(field) => (
                      <field.TextField
                        label={t('supervisory-nodes.form.name')}
                        required
                        autoComplete="off"
                      />
                    )}
                  </form.AppField>
                  <LookupBoundary
                    label={t('supervisory-nodes.form.facility')}
                    errorTitle={t('supervisory-nodes.form.lookup-error')}
                    errorDescription={t('error.check-connection')}
                  >
                    <FacilityField form={form} />
                  </LookupBoundary>
                  <LookupBoundary
                    label={t('supervisory-nodes.form.parent')}
                    errorTitle={t('supervisory-nodes.form.lookup-error')}
                    errorDescription={t('error.check-connection')}
                  >
                    <ParentField form={form} selfId={saved.id} />
                  </LookupBoundary>
                  <form.AppField name="description">
                    {(field) => (
                      <field.TextareaField label={t('supervisory-nodes.form.description')} />
                    )}
                  </form.AppField>
                </div>
                <NodeLinkField
                  kind="child"
                  selfId={saved.id}
                  form={form}
                  initial={initial}
                  disabled={pending}
                />
                <NodeLinkField
                  kind="partner"
                  selfId={saved.id}
                  form={form}
                  initial={initial}
                  disabled={pending}
                />
              </div>
            </FieldGroup>
          </form>
          <DiscardChangesDialog
            description={t('supervisory-nodes.form.discard-description')}
            {...guard.dialog}
          />
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter width="narrow">
        <Button disabled={pending} onClick={onCancel} size="lg" variant="outline">
          {t('supervisory-nodes.form.cancel')}
        </Button>
        <Button disabled={pending} form={FORM_ID} size="lg" type="submit">
          {pending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
          {t('supervisory-nodes.form.update')}
        </Button>
      </WorkspaceFooter>
      <AlertDialog
        open={alert !== null}
        onOpenChange={(open) => {
          if (!open) setAlert(null);
        }}
        onOpenChangeComplete={(open) => {
          if (open || !focusInvalid.current) return;
          focusInvalid.current = false;
          container.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
        }}
      >
        <AlertDialogContent finalFocus={focusInvalid.current ? false : undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(
                alert === 'invalid'
                  ? 'supervisory-nodes.form.invalid-title'
                  : alert === 'conflict'
                    ? 'supervisory-nodes.form.conflict-title'
                    : 'supervisory-nodes.form.save-error-title',
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {alert === 'invalid'
                ? t('supervisory-nodes.form.invalid-description')
                : alert === 'conflict'
                  ? t('supervisory-nodes.form.conflict-description')
                  : (serverMessage(failure) ?? t('supervisory-nodes.form.save-error'))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reloading}>{t('dialog.close')}</AlertDialogCancel>
            {alert === 'conflict' && (
              <Button
                disabled={reloading}
                onClick={async () => {
                  setReloading(true);
                  try {
                    await onReload();
                    if (!mutation.isCurrent()) return;
                    setAlert(null);
                  } catch (error) {
                    if (!mutation.isCurrent()) return;
                    setFailure(error);
                    setAlert('failure');
                  } finally {
                    if (mutation.isCurrent()) setReloading(false);
                  }
                }}
              >
                {t('supervisory-nodes.form.reload')}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function FacilityField({ form }: { form: NodeForm }) {
  const { t } = useTranslation();
  const { data } = useSuspenseQuery(minimalFacilitiesOptions());
  return (
    <form.AppField name="facilityId">
      {(field) => (
        <field.ComboboxField
          label={t('supervisory-nodes.form.facility')}
          items={data.map(toFacilityOption)}
          clearLabel={t('supervisory-nodes.form.clear')}
          emptyMessage={t('supervisory-nodes.form.no-options')}
        />
      )}
    </form.AppField>
  );
}
function ParentField({ form, selfId }: { form: NodeForm; selfId: string }) {
  const { t } = useTranslation();
  const { data: nodes } = useSuspenseQuery(supervisoryNodesOptions());
  const { data: facilities } = useSuspenseQuery(minimalFacilitiesOptions());
  const children = useStore(form.store, (state) => state.values.children);
  const names = facilityNames(facilities);
  return (
    <form.AppField name="parentId">
      {(field) => (
        <field.ComboboxField
          label={t('supervisory-nodes.form.parent')}
          items={parentOptions(nodes, selfId, children, names)}
          clearLabel={t('supervisory-nodes.form.clear')}
          emptyMessage={t('supervisory-nodes.form.no-options')}
        />
      )}
    </form.AppField>
  );
}
function NodeHeading() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <NetworkIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{t('supervisory-nodes.edit-title')}</WorkspaceTitle>
        <WorkspaceDescription>{t('supervisory-nodes.edit-description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}
export function NodeEditorSkeleton() {
  const { t } = useTranslation();
  return (
    <>
      <Workspace width="narrow">
        <NodeHeading />
        <WorkspaceContent>
          <FieldGroup>
            <div className="flex flex-col gap-10">
              <div className="grid gap-x-6 gap-y-5 @3xl/main:grid-cols-2">
                <FieldSkeleton label={t('supervisory-nodes.form.code')} required />
                <FieldSkeleton label={t('supervisory-nodes.form.name')} required />
                <FieldSkeleton label={t('supervisory-nodes.form.facility')} />
                <FieldSkeleton label={t('supervisory-nodes.form.parent')} />
                <FieldSkeleton label={t('supervisory-nodes.form.description')} control="textarea" />
              </div>
              <NodeLinksSectionSkeleton kind="child" />
              <NodeLinksSectionSkeleton kind="partner" />
            </div>
          </FieldGroup>
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter width="narrow">
        <Button disabled size="lg" variant="outline">
          {t('supervisory-nodes.form.cancel')}
        </Button>
        <Button disabled size="lg">
          {t('supervisory-nodes.form.update')}
        </Button>
      </WorkspaceFooter>
    </>
  );
}

function NodeLinkField({
  form,
  kind,
  initial,
  selfId,
  disabled,
}: {
  form: NodeForm;
  kind: NodeLinkKind;
  initial: NodeDraft;
  selfId: string;
  disabled: boolean;
}) {
  const field = kind === 'child' ? 'children' : 'partners';
  const rows = useStore(form.store, (state) => state.values[field]);
  const parentId = useStore(form.store, (state) =>
    kind === 'child' ? state.values.parentId : null,
  );
  const [savedIds] = useState(() => new Set(initial[field].map(({ id }) => id)));
  return (
    <NodeLinksTable
      kind={kind}
      selfId={selfId}
      savedIds={savedIds}
      rows={rows}
      parentId={parentId}
      disabled={disabled}
      onAdd={(node) => form.pushFieldValue(field, node)}
      onRemove={(index) => form.removeFieldValue(field, index)}
    />
  );
}
