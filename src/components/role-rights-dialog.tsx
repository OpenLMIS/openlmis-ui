import { useQuery } from '@tanstack/react-query';
import { CheckIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ErrorAlert, RetryButton, SkeletonLine } from '@/components/dialog-parts';
import { useDialogTarget } from '@/components/form-dialog/use-dialog-target';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { rolesOptions } from '@/features/reference-data/api/queries';
import { useRightLabel } from '@/features/reference-data/lib/use-right-label';

type RoleRightsDialogProps = {
  /** The role whose rights are shown; open while set. */
  roleId: string | undefined;
  onClose: () => void;
};

/** What a role lets its holder do, which legacy only showed on hover. */
export function RoleRightsDialog({ roleId, onClose }: RoleRightsDialogProps) {
  const { t } = useTranslation();
  const rightLabel = useRightLabel();
  const { shown, dialogProps } = useDialogTarget(roleId, onClose);
  const roles = useQuery(rolesOptions());
  const role = roles.data?.find((item) => item.id === shown);
  const rights = (role?.rights ?? []).map((right) => rightLabel(right.name)).sort();

  return (
    <Dialog {...dialogProps()}>
      <DialogContent layout="scroll">
        <DialogHeader spacing="tight">
          <DialogTitle size="lg">
            {role ? t('role-rights.title', { role: role.name }) : t('role-rights.fallback-title')}
          </DialogTitle>
          {roles.isPending ? (
            <SkeletonLine width="medium" />
          ) : (
            <DialogDescription>
              {role
                ? role.description || t('role-rights.description', { count: rights.length })
                : !roles.isError && t('role-rights.missing')}
            </DialogDescription>
          )}
        </DialogHeader>
        {roles.isError && (
          <ErrorAlert
            action={<RetryButton onClick={() => void roles.refetch()} />}
            description={t('role-rights.error-description')}
            title={t('role-rights.error-title')}
          />
        )}
        {rights.length > 0 && (
          <ul className="-mx-4 flex min-h-0 flex-col gap-2 overflow-y-auto px-4 text-sm">
            {rights.map((right) => (
              <li className="flex items-center gap-2" key={right}>
                <CheckIcon aria-hidden="true" className="size-4 shrink-0 text-success" />
                {right}
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {t('role-rights.close')}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
