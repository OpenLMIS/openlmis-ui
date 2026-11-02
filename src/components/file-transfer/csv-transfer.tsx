import { revalidateLogic, useStore } from '@tanstack/react-form';
import { DownloadIcon, Loader2Icon, PaperclipIcon, UploadIcon } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ErrorAlert } from '@/components/display/dialog-parts';
import { DiscardChangesDialog } from '@/components/display/discard-changes-dialog';
import { transferErrorMessage } from '@/components/file-transfer/transfer-error';
import type { CsvTransferApi, CsvTransferCopy } from '@/components/file-transfer/types';
import { useAppForm } from '@/components/form/form';
import { FieldLabelText } from '@/components/form/form-fields';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';
import { useDiscardGuard } from '@/hooks/use-discard-guard';
import { useSessionMutation } from '@/hooks/use-session-mutation';
import { csvFileSchema } from '@/lib/csv-upload';
import { downloadFile } from '@/lib/download-file';

type CsvTransferProps = {
  api: CsvTransferApi;
  copy: CsvTransferCopy;
  /** Translated explanation shown above the server's message. */
  describeUploadError?: (error: unknown) => string | undefined;
};

export function CsvTransfer({ api, copy, describeUploadError }: CsvTransferProps) {
  const { t, i18n } = useTranslation();
  const errorId = useId();
  const errorMessage = (error: unknown, fallback: string) =>
    transferErrorMessage(error, {
      fallback,
      emptyFile: t('file-transfer.file-empty'),
      tooLarge: t('file-transfer.file-too-large'),
      emptyFileKeys: api.emptyFileKeys,
    });
  const upload = useSessionMutation({
    mutationFn: api.uploadCsv,
    retry: false,
    networkMode: 'always',
    onSuccess: ({ amount }) => {
      form.reset();
      toast.success(t('file-transfer.uploaded-title'), {
        description: t('file-transfer.uploaded', { amount }),
      });
    },
  });
  const exporting = useSessionMutation({
    mutationFn: api.exportCsv,
    onSuccess: (blob) => downloadFile(blob, api.exportFilename),
    onError: (error) => {
      toast.error(t('file-transfer.export-error-title'), {
        description: errorMessage(error, t('file-transfer.export-error')),
      });
    },
  });
  const form = useAppForm({
    defaultValues: { file: undefined as File | undefined },
    validationLogic: revalidateLogic({ mode: 'submit', modeAfterSubmission: 'change' }),
    validators: { onDynamic: csvFileSchema },
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
      <Card>
        <ExportSection>
          <TransferHeading hint={t('file-transfer.export-hint')} label={copy.exportLabel} />
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
              {t('file-transfer.export')}
            </Button>
          </div>
        </ExportSection>
        <Separator />
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!selected || form.state.isSubmitting || upload.isPending) return;
            upload.reset();
            void form.handleSubmit();
          }}
        >
          <UploadSection>
            <div className="grid min-w-0 gap-5 @2xl/main:grid-cols-2">
              <TransferHeading hint={t('file-transfer.upload-hint')} label={copy.uploadLabel} />
              <div className="ms-auto w-full min-w-0 max-w-xs">
                <FieldGroup>
                  <form.AppField listeners={{ onChange: () => upload.reset() }} name="file">
                    {(field) => (
                      <field.FileField
                        accept=".csv"
                        describedBy={upload.isError ? errorId : undefined}
                        disabled={pending}
                        emptyLabel={t('file-transfer.no-file')}
                        fileSize={
                          field.state.value
                            ? formatFileSize(field.state.value.size, i18n.language)
                            : undefined
                        }
                        label={t('file-transfer.file')}
                        removeLabel={t('file-transfer.remove-file')}
                        required
                      />
                    )}
                  </form.AppField>
                  {upload.isError && (
                    <div id={errorId}>
                      <ErrorAlert
                        description={
                          <UploadErrorText
                            explanation={describeUploadError?.(upload.error)}
                            message={errorMessage(upload.error, copy.uploadError)}
                          />
                        }
                        title={t('file-transfer.upload-error-title')}
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
                      {t('file-transfer.upload')}
                    </Button>
                  </div>
                </FieldGroup>
              </div>
            </div>
          </UploadSection>
        </form>
      </Card>
      <DiscardChangesDialog
        description={t('file-transfer.discard-description')}
        {...guard.dialog}
      />
    </>
  );
}

export function CsvTransferSkeleton({
  copy,
}: {
  copy: Pick<CsvTransferCopy, 'exportLabel' | 'uploadLabel'>;
}) {
  const { t } = useTranslation();
  return (
    <Card aria-busy>
      <ExportSection>
        <TransferHeading hint={t('file-transfer.export-hint')} label={copy.exportLabel} />
        <div className="ms-auto">
          <Button disabled variant="outline">
            <DownloadIcon data-icon="inline-start" />
            {t('file-transfer.export')}
          </Button>
        </div>
      </ExportSection>
      <Separator />
      <UploadSection>
        <div className="grid min-w-0 gap-5 @2xl/main:grid-cols-2">
          <TransferHeading hint={t('file-transfer.upload-hint')} label={copy.uploadLabel} />
          <div className="ms-auto w-full min-w-0 max-w-xs">
            <FieldGroup>
              <Field spacing="tight">
                <FieldLabel>
                  <FieldLabelText label={t('file-transfer.file')} required />
                </FieldLabel>
                <Button align="start" disabled variant="outline" width="full">
                  <PaperclipIcon data-icon="inline-start" />
                  <span className="min-w-0 flex-1 truncate">{t('file-transfer.no-file')}</span>
                </Button>
              </Field>
              <div className="flex justify-end">
                <Button disabled>
                  <UploadIcon data-icon="inline-start" />
                  {t('file-transfer.upload')}
                </Button>
              </div>
            </FieldGroup>
          </div>
        </div>
      </UploadSection>
    </Card>
  );
}

function UploadErrorText({ explanation, message }: { explanation?: string; message: string }) {
  const { t } = useTranslation();
  // The server's English text keeps its own direction on RTL pages.
  if (!explanation) return <span dir="auto">{message}</span>;
  return (
    <span className="flex flex-col gap-1">
      <span>{explanation}</span>
      <span className="text-muted-foreground text-xs">
        {t('file-transfer.server-detail', { message })}
      </span>
    </span>
  );
}

function ExportSection({ children }: { children: ReactNode }) {
  return (
    <CardContent>
      <div className="flex flex-wrap items-center justify-between gap-3">{children}</div>
    </CardContent>
  );
}

function UploadSection({ children }: { children: ReactNode }) {
  return (
    <CardContent>
      <FieldGroup>{children}</FieldGroup>
    </CardContent>
  );
}

function TransferHeading({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <h2 className="font-medium">{label}</h2>
      <p className="text-muted-foreground text-sm">{hint}</p>
    </div>
  );
}

function formatFileSize(bytes: number, language: string) {
  const [divisor, unit]: [number, 'megabyte' | 'kilobyte' | 'byte'] =
    bytes >= 1_000_000
      ? [1_000_000, 'megabyte']
      : bytes >= 1_000
        ? [1_000, 'kilobyte']
        : [1, 'byte'];
  return new Intl.NumberFormat(language, {
    style: 'unit',
    unit,
    unitDisplay: unit === 'byte' ? 'long' : 'short',
    maximumFractionDigits: 1,
  }).format(bytes / divisor);
}
