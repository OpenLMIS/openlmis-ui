import type { ParseKeys } from 'i18next';
import { Loader2Icon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

type Props = {
  finalFocus: ComponentProps<typeof AlertDialogContent>['finalFocus'];
  open: boolean;
  pending: boolean;
  username: string;
  count: number;
  title: ParseKeys;
  description: ParseKeys;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
};

export function SubmitConfirmDialog({
  open,
  finalFocus,
  pending,
  username,
  count,
  title,
  description,
  onOpenChange,
  onConfirm,
}: Props) {
  const { t } = useTranslation();
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <AlertDialogContent finalFocus={finalFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t(title, { user: username, count })}</AlertDialogTitle>
          <AlertDialogDescription>
            {t(description, { user: username, count })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t('stock-events.cancel')}</AlertDialogCancel>
          <Button
            disabled={pending}
            focusableWhenDisabled={pending}
            onClick={() => {
              if (!pending) void onConfirm();
            }}
          >
            {pending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
            {t('stock-events.confirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
