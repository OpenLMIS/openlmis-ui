import { revalidateLogic, useStore } from '@tanstack/react-form';
import { isAxiosError } from 'axios';
import { DownloadIcon, Loader2Icon, PaperclipIcon, UploadIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  FileTransferExport,
  FileTransferPanel,
  FileTransferUpload,
} from '@/components/app-shell/file-transfer-panel';
import { ErrorAlert, serverMessage } from '@/components/display/dialog-parts';
import { DiscardChangesDialog } from '@/components/display/discard-changes-dialog';
import { useAppForm } from '@/components/form/form';
import { FieldLabelText } from '@/components/form/form-fields';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';
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
  const { t, i18n } = useTranslation();
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
      <div className="flex flex-col gap-4">
        <FileTransferPanel>
          <FileTransferExport>
            <CurrentValuesHeading />
            <div className="ms-auto">
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
            </div>
          </FileTransferExport>
          <Separator />
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
              <div className="grid min-w-0 gap-5 @2xl/main:grid-cols-2">
                <UploadValuesHeading />
                <div className="ms-auto w-full min-w-0 max-w-xs">
                  <FieldGroup>
                    <form.AppField listeners={{ onChange: () => upload.reset() }} name="file">
                      {(field) => (
                        <field.FileField
                          accept=".csv"
                          describedBy={upload.isError ? errorId : undefined}
                          disabled={pending}
                          emptyLabel={t('ideal-stock-amounts.no-file')}
                          fileSize={
                            field.state.value
                              ? formatFileSize(field.state.value.size, i18n.language)
                              : undefined
                          }
                          label={t('ideal-stock-amounts.file')}
                          removeLabel={t('ideal-stock-amounts.remove-file')}
                          required
                        />
                      )}
                    </form.AppField>
                    {upload.isError && (
                      <div id={errorId} key={attempt}>
                        <ErrorAlert
                          description={errorMessage(
                            upload.error,
                            t('ideal-stock-amounts.upload-error'),
                          )}
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
                  </FieldGroup>
                </div>
              </div>
            </FileTransferUpload>
          </form>
        </FileTransferPanel>
      </div>
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
    <div aria-busy className="flex flex-col gap-4">
      <FileTransferPanel>
        <FileTransferExport>
          <CurrentValuesHeading />
          <div className="ms-auto">
            <Button disabled variant="outline">
              <DownloadIcon data-icon="inline-start" />
              {t('ideal-stock-amounts.export')}
            </Button>
          </div>
        </FileTransferExport>
        <Separator />
        <FileTransferUpload>
          <div className="grid min-w-0 gap-5 @2xl/main:grid-cols-2">
            <UploadValuesHeading />
            <div className="ms-auto w-full min-w-0 max-w-xs">
              <FieldGroup>
                <Field spacing="tight">
                  <FieldLabel>
                    <FieldLabelText label={t('ideal-stock-amounts.file')} required />
                  </FieldLabel>
                  <Button align="start" disabled variant="outline" width="full">
                    <PaperclipIcon data-icon="inline-start" />
                    <span className="min-w-0 flex-1 truncate">
                      {t('ideal-stock-amounts.no-file')}
                    </span>
                  </Button>
                </Field>
                <div className="flex justify-end">
                  <Button disabled>
                    <UploadIcon data-icon="inline-start" />
                    {t('ideal-stock-amounts.upload')}
                  </Button>
                </div>
              </FieldGroup>
            </div>
          </div>
        </FileTransferUpload>
      </FileTransferPanel>
    </div>
  );
}

function CurrentValuesHeading() {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <h2 className="font-medium">{t('ideal-stock-amounts.export-label')}</h2>
      <p className="text-muted-foreground text-sm">{t('ideal-stock-amounts.export-hint')}</p>
    </div>
  );
}

function UploadValuesHeading() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1">
      <h2 className="font-medium">{t('ideal-stock-amounts.upload-label')}</h2>
      <p className="text-muted-foreground text-sm">{t('ideal-stock-amounts.upload-hint')}</p>
    </div>
  );
}

function formatFileSize(bytes: number, language: string) {
  const divisor = bytes >= 1_000_000 ? 1_000_000 : bytes >= 1_000 ? 1_000 : 1;
  const unit = divisor === 1_000_000 ? 'megabyte' : divisor === 1_000 ? 'kilobyte' : 'byte';
  return new Intl.NumberFormat(language, {
    style: 'unit',
    unit,
    unitDisplay: unit === 'byte' ? 'long' : 'short',
    maximumFractionDigits: 1,
  }).format(bytes / divisor);
}
