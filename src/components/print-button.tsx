import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { PrinterIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { serverMessage } from '@/components/dialog-parts';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { permissionsOptions } from '@/features/auth/api/queries';
import { ForbiddenError } from '@/features/auth/lib/access';
import { SessionEndedError } from '@/features/auth/lib/session';
import { useLoginData } from '@/features/auth/store/login-data';
import { downloadFile } from '@/lib/download-file';
import { openReport } from '@/lib/open-report';
import { hasProgramGrant } from '@/lib/permissions';

type PrintButtonProps = {
  userId: string;
  facilityId: string;
  programId: string;
  right: string;
  request: (language: string) => Promise<Blob>;
  filename: string;
  reportAction?: 'download' | 'open';
  labels: {
    button: string;
    successTitle: string;
    successDescription: string;
    errorTitle: string;
    errorDescription: string;
    refusedDescription: string;
  };
  disabled?: boolean;
  size?: 'default' | 'lg';
};
type PrintRequest = Omit<PrintButtonProps, 'disabled' | 'size'> & { language: string };
const stillSignedIn = (userId: string) => useLoginData.getState().referenceDataUserId === userId;
const isServerError = (error: unknown) =>
  isAxiosError(error) && (error.response?.status ?? 0) >= 500;

export function PrintButton({ disabled, size = 'default', ...props }: PrintButtonProps) {
  const { i18n } = useTranslation();
  const queryClient = useQueryClient();
  const print = useMutation({
    mutationFn: async (sent: PrintRequest) => {
      if (!stillSignedIn(sent.userId)) throw new SessionEndedError();
      const permissions = await queryClient.fetchQuery(permissionsOptions(sent.userId));
      if (!stillSignedIn(sent.userId)) throw new SessionEndedError();
      if (!hasProgramGrant(permissions, sent.right, sent.facilityId, sent.programId)) {
        throw new ForbiddenError(sent.right);
      }
      return sent.request(sent.language);
    },
    onSuccess: (report, sent) => {
      if (!stillSignedIn(sent.userId)) return;
      if (sent.reportAction === 'open') openReport(report);
      else downloadFile(report, sent.filename);
      toast.success(sent.labels.successTitle, { description: sent.labels.successDescription });
    },
    onError: (error, sent) => {
      if (!stillSignedIn(sent.userId)) return;
      toast.error(sent.labels.errorTitle, {
        description:
          error instanceof ForbiddenError
            ? sent.labels.refusedDescription
            : (!isServerError(error) && serverMessage(error)) || sent.labels.errorDescription,
      });
    },
  });
  return (
    <Button
      disabled={disabled || print.isPending}
      size={size}
      type="button"
      onClick={() =>
        print.mutate({ ...props, language: i18n.resolvedLanguage ?? i18n.language ?? 'en' })
      }
    >
      {print.isPending ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <PrinterIcon data-icon="inline-start" />
      )}
      {props.labels.button}
    </Button>
  );
}
