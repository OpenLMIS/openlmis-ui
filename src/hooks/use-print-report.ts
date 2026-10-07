import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { serverMessage } from '@/components/dialog-parts';
import { permissionsOptions } from '@/features/auth/api/queries';
import { ForbiddenError } from '@/features/auth/lib/access';
import { SessionEndedError } from '@/features/auth/lib/session';
import { useLoginData } from '@/features/auth/store/login-data';
import type { ReportDelivery } from '@/lib/open-report';
import { hasProgramGrant } from '@/lib/permissions';

type PrintReportOptions = {
  userId: string;
  facilityId: string;
  programId: string;
  right: string;
  request: (language: string) => Promise<Blob>;
  onReport: () => ReportDelivery;
  successTitle: string;
  successDescription: string;
  errorTitle: string;
  errorDescription: string;
  refusedDescription: string;
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
  const { i18n } = useTranslation();
  const queryClient = useQueryClient();
  const print = useMutation({
    mutationFn: async (sent: PrintRequest) => {
      try {
        if (!sent.isCurrent()) throw new SessionEndedError();
        const permissions = await queryClient.fetchQuery(permissionsOptions(sent.userId));
        if (!sent.isCurrent()) throw new SessionEndedError();
        if (!hasProgramGrant(permissions, sent.right, sent.facilityId, sent.programId)) {
          throw new ForbiddenError(sent.right);
        }
        const report = await sent.request(sent.language);
        if (!sent.isCurrent()) throw new SessionEndedError();
        sent.delivery.deliver(report);
      } catch (error) {
        sent.delivery.close();
        throw error;
      } finally {
        sent.unsubscribe();
      }
    },
    onSuccess: (_, sent) => {
      if (!sent.isCurrent()) return;
      toast.success(sent.successTitle, { description: sent.successDescription });
    },
    onError: (error, sent) => {
      if (!sent.isCurrent()) return;
      toast.error(sent.errorTitle, {
        description:
          error instanceof ForbiddenError
            ? sent.refusedDescription
            : (!isServerError(error) && serverMessage(error)) || sent.errorDescription,
      });
    },
  });
  return {
    isPending: print.isPending,
    print: () => {
      if (print.isPending || !stillSignedIn(options.userId)) return;
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
