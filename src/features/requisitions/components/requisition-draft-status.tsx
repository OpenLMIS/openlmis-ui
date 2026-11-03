import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { DraftStatus } from '@/components/display/draft-status';
import { RemovedCopyDialog } from '@/features/requisitions/components/removed-copy-dialog';
import type { RequisitionEditor } from '@/features/requisitions/hooks/use-requisition-form';
import { RequisitionCopyRemovedError } from '@/features/requisitions/lib/offline-copies';

export function RequisitionDraftStatus({ editor }: { editor: RequisitionEditor }) {
  const { t } = useTranslation();
  const { device } = editor;
  const status = useSyncExternalStore(device.subscribeStatus, device.getStatus);
  if (status.error instanceof RequisitionCopyRemovedError) return <RemovedCopyDialog />;
  return (
    <DraftStatus
      {...status}
      labels={{
        copy: null,
        conflictDescription: t('requisitions.edit.draft-conflict-description'),
      }}
      onRetry={device.retry}
      onResolve={editor.resolveConflict}
    />
  );
}
