import { revalidateLogic, useStore } from '@tanstack/react-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BellOffIcon, Loader2Icon, MailXIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  CardBand,
  CardControlRow,
  CardList,
  CardListItem,
  CardListSkeleton,
  CardRows,
  SkeletonBar,
} from '@/components/card-list';
import {
  DataTableCard,
  DataTableEmpty,
  DataTableError,
  DataTableHeaderLabel,
} from '@/components/data-table/data-table';
import { ErrorAlert, serverMessage } from '@/components/dialog-parts';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { useAppForm } from '@/components/form/form';
import { Block } from '@/components/skeleton-block';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { WorkspaceFooterPortal } from '@/components/workspace-tabs';
import { saveSubscriptions } from '@/features/profile/api/api';
import { digestConfigurationsOptions, subscriptionsOptions } from '@/features/profile/api/queries';
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
import { useCardLayout } from '@/hooks/use-card-view';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { revealField } from '@/lib/reveal-field';

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
    <DataTableCard>
      <DataTableEmpty
        description={t('profile.notifications.no-contact')}
        icon={<MailXIcon />}
        title={t('profile.notifications.no-contact-title')}
      />
    </DataTableCard>
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
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  const savedRows = useMemo(
    () => toDigestRows(configurations, subscriptions),
    [configurations, subscriptions],
  );

  const save = useSessionMutation({
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
      if (!save.isCurrent()) return;
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
    onSubmitInvalid: () =>
      requestAnimationFrame(() => {
        const target = document
          .getElementById(FORM_ID)
          ?.querySelector<HTMLElement>('[aria-invalid="true"]');
        if (target) revealField(target, cards);
      }),
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

  const rowFields = (row: DigestRow, index: number) => {
    const named = (control: string) => `${tagLabel(row.tag)} ${control}`;
    return {
      channel: (
        <form.AppField name={`rows[${index}].channel`}>
          {(field) => (
            <field.SelectField
              items={channels(row.useDigest)}
              label={named(t('profile.notifications.channel'))}
              layout="inline"
            />
          )}
        </form.AppField>
      ),
      digest: (
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
              label={named(t('profile.notifications.use-digest'))}
              layout="inline"
            />
          )}
        </form.AppField>
      ),
      frequency: (
        <form.AppField
          listeners={{
            onChange: ({ value }: { value: Frequency }) => {
              if (value === 'custom' && row.schedule.frequency !== 'custom')
                form.setFieldValue(`rows[${index}].schedule.cron`, toCron(row.schedule));
            },
          }}
          name={`rows[${index}].schedule.frequency`}
        >
          {(field) => (
            <field.SelectField
              items={frequencies}
              label={named(t('profile.notifications.frequency'))}
              layout="inline"
            />
          )}
        </form.AppField>
      ),
      weekday: (
        <form.AppField name={`rows[${index}].schedule.weekday`}>
          {(field) => (
            <field.SelectField
              items={weekdays}
              label={named(t('profile.notifications.weekday'))}
              layout="inline"
            />
          )}
        </form.AppField>
      ),
      timing:
        row.schedule.frequency === 'custom' ? (
          <form.AppField name={`rows[${index}].schedule.cron`}>
            {(field) => (
              <field.TextField
                autoComplete="off"
                description={t('profile.notifications.cron-description', {
                  example: CRON_EXAMPLE,
                })}
                dir="ltr"
                label={named(t('profile.notifications.cron'))}
                layout="inline"
                required
              />
            )}
          </form.AppField>
        ) : (
          <form.AppField name={`rows[${index}].schedule.time`}>
            {(field) => (
              <field.TextField
                dir="ltr"
                label={named(t('profile.notifications.time'))}
                layout="inline"
                required
                type="time"
              />
            )}
          </form.AppField>
        ),
    };
  };

  return (
    <div ref={measure}>
      {savedRows.length > 0 && (
        <WorkspaceFooterPortal>
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
        </WorkspaceFooterPortal>
      )}
      {rows.length === 0 ? (
        <DataTableCard>
          <DataTableEmpty
            description={t('profile.notifications.empty')}
            icon={<BellOffIcon />}
            title={t('profile.notifications.empty-title')}
          />
        </DataTableCard>
      ) : (
        <form
          className="flex flex-col gap-4"
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
          {cards ? (
            <CardList>
              {rows.map((row, index) => {
                const fields = rowFields(row, index);
                return (
                  <CardListItem key={row.configurationId}>
                    <CardBand>
                      <bdi className="min-w-0 wrap-anywhere">{tagLabel(row.tag)}</bdi>
                    </CardBand>
                    <CardRows>
                      <CardControlRow label={t('profile.notifications.channel')}>
                        {fields.channel}
                      </CardControlRow>
                      <CardControlRow label={t('profile.notifications.use-digest')} width="fit">
                        {fields.digest}
                      </CardControlRow>
                      {row.useDigest && (
                        <CardControlRow label={t('profile.notifications.frequency')}>
                          {fields.frequency}
                        </CardControlRow>
                      )}
                      {row.useDigest && row.schedule.frequency === 'weekly' && (
                        <CardControlRow label={t('profile.notifications.weekday')}>
                          {fields.weekday}
                        </CardControlRow>
                      )}
                      {row.useDigest && (
                        <CardControlRow
                          label={t(
                            row.schedule.frequency === 'custom'
                              ? 'profile.notifications.cron'
                              : 'profile.notifications.time',
                          )}
                        >
                          {fields.timing}
                        </CardControlRow>
                      )}
                    </CardRows>
                  </CardListItem>
                );
              })}
            </CardList>
          ) : (
            <DataTableCard>
              <Table density="comfortable">
                <NotificationsHeader />
                <TableBody>
                  {rows.map((row, index) => {
                    const fields = rowFields(row, index);
                    return (
                      <TableRow key={row.configurationId}>
                        <TableCell>
                          <span className="whitespace-normal font-medium">{tagLabel(row.tag)}</span>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-28">{fields.channel}</div>
                        </TableCell>
                        <TableCell>{fields.digest}</TableCell>
                        <TableCell>
                          {row.useDigest ? (
                            <div className="flex items-start gap-2 whitespace-normal">
                              <div className="min-w-28">{fields.frequency}</div>
                              {row.schedule.frequency === 'weekly' && (
                                <div className="min-w-36">{fields.weekday}</div>
                              )}
                              <div
                                className={row.schedule.frequency === 'custom' ? 'w-44' : 'w-32'}
                              >
                                {fields.timing}
                              </div>
                            </div>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </DataTableCard>
          )}
          {rows.some((row) => row.useDigest) && (
            <p className="text-muted-foreground text-sm">
              {rows.some((row) => row.useDigest && row.schedule.frequency === 'custom')
                ? t('profile.notifications.digest-hint', { example: CRON_EXAMPLE })
                : t('profile.notifications.digest-email-only')}
            </p>
          )}
        </form>
      )}
      <DiscardChangesDialog
        description={t('profile.notifications.discard-description', { count: changes })}
        {...guard.dialog}
      />
    </div>
  );
}

function NotificationsHeader() {
  const { t } = useTranslation();
  return (
    <TableHeader surface="muted">
      <TableRow>
        <TableHead>
          <DataTableHeaderLabel>{t('profile.notifications.notification')}</DataTableHeaderLabel>
        </TableHead>
        <TableHead>
          <DataTableHeaderLabel>{t('profile.notifications.channel')}</DataTableHeaderLabel>
        </TableHead>
        <TableHead>
          <DataTableHeaderLabel>{t('profile.notifications.use-digest')}</DataTableHeaderLabel>
        </TableHead>
        <TableHead>
          <DataTableHeaderLabel>{t('profile.notifications.schedule')}</DataTableHeaderLabel>
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}

const SKELETON_ROWS = ['a', 'b', 'c', 'd'];

export function NotificationSettingsSkeleton() {
  const { measure, cards } = useCardLayout<HTMLDivElement>();
  return (
    <div aria-busy ref={measure}>
      {cards ? (
        <CardListSkeleton
          band={<SkeletonBar width="w-48" />}
          count={SKELETON_ROWS.length}
          pagination={false}
          rows={2}
        />
      ) : (
        <DataTableCard>
          <Table density="comfortable">
            <NotificationsHeader />
            <TableBody>
              {SKELETON_ROWS.map((row) => (
                <TableRow key={row}>
                  <TableCell>
                    <Block className="h-5 w-48 py-0.5" />
                  </TableCell>
                  <TableCell>
                    <Block className="h-8 w-28" />
                  </TableCell>
                  <TableCell>
                    <Block className="h-5 w-8" shape="circle" />
                  </TableCell>
                  <TableCell>
                    <Block className="h-8 w-32" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableCard>
      )}
    </div>
  );
}
