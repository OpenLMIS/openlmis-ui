import { RoleRightsDialog } from '@/components/role-rights-dialog';
import type { RightType } from '@/features/reference-data/lib/types';
import {
  type RoleDialogTarget,
  RoleFormDialog,
} from '@/features/roles/components/role-form-dialog';

type RoleDialogsProps = {
  role: RoleDialogTarget | undefined;
  rightsRoleId: string | undefined;
  canEdit: boolean;
  onClose: () => void;
  onPickType: (type: RightType) => void;
  onBackToTypes: () => void;
  onSaved: () => void;
};

/** The dialogs the roles list opens, loaded together as one chunk. */
export function RoleDialogs({ role, rightsRoleId, onClose, ...props }: RoleDialogsProps) {
  return (
    <>
      <RoleFormDialog onClose={onClose} target={role} {...props} />
      <RoleRightsDialog onClose={onClose} roleId={rightsRoleId} />
    </>
  );
}
