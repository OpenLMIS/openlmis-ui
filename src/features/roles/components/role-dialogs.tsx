import { RoleRightsDialog } from '@/components/role-rights-dialog';
import { RoleFormDialog } from '@/features/roles/components/role-form-dialog';

type RoleDialogsProps = {
  role: 'new' | string | undefined;
  rightsRoleId: string | undefined;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
};

/** The dialogs the roles list opens, loaded together as one chunk. */
export function RoleDialogs({ role, rightsRoleId, canEdit, onClose, onSaved }: RoleDialogsProps) {
  return (
    <>
      <RoleFormDialog canEdit={canEdit} onClose={onClose} onSaved={onSaved} target={role} />
      <RoleRightsDialog onClose={onClose} roleId={rightsRoleId} />
    </>
  );
}
