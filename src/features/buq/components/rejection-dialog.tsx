import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { DialogLoadError } from '@/components/display/dialog-parts';
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
import { orEmpty } from '@/lib/empty-value';

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
  const error = rejection.error ?? reasons.error;
  const title = t('buq.forecast.rejection-title');
  const loading = rejection.isPending || reasons.isPending;

  return (
    <FormDialog onOpenChange={(next) => !next && onClose()} open={open}>
      {error ? (
        <DialogLoadError
          error={error}
          errorTitle={t('buq.forecast.rejection-error')}
          onRetry={() => {
            void rejection.refetch();
            void reasons.refetch();
          }}
          title={title}
        />
      ) : (
        <>
          <FormDialogHeader>
            <FormDialogTitle>{title}</FormDialogTitle>
          </FormDialogHeader>
          <FormDialogBody>
            <SettingsList>
              <SettingsItem label={t('buq.forecast.rejection-reasons')}>
                {loading ? <ValueSkeleton /> : orEmpty(names.join(', '))}
              </SettingsItem>
              <SettingsItem label={t('buq.forecast.rejection-comments')}>
                {loading ? (
                  <ValueSkeleton />
                ) : (
                  <span className="whitespace-pre-line" dir="auto">
                    {orEmpty(rejection.data?.generalComments)}
                  </span>
                )}
              </SettingsItem>
            </SettingsList>
          </FormDialogBody>
          <FormDialogFooter>
            <FormDialogCancel>{t('dialog.close')}</FormDialogCancel>
          </FormDialogFooter>
        </>
      )}
    </FormDialog>
  );
}

function ValueSkeleton() {
  return (
    <span aria-hidden className="inline-block h-5 w-32">
      <Skeleton fill />
    </span>
  );
}
