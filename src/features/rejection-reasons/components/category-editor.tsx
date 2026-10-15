import { useStore } from '@tanstack/react-form';
import { FolderXIcon, Loader2Icon } from 'lucide-react';
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
import type { RejectionReasonCategory } from '@/features/reference-data/lib/types';
import { CategoryFields } from '@/features/rejection-reasons/components/category-fields';
import { useCategoryForm } from '@/features/rejection-reasons/components/use-category-form';
import { useDiscardGuard } from '@/hooks/use-discard-guard';

const FORM_ID = 'rejection-reason-category-form';

type CategoryEditorProps = {
  saved: RejectionReasonCategory;
  onSaved: (category: RejectionReasonCategory) => void;
  onCancel: () => void;
};

export function CategoryEditor({ saved, onSaved, onCancel }: CategoryEditorProps) {
  const { t } = useTranslation();
  const page = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);
  const { form, save } = useCategoryForm({
    saved,
    onSaved: (category) => {
      leaving.current = true;
      onSaved(category);
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
        <CategoryEditorHeader
          title={t('rejection-reason-categories.form.edit-heading', { name: saved.name })}
        />
        <WorkspaceContent>
          <div className="flex flex-col gap-6" ref={page}>
            {save.isError && (
              <ErrorAlert
                title={t('rejection-reason-categories.form.save-error-title')}
                description={
                  serverMessage(save.error) ?? t('rejection-reason-categories.form.save-error')
                }
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
                  <CategoryFields form={form} disabled={disabled} />
                </div>
              </FieldGroup>
            </form>
          </div>
          <DiscardChangesDialog
            description={t('rejection-reason-categories.form.discard-description', {
              name: saved.name,
            })}
            {...guard.dialog}
          />
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter width="narrow">
        <Button disabled={save.isPending} onClick={onCancel} size="lg" variant="outline">
          {t('rejection-reason-categories.form.cancel')}
        </Button>
        <Button disabled={disabled} focusableWhenDisabled form={FORM_ID} size="lg" type="submit">
          {save.isPending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
          {t('rejection-reason-categories.form.save')}
        </Button>
      </WorkspaceFooter>
    </>
  );
}

function CategoryEditorHeader({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <FolderXIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{title}</WorkspaceTitle>
        <WorkspaceDescription>
          {t('rejection-reason-categories.form.description')}
        </WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}

export function CategoryEditorSkeleton() {
  const { t } = useTranslation();
  return (
    <>
      <Workspace width="narrow">
        <CategoryEditorHeader title={t('rejection-reason-categories.form.edit-title')} />
        <WorkspaceContent>
          <FieldGroup>
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 @3xl/main:grid-cols-2">
              <FieldSkeleton label={t('rejection-reason-categories.name')} required />
              <FieldSkeleton label={t('rejection-reason-categories.code')} required />
              <SwitchRowSkeleton label={t('rejection-reason-categories.active')} />
            </div>
          </FieldGroup>
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter width="narrow">
        <Button disabled size="lg" variant="outline">
          {t('rejection-reason-categories.form.cancel')}
        </Button>
        <Button disabled size="lg">
          {t('rejection-reason-categories.form.save')}
        </Button>
      </WorkspaceFooter>
    </>
  );
}
