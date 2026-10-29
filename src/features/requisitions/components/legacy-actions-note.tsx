import { InfoIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useBackToLegacy } from '@/hooks/use-back-to-legacy';

export function LegacyActionsNote({ requisitionId }: { requisitionId: string }) {
  const { t } = useTranslation();
  const legacy = useBackToLegacy(`#!/requisition/${encodeURIComponent(requisitionId)}/fullSupply`);
  if (!legacy.available) return null;
  return (
    <Alert variant="info">
      <InfoIcon />
      <AlertTitle>{t('requisitions.requisition.legacy-title')}</AlertTitle>
      <AlertDescription>{t('requisitions.requisition.legacy-description')}</AlertDescription>
      <AlertAction>
        <Button variant="info" onClick={legacy.onClick}>
          {legacy.label}
        </Button>
      </AlertAction>
    </Alert>
  );
}
