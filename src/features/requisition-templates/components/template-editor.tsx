import { revalidateLogic, useStore } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { FileSlidersIcon, Loader2Icon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { ErrorAlert } from '@/components/display/dialog-parts';
import { DiscardChangesDialog } from '@/components/display/discard-changes-dialog';
import { useAppForm } from '@/components/form/form';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Workspace,
  WorkspaceContent,
  WorkspaceDescription,
  WorkspaceFooter,
  WorkspaceHeader,
  WorkspaceHeading,
  WorkspaceIcon,
  WorkspaceTitle,
} from '@/components/workspace/workspace';
import {
  ReplacedTemplateError,
  saveRequisitionTemplate,
} from '@/features/requisition-templates/api/api';
import { ColumnsTab } from '@/features/requisition-templates/components/columns-tab';
import { SettingsTab } from '@/features/requisition-templates/components/settings-tab';
import { TEMPLATE_FIELD_ERRORS } from '@/features/requisition-templates/lib/add-template-form';
import { templateFieldErrors } from '@/features/requisition-templates/lib/server-errors';
import {
  draftFromTemplate,
  type TemplateDraft,
} from '@/features/requisition-templates/lib/template-draft';
import {
  getNameError,
  getRowErrors,
} from '@/features/requisition-templates/lib/template-validation';
import type { RequisitionTemplate } from '@/features/requisition-templates/lib/types';
import { useCardLayout } from '@/hooks/use-card-view';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { apiErrorText, fieldErrorFor } from '@/lib/api-error';
import { queryKeys } from '@/lib/key-factory';
import { reportApiError } from '@/lib/report-error';
import { revealField } from '@/lib/reveal-field';

export type TemplateTab = 'columns' | 'settings';
const schema = z.custom<TemplateDraft>().superRefine((draft, context) => {
  for (const [key, error] of Object.entries(getRowErrors(draft))) {
    context.addIssue({
      code: 'custom',
      message: error.key,
      path:
        error.field === 'numberOfPeriodsToAverage'
          ? ['numberOfPeriodsToAverage']
          : ['columns', key, error.field],
    });
  }
  const error = getNameError(draft);
  if (error) context.addIssue({ code: 'custom', message: error.key, path: ['name'] });
});

function useTemplateEditorForm(
  initialValues: TemplateDraft,
  onValid: (draft: TemplateDraft) => void,
  onInvalid: () => void,
) {
  return useAppForm({
    defaultValues: initialValues,
    validationLogic: revalidateLogic({ mode: 'change' }),
    validators: { onDynamic: schema },
    onSubmit: ({ value }) => onValid(value),
    onSubmitInvalid: onInvalid,
  });
}
export type TemplateEditorForm = ReturnType<typeof useTemplateEditorForm>;

type TemplateEditorProps = {
  saved: RequisitionTemplate;
  programName: string;
  tab: TemplateTab;
  onTabChange: (tab: TemplateTab) => void;
  onCancel: () => void;
  onSaved: () => void;
};

export function TemplateEditor({
  saved,
  programName,
  tab,
  onTabChange,
  onCancel,
  onSaved,
}: TemplateEditorProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [initialValues] = useState(() => draftFromTemplate(saved));
  const [fieldErrors, setFieldErrors] = useState<ReturnType<typeof templateFieldErrors>>();
  const [confirmation, setConfirmation] = useState<TemplateDraft | null>(null);
  const leaving = useRef(false);
  const editorRef = useRef<HTMLFormElement>(null);
  const [invalidTab, setInvalidTab] = useState<TemplateTab | null>(null);
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  const save = useSessionMutation({
    onMutate: () => setFieldErrors(undefined),
    mutationFn: (draft: TemplateDraft): Promise<RequisitionTemplate> =>
      saveRequisitionTemplate(saved.id, draft),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.requisitionTemplates.all });
      if (!save.isCurrent()) return;
      leaving.current = true;
      toast.success(t('requisition-templates.configure.saved-title'), {
        description: t('requisition-templates.configure.saved'),
      });
      setConfirmation(null);
      onSaved();
    },
    onError: (error) => {
      const replaced = error instanceof ReplacedTemplateError;
      if (!replaced) reportApiError(error);
      const nameError = fieldErrorFor(error, TEMPLATE_FIELD_ERRORS);
      const fields = templateFieldErrors(error, t);
      const description = replaced
        ? t('requisition-templates.configure.replaced')
        : nameError
          ? null
          : fields
            ? fields.general
            : apiErrorText(error, 'error.description', t);
      if (description)
        toast.error(t('requisition-templates.configure.save-error-title'), { description });
      if (nameError) {
        form.setFieldMeta(nameError.field, (meta) => ({
          ...meta,
          isTouched: true,
          errorMap: { ...meta.errorMap, onServer: nameError.key },
        }));
        setInvalidTab('settings');
        onTabChange('settings');
      }
      if (fields) {
        setFieldErrors(fields);
        if (fields.periods && hasPeriodInput) {
          form.setFieldMeta('numberOfPeriodsToAverage', (meta) => ({
            ...meta,
            isTouched: true,
            errorMap: { ...meta.errorMap, onServer: fields.periods },
          }));
        }
        const nextTab = fields.columns || fields.periods ? 'columns' : 'settings';
        setInvalidTab(nextTab);
        onTabChange(nextTab);
      }
      setConfirmation(null);
    },
  });
  const form = useTemplateEditorForm(
    initialValues,
    (draft) => setConfirmation(structuredClone(draft)),
    () => {
      const nextTab = Object.keys(getRowErrors(form.state.values)).length ? 'columns' : 'settings';
      setInvalidTab(nextTab);
      onTabChange(nextTab);
      toast.error(t('requisition-templates.configure.invalid-title'), {
        description: t('requisition-templates.configure.invalid'),
      });
    },
  );
  useEffect(() => {
    void form.validate('change');
  }, [form]);
  useEffect(() => {
    if (invalidTab !== tab) return;
    const frame = requestAnimationFrame(() => {
      const target = editorRef.current?.querySelector<HTMLElement>(
        `[data-template-tab="${tab}"]:not([hidden]) [aria-invalid="true"]`,
      );
      if (target) revealField(target, cards);
      setInvalidTab(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [invalidTab, tab, cards]);
  const changed = useStore(form.store, (state) => !state.isDefaultValue);
  const hasPeriodInput = Object.values(saved.columnsMap).some(
    (column) => column.columnDefinition.name === 'averageConsumption',
  );
  const columnErrors = [fieldErrors?.columns, !hasPeriodInput && fieldErrors?.periods]
    .filter(Boolean)
    .join(' ');
  const guard = useDiscardGuard(changed, {
    pending: save.isPending,
    allowLeave: () => leaving.current,
  });
  return (
    <>
      <Workspace width="large">
        <WorkspaceHeader>
          <WorkspaceHeading>
            <WorkspaceIcon>
              <FileSlidersIcon />
            </WorkspaceIcon>
            <WorkspaceTitle>
              {t('requisition-templates.configure.title', {
                template: saved.name,
                program: programName,
              })}
            </WorkspaceTitle>
            <WorkspaceDescription>
              {t('requisition-templates.configure.description')}
            </WorkspaceDescription>
          </WorkspaceHeading>
        </WorkspaceHeader>
        <WorkspaceContent>
          <form
            ref={editorRef}
            id="template-editor"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
          >
            <div inert={save.isPending || confirmation !== null} ref={measure}>
              <Tabs
                value={tab}
                onValueChange={(value: TemplateTab) => onTabChange(value)}
                spacing="page"
              >
                <TabsList aria-label={t('requisition-templates.configure.tabs-label')} size="lg">
                  <TabsTrigger value="columns">
                    {t('requisition-templates.configure.columns')}
                  </TabsTrigger>
                  <TabsTrigger value="settings">
                    {t('requisition-templates.configure.settings')}
                  </TabsTrigger>
                </TabsList>
                <TabsContent data-template-tab="columns" keepMounted value="columns">
                  {columnErrors && (
                    <ErrorAlert
                      title={t('requisition-templates.configure.save-error-title')}
                      description={columnErrors}
                    />
                  )}
                  <ColumnsTab cards={cards} form={form} saved={saved} />
                </TabsContent>
                <TabsContent data-template-tab="settings" keepMounted value="settings">
                  <SettingsTab
                    form={form}
                    saved={saved}
                    programError={fieldErrors?.program}
                    programName={programName}
                    facilityTypesError={fieldErrors?.facilityTypes}
                    clearFacilityTypesError={() =>
                      setFieldErrors((errors) =>
                        errors?.facilityTypes ? { ...errors, facilityTypes: undefined } : errors,
                      )
                    }
                  />
                </TabsContent>
              </Tabs>
            </div>
          </form>
          <DiscardChangesDialog
            description={t('requisition-templates.configure.discard', { template: saved.name })}
            {...guard.dialog}
          />
        </WorkspaceContent>
      </Workspace>
      <WorkspaceFooter width="large">
        <Button disabled={save.isPending} onClick={onCancel} size="lg" variant="outline">
          {t('requisition-templates.configure.cancel')}
        </Button>
        <Button
          disabled={save.isPending || confirmation !== null}
          form="template-editor"
          size="lg"
          type="submit"
        >
          {save.isPending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
          {t('requisition-templates.configure.save')}
        </Button>
      </WorkspaceFooter>
      <AlertDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open && !save.isPending) setConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('requisition-templates.configure.confirm-title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('requisition-templates.configure.confirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={save.isPending}>
              {t('requisition-templates.configure.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={save.isPending}
              onClick={() => {
                if (confirmation && !save.isPending)
                  void save.mutateAsync(confirmation).catch(() => undefined);
              }}
            >
              {t('requisition-templates.configure.save')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
