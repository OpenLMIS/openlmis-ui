import { revalidateLogic, useStore } from '@tanstack/react-form';
import { isAxiosError } from 'axios';
import { DownloadIcon, Loader2Icon, UploadIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ErrorAlert, FieldSkeleton, serverMessage } from '@/components/dialog-parts';
import { DiscardChangesDialog } from '@/components/discard-changes-dialog';
import {
  FileTransferExport,
  FileTransferInstructions,
  FileTransferPanel,
  FileTransferUpload,
} from '@/components/file-transfer-panel';
import { useAppForm } from '@/components/form/form';
import { Button } from '@/components/ui/button';
import {
  exportIdealStockAmounts,
  uploadIdealStockAmounts,
} from '@/features/ideal-stock-amounts/api/api';
import { idealStockAmountsUploadSchema } from '@/features/ideal-stock-amounts/lib/types';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { downloadFile } from '@/lib/download-file';

const EMPTY_FILE_KEY = 'referenceData.error.upload.file.empty';

function transferErrorMessage(
  error: unknown,
  fallback: string,
  emptyFile: string,
  tooLarge: string,
) {
  if (!isAxiosError(error)) return fallback;
  const status = error.response?.status;
  if (status === 413) return tooLarge;
  if (!status || status < 400 || status >= 500) return fallback;
  const body: unknown = error.response?.data;
  if (!body || typeof body !== 'object') return fallback;
  const rawKey = 'messageKey' in body ? body.messageKey : undefined;
  const key = typeof rawKey === 'string' ? rawKey.trim() : undefined;
  const message = serverMessage(error)?.trim();
  if (key && message && message !== key) return message;
  if (key === EMPTY_FILE_KEY || message === EMPTY_FILE_KEY) return emptyFile;
  return fallback;
}

export function IdealStockAmountsUpload() {
  const { t } = useTranslation();
  const errorId = useId();
  const [attempt, setAttempt] = useState(0);
  const errorMessage = (error: unknown, fallback: string) =>
    transferErrorMessage(
      error,
      fallback,
      t('ideal-stock-amounts.file-empty'),
      t('ideal-stock-amounts.file-too-large'),
    );
  const upload = useSessionMutation({
    mutationFn: uploadIdealStockAmounts,
    retry: false,
    networkMode: 'always',
    onSuccess: ({ amount }) => {
      form.reset();
      toast.success(t('ideal-stock-amounts.uploaded-title'), {
        description: t('ideal-stock-amounts.uploaded', { amount }),
      });
    },
  });
  const exporting = useSessionMutation({
    mutationFn: exportIdealStockAmounts,
    onSuccess: (blob) => downloadFile(blob, 'ideal_stock_amounts.csv'),
    onError: (error) => {
      toast.error(t('ideal-stock-amounts.export-error-title'), {
        description: errorMessage(error, t('ideal-stock-amounts.export-error')),
      });
    },
  });
  const form = useAppForm({
    defaultValues: { file: undefined as File | undefined },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: idealStockAmountsUploadSchema },
    onSubmit: ({ value }) => {
      if (!value.file || upload.isPending) return;
      return upload.mutateAsync(value.file).catch(() => undefined);
    },
  });
  const selected = useStore(form.store, (state) => Boolean(state.values.file));
  const submitting = useStore(form.store, (state) => state.isSubmitting);
  const pending = submitting || upload.isPending;
  const guard = useDiscardGuard(selected, { pending });

  return (
    <>
      <FileTransferPanel>
        <FileTransferExport>
          <span>{t('ideal-stock-amounts.export-label')}</span>
          <Button
            disabled={exporting.isPending}
            focusableWhenDisabled={exporting.isPending}
            onClick={() => {
              if (!exporting.isPending) exporting.mutate();
            }}
            type="button"
            variant="outline"
          >
            {exporting.isPending ? (
              <Loader2Icon className="animate-spin" data-icon="inline-start" />
            ) : (
              <DownloadIcon data-icon="inline-start" />
            )}
            {t('ideal-stock-amounts.export')}
          </Button>
        </FileTransferExport>
        <FileTransferInstructions>{t('ideal-stock-amounts.instructions')}</FileTransferInstructions>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!selected || form.state.isSubmitting || upload.isPending) return;
            upload.reset();
            setAttempt((previous) => previous + 1);
            void form.handleSubmit();
          }}
        >
          <FileTransferUpload>
            <form.AppField listeners={{ onChange: () => upload.reset() }} name="file">
              {(field) => (
                <field.FileField
                  accept=".csv"
                  chooseLabel={t('ideal-stock-amounts.choose-file')}
                  describedBy={upload.isError ? errorId : undefined}
                  disabled={pending}
                  emptyLabel={t('ideal-stock-amounts.no-file')}
                  label={t('ideal-stock-amounts.file')}
                  removeLabel={t('ideal-stock-amounts.remove-file')}
                  required
                />
              )}
            </form.AppField>
            {upload.isError && (
              <div id={errorId} key={attempt}>
                <ErrorAlert
                  description={errorMessage(upload.error, t('ideal-stock-amounts.upload-error'))}
                  title={t('ideal-stock-amounts.upload-error-title')}
                />
              </div>
            )}
            <div className="flex justify-end">
              <Button
                disabled={!selected || pending}
                focusableWhenDisabled={pending || upload.isSuccess}
                type="submit"
              >
                {pending ? (
                  <Loader2Icon className="animate-spin" data-icon="inline-start" />
                ) : (
                  <UploadIcon data-icon="inline-start" />
                )}
                {t('ideal-stock-amounts.upload')}
              </Button>
            </div>
          </FileTransferUpload>
        </form>
      </FileTransferPanel>
      <DiscardChangesDialog
        description={t('ideal-stock-amounts.discard-description')}
        {...guard.dialog}
      />
    </>
  );
}

export function IdealStockAmountsUploadSkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-busy>
      <FileTransferPanel>
        <FileTransferExport>
          <span>{t('ideal-stock-amounts.export-label')}</span>
          <Button disabled variant="outline">
            <DownloadIcon data-icon="inline-start" />
            {t('ideal-stock-amounts.export')}
          </Button>
        </FileTransferExport>
        <FileTransferInstructions>{t('ideal-stock-amounts.instructions')}</FileTransferInstructions>
        <FileTransferUpload>
          <FieldSkeleton label={t('ideal-stock-amounts.file')} required />
          <div className="flex justify-end">
            <Button disabled>
              <UploadIcon data-icon="inline-start" />
              {t('ideal-stock-amounts.upload')}
            </Button>
          </div>
        </FileTransferUpload>
      </FileTransferPanel>
    </div>
  );
}
