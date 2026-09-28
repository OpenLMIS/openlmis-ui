import { revalidateLogic, useStore } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2Icon, MailIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ErrorAlert, serverMessage } from '@/components/dialog-parts';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { EmailStatus } from '@/components/email-status';
import { useAppForm } from '@/components/form/form';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { resendVerification, saveProfile } from '@/features/profile/api/api';
import { pendingEmailOptions, profileOptions } from '@/features/profile/api/queries';
import { ProfileFooter } from '@/features/profile/components/profile-workspace';
import {
  applySaved,
  type ProfileFormValues,
  profileChanges,
  profileFormSchema,
  toProfileFormValues,
} from '@/features/profile/lib/profile-form';
import type { Profile } from '@/features/profile/lib/types';
import { facilityOptions } from '@/features/reference-data/api/queries';
import { useDiscardGuard } from '@/hooks/use-discard-guard';

const FORM_ID = 'profile-form';

type BasicInformationProps = {
  profile: Profile;
  /** After a save, even one that failed part way, e.g. to refresh screens that show the name. */
  onSaved: () => void;
};

export function BasicInformation({ profile, onSaved }: BasicInformationProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user, contact } = profile;
  const emailVerified = contact?.emailDetails?.emailVerified ?? false;
  const savedEmail = contact?.emailDetails?.email ?? '';
  // The saved address shows whether it is verified; a new one, that it waits for its link.
  const emailDescription = (typed: string) => {
    if (!typed) return undefined;
    return typed === savedEmail ? (
      <EmailStatus verified={emailVerified} />
    ) : (
      t('profile.email.change-hint')
    );
  };

  const save = useMutation({
    mutationFn: (values: ProfileFormValues) => saveProfile(profile, values),
    onSuccess: (_, values) => {
      toast.success(t('profile.saved-title'), {
        description: profileChanges(profile, values).email
          ? t('profile.saved-pending-email', { email: values.email.trim() })
          : t('profile.saved'),
      });
    },
    // Either way: a save that failed part way may already have stored the names.
    onSettled: async (_, error, values) => {
      const saved = await queryClient
        .fetchQuery({ ...profileOptions(user.id), staleTime: 0 })
        .catch(() => undefined);
      void queryClient.invalidateQueries({ queryKey: pendingEmailOptions(user.id).queryKey });
      onSaved();
      if (error) return;
      // The form starts again from what the server now holds; if it cannot be read, from what it took.
      const next = saved ?? applySaved(profile, values);
      if (!saved) queryClient.setQueryData(profileOptions(user.id).queryKey, next);
      form.reset(toProfileFormValues(next));
    },
  });

  const form = useAppForm({
    defaultValues: toProfileFormValues(profile),
    // Quiet until the first submit, then each field re-checks as it is corrected.
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: profileFormSchema },
    onSubmit: ({ value }) => save.mutateAsync(value).catch(() => undefined),
  });
  // Only whether anything changed, so typing re-renders this page, not every part of it.
  const changed = useStore(form.store, (state) => {
    const changes = profileChanges(profile, state.values);
    return changes.user || changes.contact;
  });
  const guard = useDiscardGuard(changed);

  return (
    <>
      <ProfileFooter>
        <Button
          disabled={!changed || save.isPending}
          onClick={() => {
            save.reset();
            form.reset(toProfileFormValues(profile));
          }}
          size="lg"
          variant="outline"
        >
          {t('profile.cancel')}
        </Button>
        <Button disabled={!changed || save.isPending} form={FORM_ID} size="lg" type="submit">
          {save.isPending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
          {t('profile.save')}
        </Button>
      </ProfileFooter>
      <div className="flex flex-col gap-4 lg:gap-6">
        <AccountSummary profile={profile} />
        <Card>
          <CardHeader>
            <CardTitle>{t('profile.details.title')}</CardTitle>
            <CardDescription>{t('profile.details.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              id={FORM_ID}
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                if (changed) void form.handleSubmit();
              }}
            >
              <FieldGroup>
                {save.isError && (
                  <ErrorAlert
                    description={serverMessage(save.error) ?? t('users.form.save-error')}
                    title={t('profile.save-error-title')}
                  />
                )}
                <FieldRow>
                  <form.AppField name="firstName">
                    {(field) => (
                      <field.TextField
                        autoComplete="given-name"
                        label={t('users.form.first-name')}
                        required
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="lastName">
                    {(field) => (
                      <field.TextField
                        autoComplete="family-name"
                        label={t('users.form.last-name')}
                        required
                      />
                    )}
                  </form.AppField>
                </FieldRow>
                <form.AppField name="email">
                  {(field) => (
                    <field.TextField
                      autoComplete="email"
                      dir="ltr"
                      description={emailDescription(field.state.value.trim())}
                      label={t('users.email')}
                      type="email"
                    />
                  )}
                </form.AppField>
                <PendingEmail userId={user.id} />
                <form.AppField name="phoneNumber">
                  {(field) => (
                    <field.TextField
                      autoComplete="tel"
                      dir="ltr"
                      label={t('users.form.phone-number')}
                      type="tel"
                    />
                  )}
                </form.AppField>
                <form.Subscribe selector={(state) => state.values.email.trim() !== ''}>
                  {(hasEmail) => (
                    <form.AppField name="allowNotify">
                      {(field) => (
                        <field.SwitchField
                          description={t(
                            emailVerified && hasEmail
                              ? 'profile.allow-notify.description'
                              : 'profile.allow-notify.needs-verified',
                          )}
                          disabled={!emailVerified || !hasEmail}
                          label={t('users.form.allow-notify')}
                        />
                      )}
                    </form.AppField>
                  )}
                </form.Subscribe>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
      <DiscardChangesDialog description={t('profile.discard-description')} {...guard.dialog} />
    </>
  );
}

function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-5 @xl/main:grid-cols-2">{children}</div>;
}

/** What only an administrator can change, shown as facts rather than as locked fields. */
function AccountSummary({ profile: { user } }: { profile: Profile }) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.summary.title')}</CardTitle>
        <CardDescription>{t('profile.summary.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 @xl/main:grid-cols-3">
          <SummaryItem label={t('users.username')}>{user.username}</SummaryItem>
          <SummaryItem label={t('users.form.job-title')}>
            {user.jobTitle || t('profile.summary.none')}
          </SummaryItem>
          <SummaryItem label={t('users.form.home-facility')}>
            {user.homeFacilityId ? (
              <FacilityName id={user.homeFacilityId} />
            ) : (
              t('profile.summary.none')
            )}
          </SummaryItem>
        </dl>
      </CardContent>
    </Card>
  );
}

function SummaryItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="truncate font-medium">{children}</dd>
    </div>
  );
}

function FacilityName({ id }: { id: string }) {
  const { t } = useTranslation();
  const { data, isPending, isError } = useQuery(facilityOptions(id));

  if (isPending) {
    return (
      <span className="flex h-5 items-center">
        <span className="h-3.5 w-40">
          <Skeleton fill />
        </span>
      </span>
    );
  }
  if (isError) return t('users.roles.unknown');
  return `${data.code} - ${data.name}`;
}

/** A changed email waits for its link to be opened; until then the old one stays in use. */
function PendingEmail({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { data: email } = useQuery(pendingEmailOptions(userId));
  const resend = useMutation({
    mutationFn: () => resendVerification(userId),
    onSuccess: () => {
      toast.success(t('profile.email.resent-title'), {
        description: t('profile.email.resent', { email }),
      });
    },
    onError: (error) => {
      toast.error(t('profile.email.resend-error-title'), {
        description: serverMessage(error) ?? t('users.form.save-error'),
      });
    },
  });

  if (!email) return null;

  return (
    <Alert>
      <MailIcon />
      <AlertTitle>{t('profile.email.pending-title')}</AlertTitle>
      <AlertDescription>{t('profile.email.pending', { email })}</AlertDescription>
      <AlertAction>
        <Button
          disabled={resend.isPending}
          onClick={() => resend.mutate()}
          size="sm"
          type="button"
          variant="outline"
        >
          {resend.isPending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
          {t('profile.email.resend')}
        </Button>
      </AlertAction>
    </Alert>
  );
}
