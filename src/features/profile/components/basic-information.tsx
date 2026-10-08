import { revalidateLogic, useStore } from '@tanstack/react-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2Icon, MailIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ErrorAlert, serverMessage } from '@/components/dialog-parts';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import { EmailStatus } from '@/components/email-status';
import { useAppForm } from '@/components/form/form';
import { FieldLabelText } from '@/components/form/form-fields';
import { SettingsItem, SettingsList, SettingsRowFrame } from '@/components/form/settings-list';
import { Block } from '@/components/skeleton-block';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { WorkspaceFooterPortal } from '@/components/workspace-tabs';
import { resendVerification, saveProfile } from '@/features/profile/api/api';
import { pendingEmailOptions, profileOptions } from '@/features/profile/api/queries';
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
import { useSessionMutation } from '@/hooks/use-session-mutation';

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
  const save = useSessionMutation({
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
      <WorkspaceFooterPortal>
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
      </WorkspaceFooterPortal>
      <form
        className="flex flex-col gap-4"
        id={FORM_ID}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (changed) void form.handleSubmit();
        }}
      >
        {save.isError && (
          <ErrorAlert
            description={serverMessage(save.error) ?? t('users.form.save-error')}
            title={t('profile.save-error-title')}
          />
        )}
        <PendingEmail userId={user.id} />
        <SettingsList>
          <SettingsItem label={t('users.username')}>{user.username}</SettingsItem>
          <SettingsItem label={t('users.form.job-title')}>{user.jobTitle || <None />}</SettingsItem>
          <SettingsItem label={t('users.form.home-facility')}>
            {user.homeFacilityId ? <FacilityName id={user.homeFacilityId} /> : <None />}
          </SettingsItem>
          <form.AppField name="firstName">
            {(field) => (
              <field.TextField
                autoComplete="given-name"
                label={t('users.form.first-name')}
                layout="row"
                required
              />
            )}
          </form.AppField>
          <form.AppField name="lastName">
            {(field) => (
              <field.TextField
                autoComplete="family-name"
                label={t('users.form.last-name')}
                layout="row"
                required
              />
            )}
          </form.AppField>
          <form.AppField name="email">
            {(field) => {
              const typed = field.state.value.trim();
              // The saved address shows whether it is verified; a new one, that it waits for its link.
              const isSaved = typed !== '' && typed === savedEmail;
              return (
                <field.TextField
                  autoComplete="email"
                  badge={isSaved && <EmailStatus verified={emailVerified} />}
                  description={typed && !isSaved && t('profile.email.change-hint')}
                  dir="ltr"
                  label={t('users.email')}
                  layout="row"
                  type="email"
                />
              );
            }}
          </form.AppField>
          <form.AppField name="phoneNumber">
            {(field) => (
              <field.TextField
                autoComplete="tel"
                dir="ltr"
                label={t('users.form.phone-number')}
                layout="row"
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
                    layout="row"
                  />
                )}
              </form.AppField>
            )}
          </form.Subscribe>
        </SettingsList>
      </form>
      <DiscardChangesDialog description={t('profile.discard-description')} {...guard.dialog} />
    </>
  );
}

/** The form while the profile loads: every row under its real label, with placeholders for the values. */
export function BasicInformationSkeleton() {
  const { t } = useTranslation();
  const inputs = [
    { label: t('users.form.first-name'), required: true },
    { label: t('users.form.last-name'), required: true },
    { label: t('users.email') },
    { label: t('users.form.phone-number') },
  ];

  return (
    <div aria-busy>
      <SettingsList>
        <SettingsItem label={t('users.username')}>
          <Block className="h-5 w-24 py-0.5" />
        </SettingsItem>
        <SettingsItem label={t('users.form.job-title')}>
          <Block className="h-5 w-32 py-0.5" />
        </SettingsItem>
        <SettingsItem label={t('users.form.home-facility')}>
          <Block className="h-5 w-48 py-0.5" />
        </SettingsItem>
        {inputs.map(({ label, required }) => (
          <SettingsRowFrame
            key={label}
            label={
              <span className="text-sm">
                <FieldLabelText label={label} required={required} />
              </span>
            }
            value="control"
          >
            <Block className="h-8 w-full" />
          </SettingsRowFrame>
        ))}
        <SettingsRowFrame
          description={<Block className="h-5 w-64 max-w-full py-0.5" />}
          label={<span className="text-sm">{t('users.form.allow-notify')}</span>}
        >
          <Block className="h-5 w-8" shape="circle" />
        </SettingsRowFrame>
      </SettingsList>
    </div>
  );
}

function None() {
  const { t } = useTranslation();
  return <span className="text-muted-foreground">{t('profile.summary.none')}</span>;
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
  return data.name ? `${data.code} - ${data.name}` : data.code;
}

/** A changed email waits for its link to be opened; until then the old one stays in use. */
function PendingEmail({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { data: email } = useQuery(pendingEmailOptions(userId));
  const resend = useSessionMutation({
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
