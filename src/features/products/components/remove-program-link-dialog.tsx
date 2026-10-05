import { useQuery } from '@tanstack/react-query';
import { Loader2Icon, Trash2Icon } from 'lucide-react';
import { type RefObject, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ErrorAlert, RetryButton, SkeletonLine, serverMessage } from '@/components/dialog-parts';
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
import { productName } from '@/features/reference-data/lib/product-name';
import { programName } from '@/features/reference-data/lib/programs';

type RemoveProgramLinkDialogProps = {
  product: ProductDetail;
  programId: string | undefined;
  afterRemove?: RefObject<HTMLElement | null>;
  onClose: () => void;
};

export function RemoveProgramLinkDialog({
  product,
  programId,
  afterRemove,
  onClose,
}: RemoveProgramLinkDialogProps) {
  const { t } = useTranslation();
  const { shown, dialogProps } = useDialogTarget(programId, onClose);
  const programs = useQuery(programsOptions());
  const save = useProductSave(product.id);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const program = programs.data?.find((item) => item.id === shown);
  const name = program ? programName(program) : '';
  const productLabel = productName(product);
  const linked = save.isSuccess || product.programs.some((link) => link.programId === shown);
  const state = !linked
    ? 'missing'
    : programs.isPending
      ? 'loading'
      : programs.isError
        ? 'failed'
        : 'found';
  const props = dialogProps(save.isPending);

  return (
    <AlertDialog
      {...props}
      onOpenChangeComplete={(next) => {
        props.onOpenChangeComplete(next);
        if (!next) save.reset();
      }}
    >
      <AlertDialogContent
        finalFocus={save.isSuccess && afterRemove ? afterRemove : true}
        initialFocus={cancelRef}
      >
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2Icon />
          </AlertDialogMedia>
          <AlertDialogTitle>
            {state === 'found'
              ? t('products.programs.remove-title', { program: name })
              : state === 'missing'
                ? t('products.programs.not-found-title')
                : t('products.programs.remove-pending-title')}
          </AlertDialogTitle>
          {state === 'loading' ? (
            <SkeletonLine width="medium" />
          ) : (
            <AlertDialogDescription>
              {state === 'found'
                ? t('products.programs.remove-description', {
                    product: productLabel,
                    program: name,
                  })
                : state === 'missing'
                  ? t('products.programs.form.not-found')
                  : t('products.programs.error-description')}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        {save.isError && (
          <ErrorAlert
            description={serverMessage(save.error) ?? t('products.form.save-error')}
            title={t('products.programs.remove-error-title')}
          />
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={save.isPending} ref={cancelRef}>
            {t(state === 'missing' || state === 'failed' ? 'dialog.close' : 'dialog.cancel')}
          </AlertDialogCancel>
          {state === 'failed' && <RetryButton onClick={() => void programs.refetch()} />}
          {(state === 'found' || state === 'loading') && (
            <Button
              disabled={save.isPending || state === 'loading'}
              focusableWhenDisabled={save.isPending}
              onClick={() =>
                shown &&
                save.mutate((latest) => withoutProgramLink(latest, shown), {
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
