import { CanceledError } from 'axios';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { usePageHidden } from '@/components/shared/page-visibility';
import { generateReport } from '@/features/reports/api/api';
import {
  classifyReportOutput,
  OUTPUT_HEAD_BYTES,
  type ReportOutput,
  reportFileName,
} from '@/features/reports/lib/report-output';
import type { ReportFormat } from '@/features/reports/lib/types';
import { usePrintReport } from '@/hooks/use-print-report';
import { downloadFile } from '@/lib/download-file';
import { openReport, type ReportDelivery } from '@/lib/open-report';
import { useSessionScope } from '@/lib/session-scope';

export class UnexpectedReportFileError extends Error {
  constructor() {
    super('The server returned a file that is not the requested report.');
    this.name = 'UnexpectedReportFileError';
  }
}

/** Settles as soon as `signal` aborts, even while `work` is stuck, e.g. waiting for a new session. */
export function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new CanceledError());
    if (signal.aborted) abort();
    signal.addEventListener('abort', abort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

async function readHead(blob: Blob) {
  return new Uint8Array(await blob.slice(0, OUTPUT_HEAD_BYTES).arrayBuffer());
}

type PreparedReport = { blob: Blob; filename: string; output: ReportOutput };

type ReportRequest = {
  module: string;
  reportId: string;
  reportName: string;
  format: ReportFormat;
  params: Record<string, string>;
  signal: AbortSignal;
};

/** Fetches the report and checks its bytes, so only a real PDF opens and every file is named truthfully. */
export async function prepareReport({
  module,
  reportId,
  reportName,
  format,
  params,
  signal,
}: ReportRequest): Promise<PreparedReport> {
  const file = await generateReport(module, reportId, format, params, signal);
  if (signal.aborted) throw new CanceledError();
  const head = await readHead(file.blob);
  if (signal.aborted) throw new CanceledError();
  const output = classifyReportOutput(format, head);
  if (!output) throw new UnexpectedReportFileError();
  return {
    blob: new Blob([file.blob], { type: output.type }),
    filename: reportFileName(file.filename, reportName, output.extension),
    output,
  };
}

type Opening = {
  controller: AbortController;
  format: ReportFormat;
  params: (language: string) => Record<string, string>;
  prepared?: PreparedReport;
  delivery?: ReportDelivery;
};

type GenerationOptions = { userId: string; module: string; reportId: string; reportName: string };

/** One report generation at a time, ended by Cancel, leaving the page, hiding it or a change of user. */
export function useReportGeneration({ userId, module, reportId, reportName }: GenerationOptions) {
  const { t } = useTranslation();
  const active = useRef<Opening | null>(null);
  const pageHidden = usePageHidden();
  const scope = useSessionScope();

  const stop = useCallback(() => {
    const opening = active.current;
    if (!opening) return;
    active.current = null;
    opening.prepared = undefined;
    opening.controller.abort();
    opening.delivery?.close();
  }, []);

  useEffect(() => {
    if (pageHidden) stop();
  }, [pageHidden, stop]);
  const openedScope = useRef(scope);
  useEffect(() => {
    if (openedScope.current === scope) return;
    openedScope.current = scope;
    stop();
  }, [scope, stop]);
  useEffect(() => stop, [stop]);

  const print = usePrintReport({
    serverAuthorized: true,
    userId,
    request: (language) => {
      const opening = active.current;
      if (!opening) return Promise.reject(new CanceledError());
      const { signal } = opening.controller;
      return abortable(
        prepareReport({
          module,
          reportId,
          reportName,
          format: opening.format,
          params: opening.params(language),
          signal,
        }).then((prepared) => {
          if (signal.aborted || active.current !== opening) throw new CanceledError();
          opening.prepared = prepared;
          return prepared.blob;
        }),
        signal,
      );
    },
    onReport: () => {
      const opening = active.current;
      if (!opening) return { deliver: () => {}, close: () => {} };
      const tab =
        opening.format === 'pdf'
          ? openReport(reportFileName(undefined, reportName, 'pdf'), t('reports.generate.opening'))
          : null;
      const finish = () => {
        opening.prepared = undefined;
        if (active.current === opening) active.current = null;
      };
      opening.delivery = {
        deliver: () => {
          const prepared = opening.prepared;
          if (!prepared || opening.controller.signal.aborted || active.current !== opening)
            throw new CanceledError();
          if (prepared.output.open && tab) tab.deliver(prepared.blob);
          else {
            tab?.close();
            downloadFile(prepared.blob, prepared.filename);
          }
          finish();
          if (prepared.output.substitutedFor)
            toast.warning(t('reports.generate.substituted-title'), {
              description: t('reports.generate.substituted-description', {
                format: prepared.output.substitutedFor.toUpperCase(),
              }),
            });
        },
        close: () => {
          tab?.close();
          opening.controller.abort();
          finish();
        },
      };
      return opening.delivery;
    },
    successTitle: t('reports.generate.success-title'),
    successDescription: t('reports.generate.success-description', { name: reportName }),
    errorTitle: t('reports.generate.error-title'),
    errorDescription: t('reports.generate.error-description'),
    refusedDescription: t('reports.generate.refused'),
    describeError: (error) =>
      error instanceof UnexpectedReportFileError
        ? t('reports.generate.unexpected-file')
        : undefined,
  });

  const generate = (format: ReportFormat, params: Opening['params']) => {
    if (print.isPending || active.current) return;
    const opening: Opening = { controller: new AbortController(), format, params };
    active.current = opening;
    print.print();
    if (!opening.delivery && active.current === opening) active.current = null;
  };

  return {
    generate,
    cancel: stop,
    isPending: print.isPending,
    offline: print.offline,
    disabledReason: print.disabledReason,
  };
}
