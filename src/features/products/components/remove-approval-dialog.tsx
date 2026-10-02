import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2Icon, Trash2Icon } from 'lucide-react';
import { useRef, useState } from 'react';
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
import { removeApproval } from '@/features/products/api/api';
import { productApprovalsOptions } from '@/features/products/api/queries';
import type { ProductDetail } from '@/features/products/lib/types';

type RemoveApprovalDialogProps = {
  product: ProductDetail;
  approvalId: string | undefined;
  onClose: () => void;
};

export function RemoveApprovalDialog({ product, approvalId, onClose }: RemoveApprovalDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { shown, dialogProps } = useDialogTarget(approvalId, onClose);
  const { data: approvals } = useQuery(productApprovalsOptions(product.id));
  const cancelRef = useRef<HTMLButtonElement>(null);
  const remove = useMutation({
    mutationFn: removeApproval,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: productApprovalsOptions(product.id).queryKey }),
  });
  const approval = approvals?.find((item) => item.id === shown);
  const [named, setNamed] = useState<{ id: string; facilityType: string; program: string }>();
  if (approval && named?.id !== approval.id) {
    setNamed({
      id: approval.id,
      facilityType: approval.facilityType.name,
      program: approval.program.name || approval.program.code,
    });
  }
  const params = {
    product: product.fullProductName || product.productCode,
    facilityType: named?.facilityType ?? '',
    program: named?.program ?? '',
  };
  const found = remove.isSuccess || Boolean(approval);
  const props = dialogProps(remove.isPending);

  return (
    <AlertDialog
      {...props}
      onOpenChangeComplete={(next) => {
        props.onOpenChangeComplete(next);
        if (!next) remove.reset();
      }}
    >
      <AlertDialogContent initialFocus={cancelRef}>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2Icon />
          </AlertDialogMedia>
          <AlertDialogTitle>{t('products.approvals.remove-title', params)}</AlertDialogTitle>
          <AlertDialogDescription>
            {found
              ? t('products.approvals.remove-description', params)
              : t('products.approvals.form.not-found')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {remove.isError && (
          <ErrorAlert
            description={serverMessage(remove.error) ?? t('products.form.save-error')}
            title={t('products.approvals.remove-error-title')}
          />
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending} ref={cancelRef}>
            {t(found ? 'dialog.cancel' : 'dialog.close')}
          </AlertDialogCancel>
          {found && (
            <Button
              disabled={remove.isPending}
              focusableWhenDisabled
              onClick={() =>
                shown &&
                remove.mutate(shown, {
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
