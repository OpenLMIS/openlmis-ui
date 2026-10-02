import { useQuery } from '@tanstack/react-query';
import { Loader2Icon, Trash2Icon } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ErrorAlert, serverMessage } from '@/components/dialog-parts';
import { useDialogTarget } from '@/components/form-dialog/use-dialog-target';
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
import { Button } from '@/components/ui/button';
import { useProductSave } from '@/features/products/hooks/use-product-save';
import { withoutProgramLink } from '@/features/products/lib/program-link-form';
import type { ProductDetail } from '@/features/products/lib/types';
import { programsOptions } from '@/features/reference-data/api/queries';
import { programName } from '@/features/reference-data/lib/programs';

type RemoveProgramLinkDialogProps = {
  product: ProductDetail;
  /** The id of the program to take the product out of. */
  programId: string | undefined;
  onClose: () => void;
};

export function RemoveProgramLinkDialog({
  product,
  programId,
  onClose,
}: RemoveProgramLinkDialogProps) {
  const { t } = useTranslation();
  const { shown, dialogProps } = useDialogTarget(programId, onClose);
  const { data: programs } = useQuery(programsOptions());
  const save = useProductSave(product.id);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const program = programs?.find((item) => item.id === shown);
  const name = program ? programName(program) : (shown ?? '');
  const productLabel = product.fullProductName || product.productCode;
  const linked = save.isSuccess || product.programs.some((link) => link.programId === shown);
  const props = dialogProps(save.isPending);

  return (
    <AlertDialog
      {...props}
      onOpenChangeComplete={(next) => {
        props.onOpenChangeComplete(next);
        if (!next) save.reset();
      }}
    >
      <AlertDialogContent initialFocus={cancelRef}>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2Icon />
          </AlertDialogMedia>
          <AlertDialogTitle>
            {t('products.programs.remove-title', { program: name })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {linked
              ? t('products.programs.remove-description', { product: productLabel, program: name })
              : t('products.programs.form.not-found')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {save.isError && (
          <ErrorAlert
            description={serverMessage(save.error) ?? t('products.form.save-error')}
            title={t('products.programs.remove-error-title')}
          />
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={save.isPending} ref={cancelRef}>
            {t(linked ? 'dialog.cancel' : 'dialog.close')}
          </AlertDialogCancel>
          {linked && (
            <Button
              disabled={save.isPending}
              focusableWhenDisabled
              onClick={() =>
                shown &&
                save.mutate(withoutProgramLink(product, shown), {
                  onSuccess: () => {
                    toast.success(t('products.programs.removed-title'), {
                      description: t('products.programs.removed', {
                        product: productLabel,
                        program: name,
                      }),
                    });
                    onClose();
                  },
                })
              }
              variant="destructive"
            >
              {save.isPending && <Loader2Icon className="animate-spin" data-icon="inline-start" />}
              {t('products.programs.remove')}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
