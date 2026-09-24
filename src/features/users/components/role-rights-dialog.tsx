import { useQuery } from '@tanstack/react-query';
import { CheckIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
import { rightLabel } from '@/features/users/lib/role-assignments';

type RoleRightsDialogProps = {
  /** The role whose rights are shown; open while set. */
  roleId: string | undefined;
  onClose: () => void;
};

/** What a role lets its holder do, which legacy only showed on hover. */
export function RoleRightsDialog({ roleId, onClose }: RoleRightsDialogProps) {
  const { t } = useTranslation();
  const { shown, dialogProps } = useDialogTarget(roleId, onClose);
  const { data: role } = useQuery({
    ...rolesOptions(),
    select: (roles) => roles.find((item) => item.id === shown),
  });
  const rights = (role?.rights ?? []).map((right) => rightLabel(right.name)).sort();

  return (
    <Dialog {...dialogProps()}>
      <DialogContent layout="scroll">
        <DialogHeader spacing="tight">
          <DialogTitle size="lg">
            {t('users.roles.rights.title', { role: role?.name ?? t('users.roles.unknown') })}
          </DialogTitle>
          <DialogDescription size="sm">
            {role?.description || t('users.roles.rights.description', { count: rights.length })}
          </DialogDescription>
        </DialogHeader>
        <ul className="-mx-4 flex min-h-0 flex-col gap-2 overflow-y-auto px-4 text-sm">
          {rights.map((right) => (
            <li className="flex items-center gap-2" key={right}>
              <CheckIcon aria-hidden="true" className="size-4 shrink-0 text-success" />
              {right}
            </li>
          ))}
        </ul>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {t('users.roles.rights.close')}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
