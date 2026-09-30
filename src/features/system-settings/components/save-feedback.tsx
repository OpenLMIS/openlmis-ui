import { Loader2Icon, RefreshCwIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ErrorAlert, serverMessage } from '@/components/dialog-parts';
import { useOfflineFailure } from '@/components/offline-notice';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { WorkspaceFooterPortal } from '@/components/workspace-tabs';

type SaveFeedbackProps = {
  conflict: boolean;
  error: unknown;
  reloadError: unknown;
  onReload: () => void;
};

export function SaveFeedback({ conflict, error, reloadError, onReload }: SaveFeedbackProps) {
  const { t } = useTranslation();
  const offline = useOfflineFailure(reloadError, onReload);

  if (conflict) {
    return (
      <Alert variant="warning">
        <RefreshCwIcon />
        <AlertTitle>{t('system-settings.conflict-title')}</AlertTitle>
        <AlertDescription>
          {offline
            ? t('offline.notice-description')
            : reloadError
              ? t('error.description')
              : t('system-settings.conflict-description')}
        </AlertDescription>
        <AlertAction>
          <Button onClick={onReload} size="sm" type="button" variant="outline">
            {t('system-settings.conflict-reload')}
          </Button>
        </AlertAction>
      </Alert>
    );
  }
  if (!error) return null;
  return (
    <ErrorAlert
      description={serverMessage(error) ?? t('system-settings.save-error-description')}
      title={t('system-settings.save-error-title')}
    />
  );
}

type SettingsSaveFooterProps = {
  canSave: boolean;
  pending: boolean;
  onCancel: () => void;
  form: string;
};

export function SettingsSaveFooter({ canSave, pending, onCancel, form }: SettingsSaveFooterProps) {
  const { t } = useTranslation();
  return (
    <WorkspaceFooterPortal>
      <Button disabled={pending || !canSave} onClick={onCancel} size="lg" variant="outline">
        {t('system-settings.cancel')}
      </Button>
      <Button disabled={pending || !canSave} form={form} size="lg" type="submit">
        {pending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
        {t('system-settings.save')}
      </Button>
    </WorkspaceFooterPortal>
  );
}
