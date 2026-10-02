import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { removeApproval } from '@/features/products/api/api';
import { productApprovalsOptions } from '@/features/products/api/queries';
import { productName } from '@/features/products/lib/product-name';
import type { Approval, ProductDetail } from '@/features/products/lib/types';
import { facilityTypeName } from '@/features/reference-data/lib/facility-types';
import { programName } from '@/features/reference-data/lib/programs';

type RemoveApprovalDialogProps = {
  product: ProductDetail;
  approvalId: string | undefined;
  afterRemove?: RefObject<HTMLElement | null>;
  onClose: () => void;
};

export function RemoveApprovalDialog({
  product,
  approvalId,
  afterRemove,
  onClose,
}: RemoveApprovalDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { shown, dialogProps } = useDialogTarget(approvalId, onClose);
  const approvals = useQuery(productApprovalsOptions(product.id));
  const cancelRef = useRef<HTMLButtonElement>(null);
  const remove = useMutation({
    mutationFn: (removed: Approval) => removeApproval(removed.id),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: productApprovalsOptions(product.id).queryKey }),
  });
  const approval = approvals.data?.find((item) => item.id === shown);
  const named = remove.isSuccess ? remove.variables : approval;
  const state = named
    ? 'found'
    : approvals.isPending
      ? 'loading'
      : approvals.isError
        ? 'failed'
        : 'missing';
  const params = {
    product: productName(product),
    facilityType: named ? facilityTypeName(named.facilityType) : '',
    program: named ? programName(named.program) : '',
  };
  const props = dialogProps(remove.isPending);

  return (
    <AlertDialog
      {...props}
      onOpenChangeComplete={(next) => {
        props.onOpenChangeComplete(next);
        if (!next) remove.reset();
      }}
    >
      <AlertDialogContent
        finalFocus={remove.isSuccess && afterRemove ? afterRemove : true}
        initialFocus={cancelRef}
      >
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2Icon />
          </AlertDialogMedia>
          <AlertDialogTitle>
            {state === 'found'
              ? t('products.approvals.remove-title', params)
              : state === 'missing'
                ? t('products.approvals.not-found-title')
                : t('products.approvals.remove-pending-title')}
          </AlertDialogTitle>
          {state === 'loading' ? (
            <SkeletonLine width="medium" />
          ) : (
            <AlertDialogDescription>
              {state === 'found'
                ? t('products.approvals.remove-description', params)
                : state === 'missing'
                  ? t('products.approvals.form.not-found')
                  : t('products.approvals.error-description')}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        {remove.isError && (
          <ErrorAlert
            description={serverMessage(remove.error) ?? t('products.form.save-error')}
            title={t('products.approvals.remove-error-title')}
          />
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending} ref={cancelRef}>
            {t(state === 'missing' || state === 'failed' ? 'dialog.close' : 'dialog.cancel')}
          </AlertDialogCancel>
          {state === 'failed' && <RetryButton onClick={() => void approvals.refetch()} />}
          {(state === 'found' || state === 'loading') && (
            <Button
              disabled={remove.isPending || state === 'loading'}
              focusableWhenDisabled={remove.isPending}
              onClick={() =>
                approval &&
                remove.mutate(approval, {
                  onSuccess: () => {
                    toast.success(t('products.approvals.removed-title'), {
                      description: t('products.approvals.removed', params),
                    });
                    onClose();
                  },
                })
              }
              variant="destructive"
            >
              {remove.isPending && (
                <Loader2Icon className="animate-spin" data-icon="inline-start" />
              )}
              {t('products.approvals.remove')}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
