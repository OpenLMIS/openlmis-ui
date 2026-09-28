import { revalidateLogic, useStore } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellOffIcon, Loader2Icon, MailXIcon } from 'lucide-react';
import { Fragment, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { DataTableError } from '@/components/data-table/data-table';
import { ErrorAlert, serverMessage } from '@/components/dialog-parts';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { useAppForm } from '@/components/form/form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { FieldGroup, FieldLegend, FieldSet } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { saveSubscriptions } from '@/features/profile/api/api';
import { digestConfigurationsOptions, subscriptionsOptions } from '@/features/profile/api/queries';
import { ProfileFooter } from '@/features/profile/components/profile-workspace';
import {
  countDigestChanges,
  type DigestRow,
  digestFormSchema,
  FREQUENCIES,
  type Frequency,
  tagLabel,
  toCron,
  toDigestRows,
  toSubscriptions,
  WEEKDAYS,
} from '@/features/profile/lib/digest';
import type { DigestConfiguration, DigestSubscription } from '@/features/profile/lib/types';
import { useDiscardGuard } from '@/hooks/use-discard-guard';

const FORM_ID = 'notification-settings-form';

// Isolated left to right with no-break spaces, so it reads the same, on one line, inside Arabic text.
const CRON_EXAMPLE = '\u20660\u00a00\u00a08\u00a0*\u00a0*\u00a0MON-FRI\u2069';

type NotificationSettingsProps = {
  userId: string;
  /** Subscriptions belong to the contact details, so a user without them has none to set. */
  hasContactDetails: boolean;
};

export function NotificationSettings({ userId, hasContactDetails }: NotificationSettingsProps) {
  const { t } = useTranslation();
  const configurations = useQuery({ ...digestConfigurationsOptions(), enabled: hasContactDetails });
  const subscriptions = useQuery({ ...subscriptionsOptions(userId), enabled: hasContactDetails });

  if (configurations.data && subscriptions.data) {
    return (
      <DigestForm
        configurations={configurations.data}
        subscriptions={subscriptions.data}
        userId={userId}
      />
    );
  }

  const failed = configurations.isError || subscriptions.isError;
  return !hasContactDetails ? (
    <Card>
      <CardContent>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MailXIcon />
            </EmptyMedia>
            <EmptyTitle>{t('profile.notifications.no-contact-title')}</EmptyTitle>
            <EmptyDescription>{t('profile.notifications.no-contact')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </CardContent>
    </Card>
  ) : failed ? (
    <DataTableError
      description={t('profile.notifications.error-description')}
      onRetry={() => {
        void configurations.refetch();
        void subscriptions.refetch();
      }}
      title={t('profile.notifications.error-title')}
    />
  ) : (
    <NotificationSettingsSkeleton />
  );
}

type DigestFormProps = {
  userId: string;
  configurations: DigestConfiguration[];
  subscriptions: DigestSubscription[];
};

function DigestForm({ userId, configurations, subscriptions }: DigestFormProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const savedRows = useMemo(
    () => toDigestRows(configurations, subscriptions),
    [configurations, subscriptions],
  );

  const save = useMutation({
    mutationFn: (rows: DigestRow[]) => saveSubscriptions(userId, toSubscriptions(rows)),
    onSuccess: () => {
      toast.success(t('profile.notifications.saved-title'), {
        description: t('profile.notifications.saved'),
      });
    },
    onSettled: async (_, error, rows) => {
      const options = subscriptionsOptions(userId);
      const saved = await queryClient
        .fetchQuery({ ...options, staleTime: 0 })
        .catch(() => undefined);
      if (error) return;
      // The form starts again from what the server now holds; if it cannot be read, from what it took.
      const next = saved ?? toSubscriptions(rows);
      if (!saved) queryClient.setQueryData(options.queryKey, next);
      form.reset({ rows: toDigestRows(configurations, next) });
    },
  });

  const form = useAppForm({
    defaultValues: { rows: savedRows },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: digestFormSchema },
    onSubmit: ({ value }) => save.mutateAsync(value.rows).catch(() => undefined),
  });
  const rows = useStore(form.store, (state) => state.values.rows);
  const changes = countDigestChanges(savedRows, rows);
  const guard = useDiscardGuard(changes > 0);

  const channels = (useDigest: boolean) => [
    { value: 'EMAIL', label: t('profile.notifications.email') },
    { value: 'SMS', label: t('profile.notifications.sms'), disabled: useDigest },
  ];
  const frequencies = FREQUENCIES.map((value) => ({
    value,
    label: t(`profile.notifications.${value}`),
  }));
  const weekdays = useMemo(() => {
    const format = new Intl.DateTimeFormat(i18n.language, { weekday: 'long' });
    // 7 January 2024 was a Sunday, day 0 in cron.
    return WEEKDAYS.map((day) => ({
      value: day,
      label: format.format(new Date(2024, 0, 7 + Number(day))),
    }));
  }, [i18n.language]);

  return (
    <>
      {savedRows.length > 0 && (
        <ProfileFooter>
          <Button
            disabled={changes === 0 || save.isPending}
            onClick={() => {
              save.reset();
              form.reset({ rows: savedRows });
            }}
            size="lg"
            variant="outline"
          >
            {t('profile.cancel')}
          </Button>
          <Button disabled={changes === 0 || save.isPending} form={FORM_ID} size="lg" type="submit">
            {save.isPending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
            {t('profile.notifications.save')}
          </Button>
        </ProfileFooter>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.notifications.title')}</CardTitle>
          <CardDescription>{t('profile.notifications.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BellOffIcon />
                </EmptyMedia>
                <EmptyTitle>{t('profile.notifications.empty-title')}</EmptyTitle>
                <EmptyDescription>{t('profile.notifications.empty')}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <form
              className="flex flex-col gap-6"
              id={FORM_ID}
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                if (changes > 0) void form.handleSubmit();
              }}
            >
              {save.isError && (
                <ErrorAlert
                  description={serverMessage(save.error) ?? t('users.form.save-error')}
                  title={t('profile.notifications.save-error-title')}
                />
              )}
              {rows.map((row, index) => (
                <Fragment key={row.configurationId}>
                  {index > 0 && <Separator />}
                  <FieldSet>
                    <FieldLegend>{tagLabel(row.tag)}</FieldLegend>
                    <FieldGroup>
                      <div className="grid gap-5 @2xl/main:grid-cols-2">
                        <form.AppField name={`rows[${index}].channel`}>
                          {(field) => (
                            <field.SelectField
                              description={
                                row.useDigest && t('profile.notifications.digest-email-only')
                              }
                              items={channels(row.useDigest)}
                              label={t('profile.notifications.channel')}
                            />
                          )}
                        </form.AppField>
                        <form.AppField
                          listeners={{
                            onChange: ({ value }) => {
                              if (value && form.getFieldValue(`rows[${index}].channel`) !== 'EMAIL')
                                form.setFieldValue(`rows[${index}].channel`, 'EMAIL');
                            },
                          }}
                          name={`rows[${index}].useDigest`}
                        >
                          {(field) => (
                            <field.SwitchField
                              description={t('profile.notifications.use-digest-description')}
                              label={t('profile.notifications.use-digest')}
                            />
                          )}
                        </form.AppField>
                      </div>
                      {row.useDigest && (
                        <div className="grid gap-5 @2xl/main:grid-cols-3">
                          <form.AppField
                            listeners={{
                              onChange: ({ value }: { value: Frequency }) => {
                                // A custom schedule starts from the simple one it replaces.
                                if (value === 'custom' && row.schedule.frequency !== 'custom')
                                  form.setFieldValue(
                                    `rows[${index}].schedule.cron`,
                                    toCron(row.schedule),
                                  );
                              },
                            }}
                            name={`rows[${index}].schedule.frequency`}
                          >
                            {(field) => (
                              <field.SelectField
                                items={frequencies}
                                label={t('profile.notifications.frequency')}
                              />
                            )}
                          </form.AppField>
                          {row.schedule.frequency === 'weekly' && (
                            <form.AppField name={`rows[${index}].schedule.weekday`}>
                              {(field) => (
                                <field.SelectField
                                  items={weekdays}
                                  label={t('profile.notifications.weekday')}
                                />
                              )}
                            </form.AppField>
                          )}
                          {row.schedule.frequency === 'custom' ? (
                            <form.AppField name={`rows[${index}].schedule.cron`}>
                              {(field) => (
                                <field.TextField
                                  autoComplete="off"
                                  description={t('profile.notifications.cron-description', {
                                    example: CRON_EXAMPLE,
                                  })}
                                  dir="ltr"
                                  label={t('profile.notifications.cron')}
                                  required
                                />
                              )}
                            </form.AppField>
                          ) : (
                            <form.AppField name={`rows[${index}].schedule.time`}>
                              {(field) => (
                                <field.TextField
                                  dir="ltr"
                                  label={t('profile.notifications.time')}
                                  required
                                  type="time"
                                />
                              )}
                            </form.AppField>
                          )}
                        </div>
                      )}
                    </FieldGroup>
                  </FieldSet>
                </Fragment>
              ))}
            </form>
          )}
        </CardContent>
      </Card>
      <DiscardChangesDialog
        description={t('profile.notifications.discard-description', { count: changes })}
        {...guard.dialog}
      />
    </>
  );
}

function NotificationSettingsSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-4">
      {[0, 1, 2].map((item) => (
        <div className="h-24 w-full" key={item}>
          <Skeleton fill />
        </div>
      ))}
    </div>
  );
}
