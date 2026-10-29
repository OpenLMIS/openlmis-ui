import { RoleFormDialog } from '@/features/roles/components/role-form-dialog';
import { RoleRightsDialog } from '@/features/roles/components/role-rights-dialog';

type RoleDialogsProps = {
  role: 'new' | string | undefined;
  rightsRoleId: string | undefined;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function RoleDialogs({ role, rightsRoleId, canEdit, onClose, onSaved }: RoleDialogsProps) {
  return (
    <>
      <RoleFormDialog canEdit={canEdit} onClose={onClose} onSaved={onSaved} target={role} />
      <RoleRightsDialog onClose={onClose} roleId={rightsRoleId} />
    </>
  );
}
