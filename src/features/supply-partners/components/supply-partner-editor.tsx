import { revalidateLogic, useStore } from '@tanstack/react-form';
import { Loader2Icon, TruckIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { FieldSkeleton, serverMessage } from '@/components/dialog-parts';
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
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
import { SupplyPartnerConflictError, saveSupplyPartner } from '@/features/supply-partners/api/api';
import {
  AssociationsTable,
  AssociationsTableSkeleton,
} from '@/features/supply-partners/components/associations-table';
import {
  ReferenceStatus,
  usePartnerReferences,
} from '@/features/supply-partners/components/supply-partner-references';
import { ViewItemsDialog } from '@/features/supply-partners/components/view-items-dialog';
import type { SupplyPartnerEditSearch } from '@/features/supply-partners/lib/search';
import {
  canonicalSupplyPartner,
  toSupplyPartnerBody,
  toSupplyPartnerDraft,
} from '@/features/supply-partners/lib/supply-partner-form';
import type { SupplyPartner, SupplyPartnerDraft } from '@/features/supply-partners/lib/types';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import type { SearchChange } from '@/lib/table-search';

const FORM_ID = 'supply-partner-form';
const schema = z.object({
  name: z.string().trim().min(1, 'supply-partners.name-required'),
  associations: z.custom<SupplyPartnerDraft['associations']>(),
});
export function SupplyPartnerHeading({ title }: { title?: string }) {
  const { t } = useTranslation();
  return (
    <WorkspaceHeader>
      <WorkspaceHeading>
        <WorkspaceIcon>
          <TruckIcon />
        </WorkspaceIcon>
        <WorkspaceTitle>{title ?? t('supply-partners.edit')}</WorkspaceTitle>
        <WorkspaceDescription>{t('supply-partners.edit-description')}</WorkspaceDescription>
      </WorkspaceHeading>
    </WorkspaceHeader>
  );
}
export function SupplyPartnerEditor({
  saved,
  search,
  onSearchChange,
  onView,
  onCloseView,
  onCancel,
  onSaved,
  onReload,
}: {
  saved: SupplyPartner;
  search: SupplyPartnerEditSearch;
  onSearchChange: SearchChange<SupplyPartnerEditSearch>;
  onView: (kind: 'facilities' | 'products', key: string) => void;
  onCloseView: () => void;
  onCancel: () => void;
  onSaved: (saved: SupplyPartner | null) => void | Promise<void>;
  onReload: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const [initial] = useState(() => toSupplyPartnerDraft(saved));
  const [failure, setFailure] = useState<unknown>(null);
  const [alert, setAlert] = useState(false);
  const [reloading, setReloading] = useState(false);
  const leaving = useRef(false);
  const mutation = useSessionMutation({
    mutationFn: (draft: SupplyPartnerDraft) => saveSupplyPartner(saved, draft),
    onSuccess: (record) => {
      leaving.current = true;
      return onSaved(record);
    },
    onError: (error) => {
      setFailure(error);
      setAlert(true);
    },
  });
  const form = useAppForm({
    defaultValues: initial,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: schema },
    onSubmit: ({ value }) => mutation.mutateAsync(value).catch(() => undefined),
  });
  const draft = useStore(form.store, (state) => state.values);
  const dirty =
    canonicalSupplyPartner(toSupplyPartnerBody(saved, draft)) !== canonicalSupplyPartner(saved);
  const refs = usePartnerReferences(draft.associations);
  const pending = mutation.isPending || reloading;
  const guard = useDiscardGuard(dirty, { pending, allowLeave: () => leaving.current });
  return (
    <>
      <Workspace>
        <SupplyPartnerHeading />
        <WorkspaceContent>
          <form
            id={FORM_ID}
            noValidate
            inert={pending}
            onSubmit={(event) => {
              event.preventDefault();
              if (refs.complete) void form.handleSubmit();
            }}
          >
            <FieldGroup>
              <div className="grid gap-x-6 gap-y-5 @3xl/main:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="supply-partner-code">{t('supply-partners.code')}</FieldLabel>
                  <Input
                    id="supply-partner-code"
                    value={saved.code}
                    readOnly
                    aria-describedby="supply-partner-code-note"
                  />
                  <FieldDescription id="supply-partner-code-note">
                    {t('supply-partners.code-locked')}
                  </FieldDescription>
                </Field>
                <form.AppField name="name">
                  {(field) => (
                    <field.TextField
                      label={t('supply-partners.name')}
                      required
                      autoComplete="off"
                    />
                  )}
                </form.AppField>
              </div>
              <section
                className="flex flex-col gap-4"
                aria-labelledby="supply-partner-associations"
              >
                <h2 className="font-semibold text-lg" id="supply-partner-associations">
                  {t('supply-partners.associations')}
                </h2>
                {draft.associations.length > 0 && (
                  <ReferenceStatus associations={draft.associations} />
                )}
                <AssociationsTable
                  rows={draft.associations}
                  search={search}
                  onSearchChange={onSearchChange}
                  pending={pending}
                  onView={onView}
                  onChange={(rows) => form.setFieldValue('associations', rows)}
                />
              </section>
            </FieldGroup>
          </form>
          <DiscardChangesDialog
            description={t('supply-partners.discard-description')}
            {...guard.dialog}
          />
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter>
        <Button disabled={pending} size="lg" variant="outline" onClick={onCancel}>
          {t('dialog.cancel')}
        </Button>
        <Button disabled={pending || !refs.complete} form={FORM_ID} type="submit" size="lg">
          {pending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
          {t('supply-partners.update')}
        </Button>
      </WorkspaceFooter>
      <ViewItemsDialog
        search={search}
        associations={draft.associations}
        onClose={onCloseView}
        pending={pending}
      />
      <AlertDialog
        open={alert}
        onOpenChange={(open) => {
          if (!reloading) setAlert(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(
                failure instanceof SupplyPartnerConflictError
                  ? 'supply-partners.conflict-title'
                  : 'supply-partners.save-error-title',
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {failure instanceof SupplyPartnerConflictError
                ? t('supply-partners.conflict-description')
                : (serverMessage(failure) ?? t('supply-partners.save-error'))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reloading}>{t('dialog.close')}</AlertDialogCancel>
            {failure instanceof SupplyPartnerConflictError && (
              <Button
                disabled={reloading}
                onClick={async () => {
                  setReloading(true);
                  try {
                    await onReload();
                    if (!mutation.isCurrent()) return;
                    setAlert(false);
                  } catch (error) {
                    if (!mutation.isCurrent()) return;
                    setFailure(error);
                  } finally {
                    if (mutation.isCurrent()) setReloading(false);
                  }
                }}
              >
                {t('supply-partners.reload')}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
export function SupplyPartnerEditorSkeleton({
  search,
  title,
  onBack,
}: {
  search: SupplyPartnerEditSearch;
  title?: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Workspace>
        <SupplyPartnerHeading title={title} />
        <WorkspaceContent>
          <FieldGroup>
            <div className="grid gap-x-6 gap-y-5 @3xl/main:grid-cols-2">
              <FieldSkeleton label={t('supply-partners.code')} />
              <FieldSkeleton label={t('supply-partners.name')} required />
            </div>
            <h2 className="font-semibold text-lg">{t('supply-partners.associations')}</h2>
            <AssociationsTableSkeleton search={search} />
          </FieldGroup>
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter>
        <Button onClick={onBack} size="lg" variant="outline">
          {t('supply-partners.back')}
        </Button>
        <Button disabled size="lg">
          {t('supply-partners.update')}
        </Button>
      </WorkspaceFooter>
    </>
  );
}
