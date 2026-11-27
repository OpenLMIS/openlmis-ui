import { isAxiosError } from 'axios';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import {
  DeleteRecordDialog,
  type DeleteRecordDialogProps,
} from '@/components/display/delete-record-dialog';
import { deleteCatalogRecord } from '@/features/buq-admin/api/api';
import { buqCatalogDetailOptions, refreshBuqCatalog } from '@/features/buq-admin/api/queries';
import {
  BUQ_CATALOG_NOT_FOUND,
  BUQ_CATALOGS,
  type BuqCatalogTab,
} from '@/features/buq-admin/lib/types';
import type { BuqCatalogRecord } from '@/features/reference-data/lib/types';

const getCopy = (t: TFunction, tab: BuqCatalogTab) => {
  const kind = BUQ_CATALOGS[tab].kind;
  return {
    deleted: t(`manage-buq.toast.deleted-${kind}`),
    deletedDescription: (name: string) =>
      t(`manage-buq.toast.deleted-${kind}-description`, { name }),
    errorTitle: t('manage-buq.delete.error-title'),
    noAccessTitle: t('manage-buq.form.no-access-title'),
    noAccess: t('manage-buq.form.no-access'),
    loadErrorTitle: t('manage-buq.load-error-title'),
    title: t(`manage-buq.delete.title-${kind}`),
    missingTitle: t('manage-buq.not-found-title'),
    pendingTitle: t(`manage-buq.delete.pending-title-${kind}`),
    description: (name: string) => t(`manage-buq.delete.description-${kind}`, { name }),
    warning: t('manage-buq.delete.warning'),
    missingDescription: t(BUQ_CATALOG_NOT_FOUND[tab]),
    action: t('manage-buq.delete'),
  };
};

const isMissingRemarkFailure = (error: unknown) =>
  isAxiosError(error) && error.response?.status === 500;

export function DeleteCatalogDialog({
  tab,
  ...props
}: DeleteRecordDialogProps<BuqCatalogRecord> & { tab: BuqCatalogTab }) {
  const { t } = useTranslation();
  return (
    <DeleteRecordDialog
      {...props}
      blocked={(record) =>
        record.editable === false
          ? {
              title: t('manage-buq.read-only-title'),
              description: t('manage-buq.read-only-description'),
            }
          : undefined
      }
      detailOptions={(id, opening) => buqCatalogDetailOptions(tab, id, opening)}
      getCopy={(translate) => getCopy(translate, tab)}
      refresh={(client, isCurrent) => refreshBuqCatalog(client, tab, isCurrent)}
      refreshOnError={tab === 'remarks' ? isMissingRemarkFailure : undefined}
      removeRecord={(id) => deleteCatalogRecord(tab, id)}
    />
  );
}
