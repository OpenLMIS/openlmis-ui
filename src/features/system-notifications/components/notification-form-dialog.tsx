import { revalidateLogic, useStore } from '@tanstack/react-form';
import { useIsMutating, useQuery, useQueryClient, useSuspenseQueries } from '@tanstack/react-query';
import { type RefObject, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { QueryBoundary } from '@/components/app-shell/query-boundary';
import {
  DialogLoadError,
  DialogNotFound,
  ErrorAlert,
  FieldSkeleton,
  SkeletonLine,
  SwitchRowSkeleton,
} from '@/components/display/dialog-parts';
import { formatTimestamp, isEditableDateValue } from '@/components/form/date-value';
import { useAppForm, withForm } from '@/components/form/form';
import { FormErrorMessagesProvider, useFormatError } from '@/components/form/form-messages';
import { SettingsItem, SettingsList } from '@/components/form/settings-list';
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
import { FieldGroup } from '@/components/ui/field';
import { userRecordOptions } from '@/features/reference-data/api/queries';
import { createNotification, updateNotification } from '@/features/system-notifications/api/api';
import {
  DeploymentTimeZoneUnavailable,
  notificationAuthorOptions,
  notificationDetailOptions,
  notificationListsKey,
  notificationTimeZoneOptions,
} from '@/features/system-notifications/api/queries';
import {
  EMPTY_NOTIFICATION_FORM,
  NONEXISTENT_TIME,
  NOTIFICATION_FIELD_ERRORS,
  type NotificationFormValues,
  notificationFormSchema,
  TITLE_MAX,
  toFormValues,
  toPayload,
} from '@/features/system-notifications/lib/notification-form';
import type { SavedNotification } from '@/features/system-notifications/lib/types';
import { useOpening } from '@/hooks/use-opening';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { apiErrorText, fieldErrorFor } from '@/lib/api-error';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { isNotFound } from '@/lib/http';
import { queryKeys } from '@/lib/key-factory';
import { reportApiError } from '@/lib/report-error';
import { getSessionUserId, SessionEndedError } from '@/lib/session-scope';
import { fullName } from '@/lib/text';

const saveKey = (target: string) => [...queryKeys.systemNotifications.all, 'save', target] as const;

const DATE_FIELDS = [
  {
    name: 'startDate',
    time: 'startTime',
    dateLabel: 'system-notifications.admin.start-date',
    timeLabel: 'system-notifications.admin.start-time',
    defaultTime: '00:00',
  },
  {
    name: 'expiryDate',
    time: 'expiryTime',
    dateLabel: 'system-notifications.admin.expiry-date',
    timeLabel: 'system-notifications.admin.expiry-time',
    defaultTime: '23:59',
  },
] as const;

export function NotificationFormDialog({
  target,
  onClose,
  focusAfterSave,
}: {
  target: string | undefined;
  onClose: () => void;
  focusAfterSave?: RefObject<HTMLButtonElement | null>;
}) {
  const { shown, close, dialogProps } = useDialogTarget(target, onClose);
  const isSaving = useIsMutating({ mutationKey: saveKey(shown ?? 'new') }) > 0;

  const saved = useRef(false);

  return (
    <FormDialog
      {...dialogProps(isSaving)}
      finalFocus={() => {
        const focusTarget = saved.current ? focusAfterSave?.current : null;
        saved.current = false;
        return focusTarget ?? true;
      }}
    >
      {shown && (
        <NotificationDialogContent
          key={shown}
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

function NotificationDialogContent({ target, onDone }: { target: string; onDone: () => void }) {
  const { t } = useTranslation();
  const opening = useOpening();
  const isNew = target === 'new';
  const title = t(
    isNew ? 'system-notifications.admin.add-title' : 'system-notifications.admin.edit-title',
  );
  const submit = t(
    isNew ? 'system-notifications.admin.add-title' : 'system-notifications.admin.update',
  );

  return (
    <QueryBoundary
      errorComponent={({ error, reset }) =>
        isNotFound(error) && !isNew ? (
          <DialogNotFound description={t('system-notifications.admin.not-found')} title={title} />
        ) : (
          <DialogLoadError
            error={error}
            errorTitle={t(
              error instanceof DeploymentTimeZoneUnavailable
                ? 'system-notifications.admin.time-zone-error'
                : 'system-notifications.admin.load-error',
            )}
            onRetry={reset}
            title={title}
          />
        )
      }
      pendingFallback={<NotificationFormSkeleton editing={!isNew} submit={submit} title={title} />}
      resetKey={opening}
    >
      {isNew ? (
        <NewNotification onDone={onDone} opening={opening} title={title} submit={submit} />
      ) : (
        <ExistingNotification
          onDone={onDone}
          opening={opening}
          target={target}
          title={title}
          submit={submit}
        />
      )}
    </QueryBoundary>
  );
}

type FormLoadProps = { opening: number; title: string; submit: string; onDone: () => void };

function NewNotification({ opening, ...props }: FormLoadProps) {
  const authorId = getSessionUserId();
  if (!authorId) throw new SessionEndedError();
  const [{ data: zone }, { data: user }] = useSuspenseQueries({
    queries: [notificationTimeZoneOptions(opening), userRecordOptions(authorId)],
  });
  return (
    <NotificationForm
      {...props}
      authorId={authorId}
      authorName={fullName(user) || user.username}
      zone={zone}
    />
  );
}

function ExistingNotification({ opening, target, ...props }: FormLoadProps & { target: string }) {
  const [{ data: zone }, { data: saved }] = useSuspenseQueries({
    queries: [notificationTimeZoneOptions(opening), notificationDetailOptions(target, opening)],
  });
  return <NotificationForm {...props} authorId={saved.author.id} saved={saved} zone={zone} />;
}

function NotificationAuthor({ authorId }: { authorId: string }) {
  const { t } = useTranslation();
  const author = useQuery(notificationAuthorOptions(authorId));
  if (author.isPending) return <SkeletonLine width="short" />;
  if (author.isError) return t('system-notifications.admin.author-error');
  return <bdi>{author.data || EMPTY_VALUE}</bdi>;
}

type NotificationFormProps = {
  title: string;
  submit: string;
  authorId: string;
  authorName?: string;
  zone: string;
  saved?: SavedNotification;
  onDone: () => void;
};

function NotificationForm({
  title,
  submit,
  authorId,
  authorName,
  zone,
  saved,
  onDone,
}: NotificationFormProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const formatError = useFormatError();
  const formatZonedError = useCallback(
    (key: string) => (key === NONEXISTENT_TIME ? t(NONEXISTENT_TIME, { zone }) : formatError(key)),
    [formatError, t, zone],
  );
  const schema = useMemo(() => notificationFormSchema(zone, saved), [zone, saved]);
  const defaultValues = useMemo(
    () => (saved ? toFormValues(saved, zone) : EMPTY_NOTIFICATION_FORM),
    [saved, zone],
  );
  const errorTitle = t(
    saved ? 'system-notifications.admin.update-error' : 'system-notifications.admin.create-error',
  );
  const save = useSessionMutation({
    mutationKey: saveKey(saved?.id ?? 'new'),
    mutationFn: (values: NotificationFormValues) =>
      saved
        ? updateNotification(toPayload(values, zone, authorId, saved))
        : createNotification(toPayload(values, zone, authorId)),
    onSuccess: async () => {
      const lists = { queryKey: notificationListsKey };
      await queryClient.cancelQueries(lists);
      if (!save.isCurrent()) return;
      void queryClient.invalidateQueries(lists);
      toast.success(
        t(
          saved
            ? 'system-notifications.admin.updated-title'
            : 'system-notifications.admin.created-title',
        ),
        {
          description: t(
            saved ? 'system-notifications.admin.updated' : 'system-notifications.admin.created',
          ),
        },
      );
    },
    onError: (error) => {
      reportApiError(error);
      const fieldError = fieldErrorFor(error, NOTIFICATION_FIELD_ERRORS);
      if (fieldError) {
        form.setFieldMeta(fieldError.field, (meta) => ({
          ...meta,
          errorMap: { ...meta.errorMap, onServer: fieldError.key },
        }));
      }
    },
  });
  const form = useAppForm({
    defaultValues,
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: schema },
    onSubmit: ({ value }) => save.mutateAsync(value, { onSuccess: onDone }).catch(() => undefined),
    onSubmitInvalid: ({ formApi }) => {
      const fields = [
        'message',
        'startDate',
        'startTime',
        'expiryDate',
        'expiryTime',
        'title',
      ] as const;
      const invalid = fields.find((name) => formApi.getFieldMeta(name)?.errors.length);
      if (invalid) document.getElementById(invalid)?.focus();
    },
  });
  function clearRefusal(name: 'message' | 'expiryDate') {
    if (!form.getFieldMeta(name)?.errorMap.onServer) return;
    form.setFieldMeta(name, (meta) => ({
      ...meta,
      errorMap: { ...meta.errorMap, onServer: undefined },
    }));
  }

  return (
    <FormDialogForm onSubmit={form.handleSubmit}>
      <FormDialogHeader>
        <FormDialogTitle>{title}</FormDialogTitle>
        <FormDialogDescription>
          {t('system-notifications.admin.time-zone', { zone })}
        </FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <FormErrorMessagesProvider formatError={formatZonedError}>
          <FieldGroup>
            {save.isError && !fieldErrorFor(save.error, NOTIFICATION_FIELD_ERRORS) && (
              <ErrorAlert
                description={apiErrorText(save.error, 'error.description', t, { write: true })}
                title={errorTitle}
              />
            )}
            <SettingsList density="compact">
              <SettingsItem label={t('system-notifications.admin.author')}>
                {saved ? (
                  <NotificationAuthor authorId={authorId} />
                ) : (
                  <bdi>{authorName || EMPTY_VALUE}</bdi>
                )}
              </SettingsItem>
              {saved && (
                <SettingsItem label={t('system-notifications.admin.created-date')}>
                  {formatTimestamp(saved.createdDate, i18n.language, {
                    time: true,
                    timeZone: zone,
                  })}
                </SettingsItem>
              )}
            </SettingsList>
            <form.AppField name="message" listeners={{ onChange: () => clearRefusal('message') }}>
              {(field) => (
                <field.TextareaField
                  disabled={save.isPending}
                  dir="auto"
                  label={t('system-notifications.admin.message')}
                  required
                />
              )}
            </form.AppField>
            <NotificationDateFields
              clearExpiryRefusal={() => clearRefusal('expiryDate')}
              disabled={save.isPending}
              form={form}
            />
            <form.AppField name="title">
              {(field) => (
                <field.TextField
                  dir="auto"
                  description={t('system-notifications.admin.characters-left', {
                    count: TITLE_MAX - field.state.value.length,
                  })}
                  disabled={save.isPending}
                  label={t('system-notifications.admin.title')}
                  maxLength={TITLE_MAX}
                />
              )}
            </form.AppField>
            <form.AppField name="active">
              {(field) => (
                <field.SwitchField
                  disabled={save.isPending}
                  label={t('system-notifications.admin.active')}
                />
              )}
            </form.AppField>
          </FieldGroup>
        </FormErrorMessagesProvider>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel disabled={save.isPending}>{t('dialog.cancel')}</FormDialogCancel>
        <FormDialogSubmit pending={save.isPending}>{submit}</FormDialogSubmit>
      </FormDialogFooter>
    </FormDialogForm>
  );
}

const NotificationDateFields = withForm({
  defaultValues: EMPTY_NOTIFICATION_FORM,
  props: { clearExpiryRefusal: () => {}, disabled: false },
  render: function NotificationDateFields({ form, clearExpiryRefusal, disabled }) {
    const { t } = useTranslation();
    const startDate = useStore(form.store, (state) => state.values.startDate);
    const expiryDate = useStore(form.store, (state) => state.values.expiryDate);
    const validStart = isEditableDateValue(startDate, 'civil') ? startDate : undefined;
    const validExpiry = isEditableDateValue(expiryDate, 'civil') ? expiryDate : undefined;

    return (
      <>
        {DATE_FIELDS.map(({ name, time, dateLabel, timeLabel, defaultTime }) => {
          const isStart = name === 'startDate';
          const hasDate = Boolean(isStart ? validStart : validExpiry);
          const label = t(dateLabel);
          return (
            <div className="grid grid-cols-2 gap-3" key={name}>
              <form.AppField
                name={name}
                listeners={{
                  onChange: ({ value }) => {
                    clearExpiryRefusal();
                    if (!value) form.setFieldValue(time, '');
                    else if (isEditableDateValue(value, 'civil') && !form.getFieldValue(time)) {
                      form.setFieldValue(time, defaultTime);
                    }
                  },
                }}
              >
                {(field) => (
                  <field.DateField
                    clearLabel={t('data-table.clear-filter', { label })}
                    dateMode="civil"
                    disabled={disabled}
                    earliest={isStart ? undefined : validStart}
                    label={label}
                    latest={isStart ? validExpiry : undefined}
                  />
                )}
              </form.AppField>
              <form.AppField name={time} listeners={{ onChange: () => clearExpiryRefusal() }}>
                {(field) => (
                  <field.TextField
                    disabled={disabled || !hasDate}
                    label={t(timeLabel)}
                    required={hasDate}
                    type="time"
                  />
                )}
              </form.AppField>
            </div>
          );
        })}
      </>
    );
  },
});

function NotificationFormSkeleton({
  editing,
  title,
  submit,
}: {
  editing: boolean;
  title: string;
  submit: string;
}) {
  const { t } = useTranslation();
  return (
    <>
      <FormDialogHeader>
        <FormDialogTitle>{title}</FormDialogTitle>
        <SkeletonLine width="medium" />
      </FormDialogHeader>
      <FormDialogBody>
        <FieldGroup>
          <SettingsList density="compact">
            <SettingsItem label={t('system-notifications.admin.author')}>
              <SkeletonLine width="short" />
            </SettingsItem>
            {editing && (
              <SettingsItem label={t('system-notifications.admin.created-date')}>
                <SkeletonLine width="short" />
              </SettingsItem>
            )}
          </SettingsList>
          <FieldSkeleton
            control="textarea"
            label={t('system-notifications.admin.message')}
            required
          />
          {DATE_FIELDS.map(({ name, dateLabel, timeLabel }) => (
            <div className="grid grid-cols-2 gap-3" key={name}>
              <FieldSkeleton label={t(dateLabel)} />
              <FieldSkeleton label={t(timeLabel)} />
            </div>
          ))}
          <FieldSkeleton label={t('system-notifications.admin.title')} />
          <SwitchRowSkeleton label={t('system-notifications.admin.active')} />
        </FieldGroup>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('dialog.cancel')}</FormDialogCancel>
        <FormDialogSubmit disabled>{submit}</FormDialogSubmit>
      </FormDialogFooter>
    </>
  );
}
