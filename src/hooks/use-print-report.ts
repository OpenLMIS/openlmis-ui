import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { permissionsOptions } from '@/features/auth/api/queries';
import { ForbiddenError } from '@/features/auth/lib/access';
import { SessionEndedError } from '@/features/auth/lib/session';
import { useLoginData } from '@/features/auth/store/login-data';
import { apiErrorText, isSilentApiError } from '@/lib/api-error';
import { type DeviceSnapshot, LocalDataUnavailableError } from '@/lib/local-data';
import { isOnline, useOnline } from '@/lib/online';
import type { ReportDelivery } from '@/lib/open-report';
import { hasProgramGrant } from '@/lib/permissions';
import { reportApiError } from '@/lib/report-error';

type PrintAccess =
  | { serverAuthorized: true; facilityId?: string; programId?: string; right?: string }
  | { serverAuthorized?: false; facilityId: string; programId: string; right: string };
type PrintReportOptions = PrintAccess & {
  device?: DeviceSnapshot;
  userId: string;
  beforeRequest?: () => Promise<boolean>;
  request: (language: string) => Promise<Blob>;
  onReport: () => ReportDelivery;
  successTitle: string;
  successDescription: string;
  errorTitle: string;
  errorDescription: string;
  refusedDescription: string;
  /** A caller's own description for an error it raised, before the server's message. */
  describeError?: (error: unknown) => string | undefined;
};
type PrintRequest = PrintReportOptions & {
  language: string;
  delivery: ReportDelivery;
  unsubscribe: () => void;
  isCurrent: () => boolean;
};
const stillSignedIn = (userId: string) => useLoginData.getState().referenceDataUserId === userId;
const isServerError = (error: unknown) =>
  isAxiosError(error) && (error.response?.status ?? 0) >= 500;

export function usePrintReport(options: PrintReportOptions) {
  const { i18n, t } = useTranslation();
  const online = useOnline();
  const queryClient = useQueryClient();
  const print = useMutation({
    mutationFn: async (sent: PrintRequest) => {
      try {
        if (!sent.isCurrent()) throw new SessionEndedError();
        if (sent.device || !isOnline()) throw new LocalDataUnavailableError();
        if (!sent.serverAuthorized) {
          const permissions = await queryClient.fetchQuery(permissionsOptions(sent.userId));
          if (!sent.isCurrent()) throw new SessionEndedError();
          if (!hasProgramGrant(permissions, sent.right, sent.facilityId, sent.programId)) {
            throw new ForbiddenError(sent.right);
          }
        }
        if (sent.device || !isOnline()) throw new LocalDataUnavailableError();
        if (sent.beforeRequest && !(await sent.beforeRequest())) {
          sent.delivery.close();
          return false;
        }
        if (!sent.isCurrent()) throw new SessionEndedError();
        if (sent.device || !isOnline()) throw new LocalDataUnavailableError();
        const report = await sent.request(sent.language);
        if (!sent.isCurrent()) throw new SessionEndedError();
        sent.delivery.deliver(report);
        return true;
      } catch (error) {
        sent.delivery.close();
        throw error;
      } finally {
        sent.unsubscribe();
      }
    },
    onSuccess: (delivered, sent) => {
      if (!delivered || !sent.isCurrent()) return;
      toast.success(sent.successTitle, { description: sent.successDescription });
    },
    onError: (error, sent) => {
      if (!sent.isCurrent() || isSilentApiError(error)) return;
      const unavailable = error instanceof LocalDataUnavailableError;
      const forbidden = error instanceof ForbiddenError;
      if (!unavailable && !forbidden) reportApiError(error);
      const description =
        !isOnline() || unavailable
          ? t('offline.print-description')
          : forbidden
            ? sent.refusedDescription
            : (sent.describeError?.(error) ??
              apiErrorText(error, () => sent.errorDescription, t, {
                write: false,
                allowServerMessage: !isServerError(error),
              }));
      if (description !== null) toast.error(sent.errorTitle, { description });
    },
  });
  return {
    isPending: print.isPending,
    offline: !online || Boolean(options.device),
    disabledReason: online && !options.device ? undefined : t('offline.print-description'),
    print: () => {
      if (options.device || !isOnline() || print.isPending || !stillSignedIn(options.userId))
        return;
      const delivery = options.onReport();
      let cancelled = false;
      const unsubscribe = useLoginData.subscribe((state) => {
        if (state.referenceDataUserId !== options.userId) {
          cancelled = true;
          delivery.close();
        }
      });
      print.mutate({
        ...options,
        language: i18n.resolvedLanguage ?? i18n.language ?? 'en',
        delivery,
        unsubscribe,
        isCurrent: () => !cancelled && stillSignedIn(options.userId),
      });
    },
  };
}
