import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { SettingsItem, SettingsList } from '@/components/form/settings-list';
import {
  FormDialog,
  FormDialogBody,
  FormDialogCancel,
  FormDialogFooter,
  FormDialogHeader,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { buqRejectionOptions } from '@/features/buq/api/queries';
import { rejectionReasonsOptions } from '@/features/reference-data/api/queries';

export function RejectionDialog({
  forecastId,
  open,
  onClose,
}: {
  forecastId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const rejection = useQuery({ ...buqRejectionOptions(forecastId), enabled: open });
  const reasons = useQuery({ ...rejectionReasonsOptions(), enabled: open });
  const chosen = new Set(rejection.data?.rejectionReasons);
  const names = (reasons.data ?? [])
    .filter(
      ({ id, rejectionReasonCategory }) => chosen.has(id) && rejectionReasonCategory.name === 'BUQ',
    )
    .map(({ name }) => name);
  const loading = rejection.isPending || reasons.isPending;

  return (
    <FormDialog onOpenChange={(next) => !next && onClose()} open={open}>
      <FormDialogHeader>
        <FormDialogTitle>{t('buq.forecast.rejection-title')}</FormDialogTitle>
      </FormDialogHeader>
      <FormDialogBody>
        {rejection.isError || reasons.isError ? (
          <p className="text-muted-foreground text-sm">{t('buq.forecast.rejection-error')}</p>
        ) : loading ? (
          <div className="h-24">
            <Skeleton fill />
          </div>
        ) : (
          <SettingsList>
            <SettingsItem label={t('buq.forecast.rejection-reasons')}>
              {names.join(', ')}
            </SettingsItem>
            <SettingsItem label={t('buq.forecast.rejection-comments')}>
              <span className="whitespace-pre-line" dir="auto">
                {rejection.data?.generalComments ?? ''}
              </span>
            </SettingsItem>
          </SettingsList>
        )}
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('dialog.close')}</FormDialogCancel>
      </FormDialogFooter>
    </FormDialog>
  );
}
