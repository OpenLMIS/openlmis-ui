import { revalidateLogic } from '@tanstack/react-form';
import { useMutationState, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { type RefObject, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import {
  DialogLoadError,
  DialogNotFound,
  ErrorAlert,
  FieldSkeleton,
  LookupBoundary,
  SwitchSkeleton,
} from '@/components/display/dialog-parts';
import { useAppForm } from '@/components/form/form';
import { ComboboxField } from '@/components/form/form-fields';
import {
  FormDialog,
  FormDialogBody,
  FormDialogCancel,
  FormDialogFooter,
  FormDialogForm,
  FormDialogHeader,
  FormDialogSubmit,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import { useDialogTarget } from '@/components/form-dialog/use-dialog-target';
import { FieldGroup } from '@/components/ui/field';
import { createDashboardReport, updateDashboardReport } from '@/features/dashboard-reports/api/api';
import {
  dashboardReportDetailOptions,
  dashboardReportsAdminOptions,
  refreshDashboardReports,
} from '@/features/dashboard-reports/api/queries';
import { HomeFlagConfirm } from '@/features/dashboard-reports/components/home-flag-confirm';
import {
  dashboardReportFormSchema,
  REPORT_FIELD_ERRORS,
  toReportBody,
  toReportForm,
} from '@/features/dashboard-reports/lib/report-form';
import {
  type DashboardReportBody,
  type ManagedDashboardReport,
  REPORT_TYPE_LABELS,
} from '@/features/dashboard-reports/lib/types';
import { reportCategoriesOptions } from '@/features/reference-data/api/queries';
import { useOpening } from '@/hooks/use-opening';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { apiErrorText, fieldErrorFor } from '@/lib/api-error';
import { isNotFound, isRefused } from '@/lib/http';
import { queryKeys } from '@/lib/key-factory';
import { reportApiError } from '@/lib/report-error';

const savesKey = [...queryKeys.dashboardReports.all, 'save'] as const;
const saveKey = (target: string) => [...savesKey, target] as const;

export function ReportFormDialog({
  target,
  onClose,
  opener,
  addButton,
  userId,
}: {
  target: string | undefined;
  userId: string;
  onClose: () => void;
  opener?: RefObject<HTMLButtonElement | null>;
  addButton?: RefObject<HTMLButtonElement | null>;
}) {
  const { shown, close, dialogProps } = useDialogTarget(target, onClose);
  const opening = useOpening(target);
  const pendingSaves = useMutationState({
    filters: { mutationKey: savesKey, status: 'pending' },
    select: (mutation) => mutation.options.mutationKey?.at(-1),
  });
  const isSaving = pendingSaves.includes(shown ?? 'new');
  const saved = useRef(false);
  const [checking, setChecking] = useState<number>();
  const isChecking = opening === checking;
  const locked = isSaving || isChecking;
  const props = dialogProps(locked);

  return (
    <FormDialog
      {...props}
      closeButton={!locked}
      finalFocus={() => {
        const trigger = opener?.current;
        const focusTarget = !saved.current && trigger?.isConnected ? trigger : addButton?.current;
        saved.current = false;
        if (opener) opener.current = null;
        return focusTarget ?? true;
      }}
    >
      {shown && (
        <ReportDialogContent
          active={props.open}
          isChecking={isChecking}
          isSaving={isSaving}
          onChecking={(checking) =>
            setChecking((previous) =>
              checking ? opening : previous === opening ? undefined : previous,
            )
          }
          userId={userId}
          key={opening}
          opening={opening}
          onDone={() => {
            saved.current = true;
            close();
          }}
          target={shown}
        />
      )}
    </FormDialog>
  );
}

type ReportFormProps = {
  active: boolean;
  isChecking: boolean;
  isSaving: boolean;
  onChecking: (checking: boolean) => void;
  userId: string;
  title: string;
  submit: string;
  onDone: () => void;
};

function ReportDialogContent({
  target,
  opening,
  onDone,
  isSaving,
  isChecking,
  active,
  onChecking,
  userId,
}: Omit<ReportFormProps, 'submit' | 'title'> & { opening: number; target: string }) {
  const { t } = useTranslation();
  const isNew = target === 'new';
  const title = t(isNew ? 'dashboard-reports.form.add-title' : 'dashboard-reports.form.edit-title');
  const submit = t(isNew ? 'dashboard-reports.form.add' : 'dashboard-reports.form.save');
  const formProps = { active, isChecking, isSaving, onDone, onChecking, submit, title, userId };
  const [savingAtOpen] = useState(isSaving);
  const [reread, setReread] = useState(false);
  if (savingAtOpen && !isSaving && !reread) setReread(true);

  return (
    <QueryBoundary
      errorComponent={({ error, reset }) =>
        isNotFound(error) ? (
          <DialogNotFound
            description={t('api-error.report.error.dashboardReport.notFound')}
            title={t('dashboard-reports.not-found-title')}
          />
        ) : isRefused(error) ? (
          <>
            <FormDialogHeader>
              <FormDialogTitle>{title}</FormDialogTitle>
            </FormDialogHeader>
            <ErrorAlert
              description={t('dashboard-reports.form.no-access')}
              title={t('dashboard-reports.form.no-access-title')}
            />
            <FormDialogFooter>
              <FormDialogCancel>{t('dialog.close')}</FormDialogCancel>
            </FormDialogFooter>
          </>
        ) : (
          <DialogLoadError
            error={error}
            errorTitle={t('dashboard-reports.load-error-title')}
            onRetry={reset}
            title={title}
          />
        )
      }
      pendingFallback={<ReportFormSkeleton isSaving={isSaving} submit={submit} title={title} />}
      resetKey={`${opening}-${reread}`}
    >
      {isNew ? (
        <ReportForm {...formProps} />
      ) : (
        <ExistingReport {...formProps} opening={opening} reread={reread} target={target} />
      )}
    </QueryBoundary>
  );
}

function ExistingReport({
  opening,
  reread,
  target,
  ...props
}: ReportFormProps & { opening: number; reread: boolean; target: string }) {
  const { data } = useSuspenseQuery(dashboardReportDetailOptions(target, opening, reread));
  return <ReportForm {...props} report={data} key={String(reread)} />;
}

function ReportForm({
  report,
  active,
  isChecking,
  isSaving,
  onChecking,
  onDone,
  submit,
  title,
  userId,
}: ReportFormProps & { report?: ManagedDashboardReport }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: reports } = useSuspenseQuery(dashboardReportsAdminOptions());
  const [checkError, setCheckError] = useState<unknown>(null);
  const [proposal, setProposal] = useState<{ current: string; body: DashboardReportBody }>();
  const activeRef = useRef(false);
  useLayoutEffect(() => {
    activeRef.current = active;
    return () => {
      activeRef.current = false;
    };
  }, [active]);
  const mutationKey = saveKey(report?.id ?? 'new');
  const save = useSessionMutation({
    mutationKey,
    mutationFn: (body: DashboardReportBody) =>
      report ? updateDashboardReport(report.id, body) : createDashboardReport(body),
    onSuccess: async (saved) => {
      await refreshDashboardReports(queryClient, save.isCurrent);
      if (!save.isCurrent()) return;
      toast.success(t(report ? 'dashboard-reports.toast.saved' : 'dashboard-reports.toast.added'), {
        description: t(
          report
            ? 'dashboard-reports.toast.saved-description'
            : 'dashboard-reports.toast.added-description',
          { name: saved.name },
        ),
      });
    },
    onError: async (error) => {
      reportApiError(error);
      const issue = fieldErrorFor(error, REPORT_FIELD_ERRORS);
      if (issue) {
        form.setFieldMeta(issue.field, (meta) => ({
          ...meta,
          errorMap: { ...meta.errorMap, onServer: issue.key },
        }));
        if (issue.field === 'categoryId') {
          await queryClient.invalidateQueries({
            queryKey: reportCategoriesOptions(userId).queryKey,
          });
        }
      } else if (report && isNotFound(error)) {
        const description = apiErrorText(
          error,
          'api-error.report.error.dashboardReport.notFound',
          t,
          { write: true },
        );
        if (description !== null)
          toast.error(t('dashboard-reports.form.save-error-title'), { description });
        await refreshDashboardReports(queryClient, save.isCurrent);
      }
    },
  });

  function submitBody(body: DashboardReportBody) {
    if (!activeRef.current || !save.isCurrent() || queryClient.isMutating({ mutationKey })) return;
    return save
      .mutateAsync(body, {
        onSuccess: () => {
          if (activeRef.current) onDone();
        },
        onError: (error) => {
          if (report && isNotFound(error) && activeRef.current) onDone();
        },
      })
      .catch(() => undefined);
  }

  const form = useAppForm({
    defaultValues: toReportForm(report),
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: {
      onDynamic: dashboardReportFormSchema(reports, window.location.origin, report?.id),
    },
    onSubmit: async ({ value }) => {
      if (!activeRef.current || isSaving || proposal || queryClient.isMutating({ mutationKey }))
        return;
      setCheckError(null);
      save.reset();
      const body = toReportBody(value, report);
      if (body.showOnHomePage && !report?.showOnHomePage) {
        onChecking(true);
        try {
          const latest = await queryClient.fetchQuery({
            ...dashboardReportsAdminOptions(),
            staleTime: 0,
          });
          if (!activeRef.current || !save.isCurrent()) return;
          const holder = latest.find((other) => other.id !== report?.id && other.showOnHomePage);
          if (holder) {
            setProposal({ current: holder.name, body });
            return;
          }
        } catch (error) {
          if (activeRef.current && save.isCurrent()) {
            reportApiError(error);
            setCheckError(error);
          }
          return;
        } finally {
          onChecking(false);
        }
      }
      await submitBody(body);
    },
  });

  function clearRefusal(field: 'name' | 'categoryId' | 'url') {
    if (!form.getFieldMeta(field)?.errorMap.onServer) return;
    form.setFieldMeta(field, (meta) => ({
      ...meta,
      errorMap: { ...meta.errorMap, onServer: undefined },
    }));
  }

  const pending = isSaving || isChecking || save.isPending;
  const saveError =
    save.isError &&
    !fieldErrorFor(save.error, REPORT_FIELD_ERRORS) &&
    !(report && isNotFound(save.error))
      ? save.error
      : null;
  const error = checkError ?? saveError;

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <FormDialogHeader>
        <FormDialogTitle>{title}</FormDialogTitle>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          {error !== null && (
            <ErrorAlert
              description={apiErrorText(error, 'error.description', t, {
                write: error === saveError,
              })}
              title={t('dashboard-reports.form.save-error-title')}
            />
          )}
          <form.AppField name="name" listeners={{ onChange: () => clearRefusal('name') }}>
            {(field) => (
              <field.TextField
                autoComplete="off"
                dir="auto"
                disabled={pending}
                label={t('dashboard-reports.name')}
                required
              />
            )}
          </form.AppField>
          <form.AppField
            name="categoryId"
            listeners={{ onChange: () => clearRefusal('categoryId') }}
          >
            {() => (
              <LookupBoundary
                label={t('dashboard-reports.category')}
                required
                errorTitle={t('dashboard-reports.form.category-load-error')}
                errorDescription={t('error.check-connection')}
              >
                <CategoryPicker userId={userId} disabled={pending} saved={report?.category} />
              </LookupBoundary>
            )}
          </form.AppField>
          <form.AppField name="type">
            {(field) => (
              <field.SelectField
                items={Object.entries(REPORT_TYPE_LABELS).map(([value, label]) => ({
                  value,
                  label: t(label),
                }))}
                disabled={pending}
                label={t('dashboard-reports.type')}
                placeholder={t('dashboard-reports.form.type-placeholder')}
                required
              />
            )}
          </form.AppField>
          <form.Subscribe selector={(state) => state.values.type}>
            {(type) => (
              <>
                {type === 'SUPERSET' && (
                  <form.AppField name="embeddedUuid">
                    {(field) => (
                      <field.TextField
                        autoComplete="off"
                        dir="ltr"
                        disabled={pending}
                        label={t('dashboard-reports.form.embedded-uuid')}
                      />
                    )}
                  </form.AppField>
                )}
                <form.AppField name="url" listeners={{ onChange: () => clearRefusal('url') }}>
                  {(field) => (
                    <field.TextField
                      autoComplete="off"
                      description={
                        type === 'SUPERSET'
                          ? t('dashboard-reports.form.url-or-uuid-hint')
                          : undefined
                      }
                      dir="ltr"
                      disabled={pending}
                      label={t('dashboard-reports.form.url')}
                      required={type === 'POWERBI'}
                    />
                  )}
                </form.AppField>
              </>
            )}
          </form.Subscribe>
          <form.AppField name="enabled">
            {(field) => (
              <field.SwitchField disabled={pending} label={t('dashboard-reports.enabled')} />
            )}
          </form.AppField>
          <form.AppField name="showOnHomePage">
            {(field) => (
              <field.SwitchField disabled={pending} label={t('dashboard-reports.home')} />
            )}
          </form.AppField>
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel disabled={pending}>{t('dialog.cancel')}</FormDialogCancel>
        <FormDialogSubmit pending={pending}>{submit}</FormDialogSubmit>
      </FormDialogFooter>
      <HomeFlagConfirm
        proposal={active && proposal ? { current: proposal.current, ...proposal.body } : undefined}
        onCancel={() => setProposal(undefined)}
        onConfirm={() => {
          if (proposal) void submitBody(proposal.body);
          setProposal(undefined);
        }}
      />
    </FormDialogForm>
  );
}

function CategoryPicker({
  userId,
  disabled,
  saved,
}: {
  userId: string;
  disabled: boolean;
  saved?: ManagedDashboardReport['category'];
}) {
  const { t } = useTranslation();
  const { data: categories, error, isFetching } = useSuspenseQuery(reportCategoriesOptions(userId));
  if (error && !isFetching) throw error;
  const items = categories.map(({ id, name }) => ({ value: id, label: name }));
  if (saved && !categories.some(({ id }) => id === saved.id)) {
    items.push({ value: saved.id, label: saved.name });
  }
  return (
    <ComboboxField
      clearLabel={t('data-table.clear-selection')}
      disabled={disabled}
      emptyMessage={t('orders.no-options')}
      items={items}
      label={t('dashboard-reports.category')}
      placeholder={t('dashboard-reports.form.category-placeholder')}
      required
      virtualized
    />
  );
}

function ReportFormSkeleton({
  isSaving,
  title,
  submit,
}: Pick<ReportFormProps, 'isSaving' | 'title' | 'submit'>) {
  const { t } = useTranslation();
  return (
    <>
      <FormDialogHeader>
        <FormDialogTitle>{title}</FormDialogTitle>
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          <FieldSkeleton label={t('dashboard-reports.name')} required />
          <FieldSkeleton label={t('dashboard-reports.category')} required />
          <FieldSkeleton label={t('dashboard-reports.type')} required />
          <FieldSkeleton label={t('dashboard-reports.form.url')} />
          <SwitchSkeleton />
          <SwitchSkeleton />
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel disabled={isSaving}>{t('dialog.cancel')}</FormDialogCancel>
        <FormDialogSubmit disabled>{submit}</FormDialogSubmit>
      </FormDialogFooter>
    </>
  );
}
