import { useStore } from '@tanstack/react-form';
import { Loader2Icon, MessageSquareXIcon } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ErrorAlert,
  FieldSkeleton,
  SwitchRowSkeleton,
  serverMessage,
} from '@/components/dialog-parts';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
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
import type { RejectionReason } from '@/features/reference-data/lib/types';
import { RejectionReasonFields } from '@/features/rejection-reasons/components/rejection-reason-fields';
import { useRejectionReasonForm } from '@/features/rejection-reasons/components/use-rejection-reason-form';
import { useDiscardGuard } from '@/hooks/use-discard-guard';

const FORM_ID = 'rejection-reason-form';

type RejectionReasonEditorProps = {
  saved: RejectionReason;
  onSaved: (reason: RejectionReason) => void;
  onCancel: () => void;
};

export function RejectionReasonEditor({ saved, onSaved, onCancel }: RejectionReasonEditorProps) {
  const { t } = useTranslation();
  const page = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);
  const { form, save, categoryReady } = useRejectionReasonForm({
    saved,
    onSaved: (reason) => {
      leaving.current = true;
      onSaved(reason);
    },
    onInvalid: () =>
      requestAnimationFrame(() =>
        page.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      ),
  });
  const dirty = useStore(form.store, (state) => !state.isDefaultValue);
  const guard = useDiscardGuard(dirty, {
    allowLeave: () => leaving.current,
    pending: save.isPending,
  });
  const disabled = save.isPending || save.isSuccess;

  return (
    <>
      <Workspace width="narrow">
        <RejectionReasonEditorHeader
          title={t('rejection-reasons.form.edit-heading', { name: saved.name })}
        />
        <WorkspaceContent>
          <div className="flex flex-col gap-6" ref={page}>
            {save.isError && (
              <ErrorAlert
                title={t('rejection-reasons.form.save-error-title')}
                description={serverMessage(save.error) ?? t('rejection-reasons.form.save-error')}
              />
            )}
            <form
              id={FORM_ID}
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void form.handleSubmit();
              }}
            >
              <FieldGroup>
                <div className="grid grid-cols-1 gap-x-6 gap-y-5 @3xl/main:grid-cols-2">
                  <RejectionReasonFields form={form} disabled={disabled} saved={saved} />
                </div>
              </FieldGroup>
            </form>
          </div>
          <DiscardChangesDialog
            description={t('rejection-reasons.form.discard-description', {
              name: saved.name,
            })}
            {...guard.dialog}
          />
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter width="narrow">
        <Button disabled={save.isPending} onClick={onCancel} size="lg" variant="outline">
          {t('rejection-reasons.form.cancel')}
        </Button>
        <Button
          disabled={disabled || !categoryReady}
          focusableWhenDisabled
          form={FORM_ID}
          size="lg"
          type="submit"
        >
          {save.isPending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
          {t('rejection-reasons.form.save')}
        </Button>
      </WorkspaceFooter>
    </>
  );
}

function RejectionReasonEditorHeader({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <MessageSquareXIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{title}</WorkspaceTitle>
        <WorkspaceDescription>{t('rejection-reasons.form.description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

export function RejectionReasonEditorSkeleton() {
  const { t } = useTranslation();
  return (
    <>
      <Workspace width="narrow">
        <RejectionReasonEditorHeader title={t('rejection-reasons.form.edit-title')} />
        <WorkspaceContent>
          <FieldGroup>
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 @3xl/main:grid-cols-2">
              <FieldSkeleton label={t('rejection-reasons.name')} required />
              <FieldSkeleton label={t('rejection-reasons.code')} required />
              <FieldSkeleton label={t('rejection-reasons.category')} required />
              <SwitchRowSkeleton label={t('rejection-reasons.active')} />
            </div>
          </FieldGroup>
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter width="narrow">
        <Button disabled size="lg" variant="outline">
          {t('rejection-reasons.form.cancel')}
        </Button>
        <Button disabled size="lg">
          {t('rejection-reasons.form.save')}
        </Button>
      </WorkspaceFooter>
    </>
  );
}
