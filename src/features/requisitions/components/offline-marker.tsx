import { use } from 'react';
import { useTranslation } from 'react-i18next';
import { FlagBadge } from '@/components/shared/flag-badge';
import { Spinner } from '@/components/ui/spinner';
import { RequisitionCopiesContext } from '@/features/requisitions/hooks/use-offline-copies';

export function OfflineMarker({ id }: { id: string }) {
  const copies = use(RequisitionCopiesContext);
  const { t } = useTranslation();
  return copies ? (
    <FlagBadge
      value={copies.some((copy) => copy.id === id)}
      trueLabel={t('requisitions.yes')}
      falseLabel={t('requisitions.no')}
    />
  ) : (
    <Spinner />
  );
}
