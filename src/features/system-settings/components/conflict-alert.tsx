import { RefreshCwIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export function ConflictAlert({ onReload }: { onReload: () => void }) {
  const { t } = useTranslation();
  return (
    <Alert variant="warning">
      <RefreshCwIcon />
      <AlertTitle>{t('system-settings.conflict-title')}</AlertTitle>
      <AlertDescription>{t('system-settings.conflict-description')}</AlertDescription>
      <AlertAction>
        <Button onClick={onReload} size="sm" type="button" variant="outline">
          {t('system-settings.conflict-reload')}
        </Button>
      </AlertAction>
    </Alert>
  );
}
