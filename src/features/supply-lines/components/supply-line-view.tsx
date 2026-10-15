import { useSuspenseQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { DialogLoadError, DialogNotFound, ErrorAlert } from '@/components/dialog-parts';
import { SettingsItem, SettingsList } from '@/components/form/settings-list';
import {
  FormDialog,
  FormDialogBody,
  FormDialogCancel,
  FormDialogDescription,
  FormDialogFooter,
  FormDialogHeader,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import { useDialogTarget } from '@/components/form-dialog/use-dialog-target';
import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { supplyLineOptions } from '@/features/supply-lines/api/queries';
import type { SupplyLine } from '@/features/supply-lines/lib/types';
import { orEmpty } from '@/lib/empty-value';
import { isNotFound, isRefused } from '@/lib/http';

export function SupplyLineViewDialog({
  target,
  onClose,
}: {
  target: string | undefined;
  onClose: () => void;
}) {
  const { shown, dialogProps } = useDialogTarget(target, onClose);
  return (
    <FormDialog {...dialogProps()}>
      {shown !== undefined && <SupplyLineDialogContent target={shown} />}
    </FormDialog>
  );
}

function SupplyLineDialogContent({ target }: { target: string }) {
  const { t } = useTranslation();
  const title = t('supply-lines.view.title');
  const notFound = (
    <DialogNotFound title={title} description={t('supply-lines.view.not-found-description')} />
  );
  if (!z.guid().safeParse(target).success) return notFound;
  return (
    <QueryBoundary
      resetKey={target}
      pendingFallback={<SupplyLineView />}
      errorComponent={({ error, reset }) =>
        isNotFound(error) ? (
          notFound
        ) : isRefused(error) ? (
          <>
            <FormDialogHeader>
              <FormDialogTitle>{title}</FormDialogTitle>
            </FormDialogHeader>
            <ErrorAlert title={t('no-access.title')} description={t('no-access.description')} />
            <FormDialogFooter>
              <FormDialogCancel>{t('supply-lines.view.cancel')}</FormDialogCancel>
            </FormDialogFooter>
          </>
        ) : (
          <DialogLoadError
            title={title}
            error={error}
            errorTitle={t('supply-lines.view.error-title')}
            onRetry={reset}
          />
        )
      }
    >
      <LoadedSupplyLine id={target} />
    </QueryBoundary>
  );
}

function LoadedSupplyLine({ id }: { id: string }) {
  const { data } = useSuspenseQuery(supplyLineOptions(id));
  return <SupplyLineView line={data} />;
}

function SupplyLineView({ line }: { line?: SupplyLine }) {
  const { t } = useTranslation();
  const values = [
    { label: t('supply-lines.program'), value: line?.program?.name, dir: 'auto' },
    { label: t('supply-lines.supervisory-node'), value: line?.supervisoryNode?.code, dir: 'ltr' },
    {
      label: t('supply-lines.supplying-facility'),
      value: line?.supplyingFacility?.name,
      dir: 'auto',
    },
    { label: t('supply-lines.view.description'), value: line?.description, dir: 'auto' },
  ];
  return (
    <>
      <FormDialogHeader>
        <FormDialogTitle>{t('supply-lines.view.title')}</FormDialogTitle>
        <FormDialogDescription>{t('supply-lines.view.page-description')}</FormDialogDescription>
      </FormDialogHeader>
      <FormDialogBody>
        <div aria-busy={!line}>
          <SettingsList>
            {values.map(({ label, value, dir }) => (
              <SettingsItem key={label} label={label}>
                {line ? (
                  <span className="whitespace-pre-wrap" dir={dir}>
                    {orEmpty(value)}
                  </span>
                ) : (
                  <span className="block h-5 w-32 max-w-full">
                    <Skeleton fill />
                  </span>
                )}
              </SettingsItem>
            ))}
          </SettingsList>
        </div>
      </FormDialogBody>
      <FormDialogFooter>
        <FormDialogCancel>{t('supply-lines.view.cancel')}</FormDialogCancel>
      </FormDialogFooter>
    </>
  );
}
