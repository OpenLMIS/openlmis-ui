import { isAxiosError } from 'axios';
import { AlertCircleIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FormDialogCancel,
  FormDialogFooter,
  FormDialogHeader,
  FormDialogTitle,
} from '@/components/form-dialog/form-dialog';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/** The server's own message when it sent one, e.g. that a username is taken. */
export function serverMessage(error: unknown): string | undefined {
  if (!isAxiosError(error)) return undefined;
  const message = (error.response?.data as { message?: unknown } | undefined)?.message;
  return typeof message === 'string' && message ? message : undefined;
}

type ErrorAlertProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function ErrorAlert({ title, description, action }: ErrorAlertProps) {
  return (
    <Alert variant="destructive">
      <AlertCircleIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
      {action && <AlertAction>{action}</AlertAction>}
    </Alert>
  );
}

export function RetryButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <Button onClick={onClick} size="sm" type="button" variant="outline">
      {t('error.try-again')}
    </Button>
  );
}

/** One line of small text: its line height with a bar inside, so it takes the room the text will. */
export function SkeletonLine({ width }: { width: 'short' | 'medium' }) {
  return (
    <div className="flex h-4 items-center">
      <div className={width === 'short' ? 'h-3 w-32' : 'h-3 w-56'}>
        <Skeleton fill />
      </div>
    </div>
  );
}

/** What a dialog shows when the user it needs could not be loaded: its title, the error, Try Again. */
export function DialogLoadError({ title, onRetry }: { title: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <FormDialogHeader>
        <FormDialogTitle>{title}</FormDialogTitle>
      </FormDialogHeader>
      <ErrorAlert
        action={<RetryButton onClick={onRetry} />}
        description={t('users.error-description')}
        title={t('users.form.load-error-title')}
      />
      <FormDialogFooter>
        <FormDialogCancel>{t('users.form.cancel')}</FormDialogCancel>
      </FormDialogFooter>
    </>
  );
}
