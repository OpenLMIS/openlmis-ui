import { CircleAlertIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Props = Pick<
  ComponentProps<typeof AlertDialog>,
  'open' | 'onOpenChange' | 'onOpenChangeComplete'
> &
  Pick<ComponentProps<typeof AlertDialogContent>, 'finalFocus' | 'size'> & {
    title: ReactNode;
    description: ReactNode;
    closeLabel?: string;
    media?: ReactNode;
    children?: ReactNode;
  };

export function InvalidSubmitDialog({
  open,
  onOpenChange,
  onOpenChangeComplete,
  finalFocus,
  size,
  title,
  description,
  closeLabel,
  media = <CircleAlertIcon className="text-destructive" />,
  children,
}: Props) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={onOpenChangeComplete}
    >
      <AlertDialogContent size={size} finalFocus={finalFocus}>
        <AlertDialogHeader>
          <AlertDialogMedia>{media}</AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {children ?? <AlertDialogCancel>{closeLabel}</AlertDialogCancel>}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
