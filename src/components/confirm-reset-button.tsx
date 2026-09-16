import { RotateCcwIcon } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ConfirmResetButtonProps = {
  onConfirm: () => void;
  disabled?: boolean;
  /* Variant for the trigger. Defaults to `outline`; the wizard uses `ghost`. */
  variant?: 'outline' | 'ghost';
  label?: string;
  title?: string;
  description?: string;
  className?: string;
  showIcon?: boolean;
};

/*
  Reset triggers data loss, so it always goes through an AlertDialog
  confirmation. Extracted because every form in the template will want
  the same pattern - keeps the copy and button treatment consistent.
*/
export function ConfirmResetButton({
  onConfirm,
  disabled,
  variant = 'outline',
  label = 'Reset',
  title = 'Reset this form?',
  description = 'All entered values will be cleared. This action cannot be undone.',
  className,
  showIcon = false,
}: ConfirmResetButtonProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button type="button" variant={variant} disabled={disabled} className={cn(className)} />
        }
      >
        {showIcon && <RotateCcwIcon data-icon="inline-start" />}
        {label}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} variant="destructive">
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
